"""Bridge HTTP requests onto Anki's serialized operation queue.

The companion HTTP server runs on worker threads, while Anki's collection is
owned by the application and must only be touched by Anki operations.  This
module keeps that boundary explicit: the request thread schedules a
``QueryOp`` or ``CollectionOp`` on Anki's main thread, waits for the operation
callback, and returns a protocol envelope to the HTTP handler.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from threading import Event, Lock
from typing import Any


Response = dict[str, object]
OperationFactory = Callable[..., Any]


@dataclass(frozen=True)
class CollectionOperationResponse:
    """CollectionOp-compatible result that preserves the protocol response."""

    response: Response
    native_changes: object

    @property
    def changes(self) -> object:
        """Return the base OpChanges expected by Anki's operation hooks."""

        return getattr(self.native_changes, "changes", self.native_changes)


class AnkiOperationBridge:
    """Dispatch a request through Anki's QueryOp/CollectionOp primitives.

    ``run_on_main`` is intentionally injected so the addon entry point can use
    ``aqt.mw.taskman.run_on_main`` (or an equivalent Qt-safe helper), while
    tests can execute the callback synchronously.  The bridge never accesses a
    collection itself; the supplied ``handle`` is invoked from the operation
    callback.
    """

    # Only operations that return Anki OpChanges belong in CollectionOp.
    # Selecting the active deck, answering, and undoing all return native
    # changes in Anki 25.09.2.
    _COLLECTION_ACTIONS = frozenset(
        {"session.start", "session.answer", "session.undo"}
    )

    def __init__(
        self,
        *,
        parent: object,
        handle: Callable[[object], Response],
        run_on_main: Callable[[Callable[[], None]], object],
        query_op_factory: OperationFactory,
        collection_op_factory: OperationFactory,
        collection_changes: Callable[[], object],
        expected_collection: object | None = None,
        # Timeout 是 Anki operation 的预算：必须小于 Rust 代理层端到端
        # 15s（src-tauri/src/commands.rs TIMEOUT），留出网络往返余量；
        # 12s 给大牌组 next_item 渲染留出空间，避免 10s 误超时。
        timeout: float = 12.0,
    ) -> None:
        if timeout <= 0:
            raise ValueError("timeout must be greater than zero")
        self.parent = parent
        self.handle = handle
        self.run_on_main = run_on_main
        self.query_op_factory = query_op_factory
        self.collection_op_factory = collection_op_factory
        self.collection_changes = collection_changes
        self.expected_collection = expected_collection
        self.timeout = timeout
        # A bridge may serve several HTTP worker threads.  Anki's operation
        # queue is serialized, but this lock also prevents two bridge waits
        # from racing the small callback state below.
        self._dispatch_lock = Lock()

    @staticmethod
    def _error(
        code: str,
        message: str,
        *,
        retryable: bool = True,
    ) -> Response:
        return {
            "result": None,
            "error": {
                "code": code,
                "message": message,
                "retryable": retryable,
            },
        }

    def _is_query(self, request: object) -> bool:
        action = request.get("action") if isinstance(request, dict) else None
        return action not in self._COLLECTION_ACTIONS

    def dispatch(self, request: object) -> Response:
        """Run ``handle(request)`` in an Anki operation and wait for its result."""

        completed = Event()
        state: dict[str, object] = {}

        def on_success(response: object) -> None:
            if isinstance(response, CollectionOperationResponse):
                response = response.response
            if isinstance(response, dict):
                state["response"] = response
            else:
                state["response"] = self._error(
                    "ANKI_OPERATION_FAILED", "Anki operation returned an invalid response."
                )
            completed.set()

        def on_failure(_error: object) -> None:
            # Do not return exception text: Anki exceptions can contain paths,
            # SQL, or other sensitive implementation details.
            state["response"] = self._error(
                "ANKI_OPERATION_FAILED", "Anki operation failed."
            )
            completed.set()

        def create_and_start() -> None:
            try:
                if self._is_query(request):
                    def operation(collection: object) -> Response:
                        if (
                            self.expected_collection is not None
                            and collection is not self.expected_collection
                        ):
                            return self._error(
                                "PROFILE_CHANGED",
                                "The active Anki collection changed before the request ran.",
                                retryable=False,
                            )
                        return self.handle(request)

                    operation_object = self.query_op_factory(
                        parent=self.parent,
                        op=operation,
                        success=on_success,
                    )
                else:
                    def operation(collection: object) -> CollectionOperationResponse:
                        if (
                            self.expected_collection is not None
                            and collection is not self.expected_collection
                        ):
                            response = self._error(
                                "PROFILE_CHANGED",
                                "The active Anki collection changed before the request ran.",
                                retryable=False,
                            )
                        else:
                            response = self.handle(request)
                        return CollectionOperationResponse(
                            response=response,
                            native_changes=self.collection_changes(),
                        )

                    operation_object = self.collection_op_factory(
                        parent=self.parent,
                        op=operation,
                    )
                    operation_object.success(on_success)
                operation_object.failure(on_failure)
                operation_object.run_in_background()
            except Exception:
                on_failure(None)

        # Keep request-level state isolated.  The lock is held only while
        # scheduling and waiting; the operation itself remains on Anki's queue.
        with self._dispatch_lock:
            try:
                self.run_on_main(create_and_start)
            except Exception:
                on_failure(None)

            if not completed.wait(self.timeout):
                return self._error(
                    "ANKI_OPERATION_TIMEOUT", "Anki operation timed out."
                )
            response = state.get("response")
            if isinstance(response, dict):
                return response
            return self._error("ANKI_OPERATION_FAILED", "Anki operation failed.")
