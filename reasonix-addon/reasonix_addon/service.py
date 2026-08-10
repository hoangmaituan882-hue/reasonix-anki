"""Protocol-v1 request dispatcher for the scheduler session core."""

from __future__ import annotations

from collections.abc import Callable
from hmac import compare_digest
from typing import Any

from .protocol import ProtocolValidationError, parse_request
from .session import SessionError, SessionManager


def _success(result: dict[str, object]) -> dict[str, object]:
    return {"result": result, "error": None}


def _error(
    code: str,
    message: str,
    *,
    retryable: bool = False,
    details: dict[str, object] | None = None,
) -> dict[str, object]:
    error: dict[str, object] = {
        "code": code,
        "message": message,
        "retryable": retryable,
    }
    if details:
        error["details"] = details
    return {"result": None, "error": error}


class AddonService:
    def __init__(
        self,
        manager: SessionManager,
        *,
        token: str | None = None,
        token_provider: Callable[[], str] | None = None,
        profile_key_provider: Callable[[], str],
    ) -> None:
        self.manager = manager
        if token_provider is None:
            if not isinstance(token, str) or not token:
                raise ValueError("token or token_provider is required")
            token_provider = lambda token=token: token
        self._token_provider = token_provider
        self.profile_key_provider = profile_key_provider

    def take_collection_changes(self) -> object | None:
        """Hand the latest native OpChanges to the surrounding CollectionOp."""

        return self.manager.take_operation_changes()

    def handle(self, value: object) -> dict[str, object]:
        try:
            request = parse_request(value)
        except ProtocolValidationError as error:
            return _error("INVALID_REQUEST", str(error))

        action = request["action"]
        supplied_token = request.get("token")
        if action.startswith("session.") and (
            not isinstance(supplied_token, str)
            or not compare_digest(supplied_token, self._token_provider())
        ):
            return _error("UNAUTHORIZED", "The session token is invalid.")

        try:
            profile_key = self.profile_key_provider()
            params: dict[str, Any] = request["params"]
            request_id: str = request["requestId"]
            if action == "session.start":
                result = self.manager.start(
                    deck_id=params["deckId"], profile_key=profile_key
                )
                result["profileKey"] = profile_key
            elif action == "session.next":
                result = self.manager.next(
                    session_id=params["sessionId"], profile_key=profile_key
                )
            elif action == "session.reveal":
                result = self.manager.reveal(
                    session_id=params["sessionId"],
                    expected_card_id=params["expectedCardId"],
                    profile_key=profile_key,
                )
            elif action == "session.answer":
                result = self.manager.answer(
                    session_id=params["sessionId"],
                    expected_card_id=params["expectedCardId"],
                    ease=params["ease"],
                    request_id=request_id,
                    profile_key=profile_key,
                )
            elif action == "session.undo":
                result = self.manager.undo(
                    session_id=params["sessionId"],
                    request_id=request_id,
                    profile_key=profile_key,
                )
            elif action == "session.finish":
                result = self.manager.finish(
                    session_id=params["sessionId"], profile_key=profile_key
                )
            else:
                return _error(
                    "ACTION_NOT_SUPPORTED", f"Unsupported action: {action}"
                )
        except SessionError as error:
            return _error(
                error.code,
                str(error),
                retryable=error.retryable,
                details=error.details,
            )
        except Exception:
            return _error(
                "ANKI_OPERATION_FAILED",
                "Anki could not complete the operation.",
                retryable=True,
            )

        return _success(result)
