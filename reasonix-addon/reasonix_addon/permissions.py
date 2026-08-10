"""Anki-side user confirmation and ephemeral session-token issuance."""

from __future__ import annotations

from collections.abc import Callable
from secrets import token_urlsafe
from threading import Event, RLock
from typing import Literal


AuthorizationMode = Literal["prompt_once", "prompt_each_start", "deny"]
VALID_AUTHORIZATION_MODES = frozenset(
    {"prompt_once", "prompt_each_start", "deny"}
)


def _error(code: str, message: str) -> dict[str, object]:
    return {
        "result": None,
        "error": {
            "code": code,
            "message": message,
            "retryable": True,
        },
    }


class PermissionManager:
    """Prompt in Anki's UI and return a token only after explicit approval."""

    def __init__(
        self,
        *,
        confirm: Callable[[], bool],
        run_on_main: Callable[[Callable[[], None]], object],
        token_factory: Callable[[], str] = lambda: token_urlsafe(32),
        timeout: float = 120.0,
        authorization_mode: AuthorizationMode = "prompt_once",
        remembered_grant: bool = False,
        on_state_change: Callable[["PermissionManager"], None] | None = None,
    ) -> None:
        if timeout <= 0:
            raise ValueError("timeout must be greater than zero")
        if authorization_mode not in VALID_AUTHORIZATION_MODES:
            raise ValueError("authorization_mode is invalid")
        token = token_factory()
        if not isinstance(token, str) or not token:
            raise ValueError("token_factory must return a non-empty string")
        self.confirm = confirm
        self.run_on_main = run_on_main
        self.token = token
        self.timeout = timeout
        self.authorization_mode = authorization_mode
        self._granted = bool(remembered_grant and authorization_mode == "prompt_once")
        self._token_factory = token_factory
        self._on_state_change = on_state_change
        self._request_lock = RLock()

    @property
    def granted(self) -> bool:
        with self._request_lock:
            return self._granted

    def settings(self) -> dict[str, object]:
        with self._request_lock:
            return {
                "authorizationMode": self.authorization_mode,
                "granted": self._granted,
            }

    def set_authorization_mode(self, mode: AuthorizationMode) -> None:
        if mode not in VALID_AUTHORIZATION_MODES:
            raise ValueError("authorization_mode is invalid")
        with self._request_lock:
            self.authorization_mode = mode
            if mode == "deny":
                self._granted = False
                self._rotate_token_locked()
        self._notify_state_change()

    def revoke(self) -> None:
        with self._request_lock:
            self._granted = False
            self._rotate_token_locked()
        self._notify_state_change()

    def _rotate_token_locked(self) -> None:
        token = self._token_factory()
        if not isinstance(token, str) or not token:
            raise ValueError("token_factory must return a non-empty string")
        self.token = token

    def _notify_state_change(self) -> None:
        if self._on_state_change is not None:
            self._on_state_change(self)

    def _granted_response(self) -> dict[str, object]:
        return {
            "result": {"permission": "granted", "token": self.token},
            "error": None,
        }

    def request_permission(self) -> dict[str, object]:
        with self._request_lock:
            if self.authorization_mode == "deny":
                return {"result": {"permission": "denied"}, "error": None}
            if self._granted:
                return self._granted_response()

        completed = Event()
        expired = Event()
        state: dict[str, object] = {}

        def confirm_on_main() -> None:
            # Qt cannot cancel a callback already queued on the main thread.
            # Ignore it after the worker-side wait expired so a late callback
            # cannot open a modal or mutate the permission decision.
            if expired.is_set():
                completed.set()
                return
            try:
                state["approved"] = bool(self.confirm())
            except Exception:
                state["failed"] = True
            finally:
                completed.set()

        with self._request_lock:
            # A concurrent request may have completed while this request was
            # waiting to acquire the lock. Reuse that decision instead of
            # opening a second modal dialog.
            if self.authorization_mode == "deny":
                return {"result": {"permission": "denied"}, "error": None}
            if self._granted:
                return self._granted_response()
            try:
                self.run_on_main(confirm_on_main)
            except Exception:
                return _error(
                    "PERMISSION_FAILED",
                    "Anki could not show the permission confirmation.",
                )
            if not completed.wait(self.timeout):
                expired.set()
                return _error(
                    "PERMISSION_TIMEOUT",
                    "The Anki permission confirmation timed out.",
                )
            if state.get("failed"):
                return _error(
                    "PERMISSION_FAILED",
                    "Anki could not complete the permission confirmation.",
                )
            if state.get("approved"):
                self._granted = True
                self._notify_state_change()
                return self._granted_response()
            return {"result": {"permission": "denied"}, "error": None}
