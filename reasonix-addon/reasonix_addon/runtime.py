"""Lifecycle and loopback server ownership for the Reasonix Anki addon."""

from __future__ import annotations

import json
from collections.abc import Callable
from hmac import compare_digest
from pathlib import Path
from threading import RLock, Thread
from time import time
from typing import Any, Protocol

from .http import AddonHttpServer
from .protocol import ProtocolValidationError, parse_request


HOST = "127.0.0.1"
PORT = 8766


def _load_addon_version() -> str:
    """从 manifest.json 读取 human_version（单一真源）。

    插件安装后 manifest 位于插件包根目录；读取失败时兜底常量，
    保证 status.addonVersion 总有值可上报。
    """
    manifest = Path(__file__).resolve().parent.parent / "manifest.json"
    try:
        with manifest.open(encoding="utf-8") as source:
            version = json.load(source).get("human_version")
        if isinstance(version, str) and version:
            return version
    except (OSError, ValueError):
        pass
    return "0.1.1"


ADDON_VERSION = _load_addon_version()
CAPABILITIES = (
    "status",
    "requestPermission",
    "decks.today",
    "session.start",
    "session.next",
    "session.reveal",
    "session.answer",
    "session.undo",
    "session.finish",
    "sync.start",
    "sync.status",
)


class RequestBridge(Protocol):
    def dispatch(self, request: object) -> dict[str, object]: ...


class PermissionIssuer(Protocol):
    token: str

    def request_permission(self) -> dict[str, object]: ...


def _error(
    code: str, message: str, *, retryable: bool = True
) -> dict[str, object]:
    return {
        "result": None,
        "error": {
            "code": code,
            "message": message,
            "retryable": retryable,
        },
    }


class AddonRuntime:
    """Own the HTTP thread and gate requests around Anki lifecycle hooks."""

    def __init__(
        self,
        *,
        server_factory: Callable[..., Any] = AddonHttpServer,
        thread_factory: Callable[..., Any] = Thread,
        permission_manager: PermissionIssuer | None = None,
        addon_version: str = ADDON_VERSION,
        anki_version_provider: Callable[[], str] = lambda: "",
        sync_start: Callable[[], object] | None = None,
        run_on_main: Callable[[Callable[[], None]], object] = lambda callback: callback(),
        active_session_provider: Callable[[], bool] | None = None,
        clock: Callable[[], float] = time,
        sync_pending_timeout: float = 30.0,
    ) -> None:
        if sync_pending_timeout <= 0:
            raise ValueError("sync_pending_timeout must be greater than zero")
        self._server_factory = server_factory
        self._thread_factory = thread_factory
        self._permission_manager = permission_manager
        self._addon_version = addon_version
        self._anki_version_provider = anki_version_provider
        self._sync_start = sync_start
        self._run_on_main = run_on_main
        self._active_session_provider = active_session_provider
        self._clock = clock
        self._sync_pending_timeout = sync_pending_timeout
        self._lock = RLock()
        self._server: Any | None = None
        self._thread: Any | None = None
        self._bridge: RequestBridge | None = None
        self._invalidate: Callable[[], None] | None = None
        self._collection_available = False
        self._syncing = False
        self._sync_requested = False
        self._sync_request_id: str | None = None
        self._sync_requested_at: float | None = None
        self._sync_started_at: float | None = None
        self._sync_finished_at: float | None = None
        self._sync_attempts = 0
        self._last_sync_state = "idle"
        self._sync_error: str | None = None
        self._profile_name: str | None = None
        self._profile_key: str | None = None
        self._service_state = "stopped"
        self._service_started_at: float | None = None
        self._last_request_at: float | None = None
        self._last_heartbeat_at: float | None = None
        self._request_count = 0
        self._failed_request_count = 0
        self._last_error: dict[str, object] | None = None
        self._stopping = False

    def _record_error_locked(self, code: str, message: str) -> None:
        self._last_error = {
            "code": code,
            "message": message,
            "at": self._clock(),
        }

    def _serve(self, server: Any) -> None:
        try:
            server.serve_forever()
        except Exception:
            with self._lock:
                if self._server is server and not self._stopping:
                    self._service_state = "error"
                    self._record_error_locked(
                        "HTTP_SERVER_STOPPED",
                        "The Reasonix addon HTTP service stopped unexpectedly.",
                    )

    @staticmethod
    def _close_server(server: Any) -> None:
        for method_name in ("shutdown", "server_close"):
            method = getattr(server, method_name, None)
            if callable(method):
                try:
                    method()
                except Exception:
                    continue

    def start(self) -> bool:
        with self._lock:
            if self._server is not None:
                if self._service_state == "listening":
                    return True
                stale_server = self._server
                self._server = None
                self._thread = None
                self._close_server(stale_server)
            self._stopping = False
            self._service_state = "starting"
            try:
                server = self._server_factory((HOST, PORT), self.dispatch)
                self._server = server
                thread = self._thread_factory(
                    target=lambda server=server: self._serve(server),
                    name="reasonix-addon-http",
                    daemon=True,
                )
                self._thread = thread
                self._service_started_at = self._clock()
                # Mark the service ready before starting the worker. A real
                # HTTP thread blocks in serve_forever; a test or shutdown may
                # return immediately without that being a startup failure.
                self._service_state = "listening"
                thread.start()
            except Exception:
                self._service_state = "error"
                self._record_error_locked(
                    "HTTP_SERVER_START_FAILED",
                    "The Reasonix addon HTTP service could not start.",
                )
                server = self._server
                self._server = None
                self._thread = None
                if server is not None:
                    self._close_server(server)
                return False
            return True

    def stop(self) -> None:
        with self._lock:
            server = self._server
            thread = self._thread
            invalidate = self._invalidate
            self._server = None
            self._thread = None
            self._stopping = True
            self._service_state = "stopped"
            self._bridge = None
            self._invalidate = None
            self._collection_available = False
            self._syncing = False
            self._sync_requested = False
            self._sync_request_id = None
            self._sync_requested_at = None
            self._sync_started_at = None
            self._sync_finished_at = None
            self._last_sync_state = "idle"
            self._sync_error = None
            self._profile_name = None
            self._profile_key = None
        if invalidate is not None:
            invalidate()
        if server is None:
            return
        self._close_server(server)
        if thread is not None:
            thread.join(timeout=2.0)

    def profile_did_open(
        self,
        bridge: RequestBridge,
        *,
        invalidate: Callable[[], None],
        profile_name: str,
        profile_key: str,
        active_session_provider: Callable[[], bool] | None = None,
    ) -> None:
        with self._lock:
            previous_invalidate = self._invalidate
            self._bridge = bridge
            self._invalidate = invalidate
            self._collection_available = True
            self._syncing = False
            self._sync_requested = False
            self._sync_request_id = None
            self._sync_requested_at = None
            self._sync_started_at = None
            self._sync_finished_at = None
            self._last_sync_state = "idle"
            self._sync_error = None
            self._profile_name = profile_name
            self._profile_key = profile_key
            if active_session_provider is not None:
                self._active_session_provider = active_session_provider
        if previous_invalidate is not None:
            previous_invalidate()

    def _invalidate_active_session(self) -> None:
        with self._lock:
            invalidate = self._invalidate
        if invalidate is not None:
            invalidate()

    def profile_will_close(self) -> None:
        self._invalidate_active_session()
        with self._lock:
            self._bridge = None
            self._invalidate = None
            self._collection_available = False
            self._syncing = False
            self._sync_requested = False
            self._sync_request_id = None
            self._sync_requested_at = None
            self._sync_started_at = None
            self._sync_finished_at = None
            self._last_sync_state = "idle"
            self._sync_error = None
            self._profile_name = None
            self._profile_key = None
            self._active_session_provider = None

    def collection_will_temporarily_close(self) -> None:
        self._invalidate_active_session()
        with self._lock:
            self._collection_available = False

    def collection_did_temporarily_close(self) -> None:
        with self._lock:
            self._collection_available = self._bridge is not None

    def sync_will_start(self) -> None:
        self._invalidate_active_session()
        with self._lock:
            self._syncing = True
            self._sync_requested = False
            self._sync_started_at = self._clock()
            self._last_sync_state = "syncing"
            self._sync_error = None

    def sync_did_finish(self) -> None:
        with self._lock:
            self._syncing = False
            self._sync_requested = False
            self._sync_finished_at = self._clock()
            self._last_sync_state = "finished"
            self._sync_error = None

    def _expire_sync_request_locked(self, now: float) -> None:
        requested_at = self._sync_requested_at
        if (
            not self._sync_requested
            or requested_at is None
            or now - requested_at < self._sync_pending_timeout
        ):
            return
        self._sync_requested = False
        self._sync_request_id = None
        self._sync_finished_at = now
        self._last_sync_state = "error"
        self._sync_error = (
            "Anki did not confirm synchronization before the request timed out."
        )
        self._record_error_locked("SYNC_START_TIMEOUT", self._sync_error)

    def _authorized(self, request: dict[str, object]) -> bool:
        permission_manager = self._permission_manager
        token = request.get("token")
        return bool(
            permission_manager is not None
            and isinstance(token, str)
            and compare_digest(token, permission_manager.token)
        )

    def _start_sync(self, request: dict[str, object]) -> dict[str, object]:
        if not self._authorized(request):
            return _error("UNAUTHORIZED", "The session token is invalid.")
        with self._lock:
            self._expire_sync_request_locked(self._clock())
            request_id = request.get("requestId")
            if self._sync_request_id == request_id:
                if self._syncing or self._sync_requested:
                    return {"result": {"state": "starting"}, "error": None}
                if self._last_sync_state == "finished":
                    return {"result": {"state": "idle"}, "error": None}
            if self._sync_start is None:
                return _error("SYNC_UNAVAILABLE", "Anki synchronization is unavailable.")
            if self._profile_name == "Reasonix QA":
                return _error(
                    "SYNC_DISABLED_FOR_QA_PROFILE",
                    "Automatic synchronization is disabled for the QA profile.",
                    retryable=False,
                )
            if self._bridge is None or not self._collection_available:
                return _error(
                    "COLLECTION_UNAVAILABLE",
                    "Anki does not have an available collection.",
                )
            if self._syncing or self._sync_requested:
                return _error("SYNC_IN_PROGRESS", "Anki synchronization is in progress.")
            provider = self._active_session_provider
            if provider is not None:
                try:
                    if provider():
                        return _error(
                            "STUDY_SESSION_ACTIVE",
                            "Finish the active study session before synchronizing.",
                        )
                except Exception:
                    return _error(
                        "SESSION_STATE_UNAVAILABLE",
                        "The active study session state is unavailable.",
                    )
            self._sync_requested = True
            self._sync_request_id = request_id if isinstance(request_id, str) else None
            self._sync_requested_at = self._clock()
            self._sync_attempts += 1
            self._last_sync_state = "starting"
            self._sync_error = None

        def invoke_sync() -> None:
            try:
                self._sync_start()
            except Exception:
                with self._lock:
                    self._sync_requested = False
                    self._sync_request_id = None
                    self._sync_error = "Anki could not start synchronization."
                    self._last_sync_state = "error"
                    self._sync_finished_at = self._clock()
                    self._record_error_locked("SYNC_START_FAILED", self._sync_error)
                return

        try:
            self._run_on_main(invoke_sync)
        except Exception:
            with self._lock:
                self._sync_requested = False
                self._sync_request_id = None
                self._sync_error = "Anki could not schedule synchronization."
                self._last_sync_state = "error"
                self._sync_finished_at = self._clock()
                self._record_error_locked("SYNC_START_FAILED", self._sync_error)
            return _error("SYNC_UNAVAILABLE", "Anki could not start synchronization.")
        with self._lock:
            if self._sync_error and not self._syncing and not self._sync_requested:
                return _error("SYNC_UNAVAILABLE", self._sync_error)
        return {"result": {"state": "starting"}, "error": None}

    def _sync_status(self, request: dict[str, object]) -> dict[str, object]:
        if not self._authorized(request):
            return _error("UNAUTHORIZED", "The session token is invalid.")
        status = self.status()
        with self._lock:
            sync_error = self._sync_error
        return {
            "result": {"state": status["syncState"], "error": sync_error},
            "error": None,
        }

    def _dispatch(self, request: object) -> dict[str, object]:
        try:
            parsed = parse_request(request)
        except ProtocolValidationError as error:
            return _error("INVALID_REQUEST", str(error), retryable=False)
        action = parsed["action"]
        if action not in CAPABILITIES:
            return _error(
                "ACTION_NOT_SUPPORTED",
                f"Unsupported action: {action}",
                retryable=False,
            )
        if action in {"status", "requestPermission"}:
            if parsed["action"] == "status":
                return {"result": self.status(), "error": None}
            if self._permission_manager is None:
                return _error(
                    "PERMISSION_UNAVAILABLE",
                    "Anki permission confirmation is unavailable.",
                )
            return self._permission_manager.request_permission()

        if action == "sync.start":
            return self._start_sync(parsed)
        if action == "sync.status":
            return self._sync_status(parsed)

        with self._lock:
            bridge = self._bridge
            collection_available = self._collection_available
            syncing = self._syncing or self._sync_requested
        if syncing:
            return _error("SYNC_IN_PROGRESS", "Anki synchronization is in progress.")
        if bridge is None or not collection_available:
            return _error(
                "COLLECTION_UNAVAILABLE",
                "Anki does not have an available collection.",
            )
        return bridge.dispatch(request)

    def dispatch(self, request: object) -> dict[str, object]:
        with self._lock:
            now = self._clock()
            self._request_count += 1
            self._last_request_at = now
            if isinstance(request, dict) and request.get("action") == "status":
                self._last_heartbeat_at = now
        try:
            response = self._dispatch(request)
        except Exception:
            response = _error(
                "INTERNAL_ERROR",
                "The addon could not process the request.",
            )
        if response.get("error") is not None:
            with self._lock:
                self._failed_request_count += 1
                error = response.get("error")
                if isinstance(error, dict):
                    code = error.get("code")
                    message = error.get("message")
                    if isinstance(code, str) and isinstance(message, str):
                        self._record_error_locked(code, message)
        return response

    def status(self) -> dict[str, object]:
        with self._lock:
            self._expire_sync_request_locked(self._clock())
            profile_name = self._profile_name
            profile_key = self._profile_key
            bridge_open = self._bridge is not None
            collection_available = self._collection_available
            syncing = self._syncing
            sync_requested = self._sync_requested
            sync_error = self._sync_error
            service_state = self._service_state
            service_started_at = self._service_started_at
            last_request_at = self._last_request_at
            last_heartbeat_at = self._last_heartbeat_at
            request_count = self._request_count
            failed_request_count = self._failed_request_count
            last_error = dict(self._last_error) if self._last_error else None
            thread = self._thread
            sync_health = {
                "state": self._last_sync_state,
                "attempts": self._sync_attempts,
                "requestedAt": self._sync_requested_at,
                "startedAt": self._sync_started_at,
                "finishedAt": self._sync_finished_at,
                "error": sync_error,
            }
        thread_alive: bool | None = None
        if thread is not None:
            is_alive = getattr(thread, "is_alive", None)
            if callable(is_alive):
                try:
                    thread_alive = bool(is_alive())
                except Exception:
                    thread_alive = None
        if not bridge_open:
            collection_state = "closed"
        elif collection_available:
            collection_state = "open"
        else:
            collection_state = "temporarilyClosed"
        try:
            anki_version = self._anki_version_provider()
        except Exception:
            anki_version = ""
        return {
            "addonVersion": self._addon_version,
            "protocolVersion": 1,
            "ankiVersion": anki_version,
            "profileKey": profile_key,
            "profileName": profile_name,
            "collectionState": collection_state,
            "syncState": (
                "error"
                if sync_error
                else "syncing"
                if syncing or sync_requested
                else "idle"
            ),
            "capabilities": list(CAPABILITIES),
            "health": {
                "serviceState": service_state,
                "threadAlive": thread_alive,
                "startedAt": service_started_at,
                "lastRequestAt": last_request_at,
                "lastHeartbeatAt": last_heartbeat_at,
                "requestCount": request_count,
                "failedRequestCount": failed_request_count,
                "lastError": last_error,
                "sync": sync_health,
            },
        }
