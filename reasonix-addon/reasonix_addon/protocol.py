"""Small protocol-v1 validators shared by the addon boundary."""

from __future__ import annotations

from typing import Any
from uuid import UUID


class ProtocolValidationError(ValueError):
    """Raised when an untrusted protocol payload is invalid."""


def _is_positive_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _is_non_negative_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _is_ease(value: object) -> bool:
    """ease 必须是 int 且非 bool（排除 True==1 / 1.0 混过集合成员测试）"""
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and value in {1, 2, 3, 4}
    )


def _is_non_negative_number(value: object) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and value >= 0
    )


def _require_non_empty_string(value: object, field: str) -> None:
    if not isinstance(value, str) or not value:
        raise ProtocolValidationError(f"{field} must be a non-empty string")


def _require_exact_params(
    params: dict[str, Any], expected: set[str], action: str
) -> None:
    if set(params) != expected:
        fields = ", ".join(sorted(expected))
        raise ProtocolValidationError(f"{action} params must contain only {fields}")


def parse_request(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProtocolValidationError("request must be an object")
    if value.get("version") != 1:
        raise ProtocolValidationError("unsupported protocol version")

    action = value.get("action")
    _require_non_empty_string(action, "action")

    request_id = value.get("requestId")
    _require_non_empty_string(request_id, "requestId")
    try:
        UUID(request_id)
    except (ValueError, TypeError, AttributeError) as error:
        raise ProtocolValidationError("requestId must be a UUID") from error

    token = value.get("token")
    if token is not None:
        _require_non_empty_string(token, "token")
    if action.startswith(("session.", "sync.")):
        _require_non_empty_string(token, "token")

    params = value.get("params")
    if not isinstance(params, dict):
        raise ProtocolValidationError("params must be an object")

    if action == "session.start":
        if not _is_positive_int(params.get("deckId")):
            raise ProtocolValidationError("deckId must be a positive integer")
        _require_exact_params(params, {"deckId"}, action)
    elif action == "decks.today":
        if not _is_positive_int(params.get("deckId")):
            raise ProtocolValidationError("deckId must be a positive integer")
        _require_exact_params(params, {"deckId"}, action)
    elif action in {"status", "requestPermission", "sync.start", "sync.status"}:
        _require_exact_params(params, set(), action)
    elif action in {"session.next", "session.undo", "session.finish"}:
        _require_non_empty_string(params.get("sessionId"), "sessionId")
        _require_exact_params(params, {"sessionId"}, action)
    elif action == "session.reveal":
        _require_non_empty_string(params.get("sessionId"), "sessionId")
        if not _is_positive_int(params.get("expectedCardId")):
            raise ProtocolValidationError(
                "expectedCardId must be a positive integer"
            )
        _require_exact_params(params, {"sessionId", "expectedCardId"}, action)
    elif action == "session.answer":
        _require_non_empty_string(params.get("sessionId"), "sessionId")
        if not _is_positive_int(params.get("expectedCardId")):
            raise ProtocolValidationError(
                "expectedCardId must be a positive integer"
            )
        if not _is_ease(params.get("ease")):
            raise ProtocolValidationError("ease must be an integer from 1 to 4")
        _require_exact_params(
            params, {"sessionId", "expectedCardId", "ease"}, action
        )

    return value


def parse_error_response(value: object) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("result") is not None:
        raise ProtocolValidationError("error response result must be null")

    error = value.get("error")
    if not isinstance(error, dict):
        raise ProtocolValidationError("error must be an object")
    _require_non_empty_string(error.get("code"), "error.code")
    _require_non_empty_string(error.get("message"), "error.message")
    if not isinstance(error.get("retryable"), bool):
        raise ProtocolValidationError("error.retryable must be a boolean")
    details = error.get("details")
    if details is not None and not isinstance(details, dict):
        raise ProtocolValidationError("error.details must be an object")

    return value


def _parse_success_result(value: object) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("error") is not None:
        raise ProtocolValidationError("success response error must be null")
    result = value.get("result")
    if not isinstance(result, dict):
        raise ProtocolValidationError("result must be an object")
    return result


def parse_session_next_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    _require_non_empty_string(result.get("sessionId"), "result.sessionId")

    card = result.get("card")
    if not isinstance(card, dict):
        raise ProtocolValidationError("result.card must be an object")
    for field in ("cardId", "noteId", "deckId", "modelId"):
        if not _is_positive_int(card.get(field)):
            raise ProtocolValidationError(f"result.card.{field} is invalid")
    if card.get("cardKind") not in {
        "vocabulary",
        "word_sentence",
        "click",
        "sentence",
        "audio",
        "unknown",
    }:
        raise ProtocolValidationError("result.card.cardKind is invalid")
    if not isinstance(card.get("fields"), dict):
        raise ProtocolValidationError("result.card.fields must be an object")

    remaining = result.get("remaining")
    if not isinstance(remaining, dict):
        raise ProtocolValidationError("result.remaining must be an object")
    for field in ("new", "learning", "review"):
        if not _is_non_negative_int(remaining.get(field)):
            raise ProtocolValidationError(f"result.remaining.{field} is invalid")
    return value


def parse_session_reveal_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    if not _is_positive_int(result.get("cardId")):
        raise ProtocolValidationError("result.cardId is invalid")

    intervals = result.get("intervals")
    if not isinstance(intervals, dict):
        raise ProtocolValidationError("result.intervals must be an object")
    for ease in ("1", "2", "3", "4"):
        interval = intervals.get(ease)
        if not isinstance(interval, dict):
            raise ProtocolValidationError(f"result.intervals.{ease} is invalid")
        _require_non_empty_string(
            interval.get("label"), f"result.intervals.{ease}.label"
        )
        seconds = interval.get("seconds")
        if seconds is not None and not _is_non_negative_int(seconds):
            raise ProtocolValidationError(
                f"result.intervals.{ease}.seconds is invalid"
            )
    return value


def parse_session_start_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    _require_non_empty_string(result.get("sessionId"), "result.sessionId")
    _require_non_empty_string(result.get("profileKey"), "result.profileKey")
    return value


def parse_session_answer_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    if not _is_positive_int(result.get("answeredCardId")):
        raise ProtocolValidationError("result.answeredCardId is invalid")
    if not _is_ease(result.get("ease")):
        raise ProtocolValidationError("result.ease is invalid")
    return value


def parse_session_undo_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    if not _is_positive_int(result.get("restoredCardId")):
        raise ProtocolValidationError("result.restoredCardId is invalid")
    card = result.get("card")
    if not isinstance(card, dict) or not _is_positive_int(card.get("cardId")):
        raise ProtocolValidationError("result.card is invalid")
    remaining = result.get("remaining")
    if not isinstance(remaining, dict):
        raise ProtocolValidationError("result.remaining must be an object")
    for field in ("new", "learning", "review"):
        if not _is_non_negative_int(remaining.get(field)):
            raise ProtocolValidationError(f"result.remaining.{field} is invalid")
    return value


def parse_session_finish_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    _require_non_empty_string(result.get("sessionId"), "result.sessionId")
    if not _is_non_negative_int(result.get("answeredCards")):
        raise ProtocolValidationError("result.answeredCards is invalid")
    return value


def parse_decks_today_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    if not _is_positive_int(result.get("deckId")):
        raise ProtocolValidationError("result.deckId is invalid")
    for field in ("new", "learning", "review", "tomorrowDue"):
        if not _is_non_negative_int(result.get(field)):
            raise ProtocolValidationError(f"result.{field} is invalid")
    return value


def parse_sync_start_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    if result.get("state") not in {"starting", "syncing", "idle"}:
        raise ProtocolValidationError("result.state is invalid")
    return value


def parse_sync_status_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    if result.get("state") not in {"idle", "syncing", "error"}:
        raise ProtocolValidationError("result.state is invalid")
    error = result.get("error")
    if error is not None and not isinstance(error, str):
        raise ProtocolValidationError("result.error is invalid")
    return value


def parse_status_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    _require_non_empty_string(result.get("addonVersion"), "result.addonVersion")
    if result.get("protocolVersion") != 1:
        raise ProtocolValidationError("result.protocolVersion is invalid")
    anki_version = result.get("ankiVersion")
    if not isinstance(anki_version, str):
        raise ProtocolValidationError("result.ankiVersion is invalid")
    for field in ("profileKey", "profileName"):
        profile_value = result.get(field)
        if profile_value is not None and not isinstance(profile_value, str):
            raise ProtocolValidationError(f"result.{field} is invalid")
    if result.get("collectionState") not in {"open", "closed", "temporarilyClosed"}:
        raise ProtocolValidationError("result.collectionState is invalid")
    if result.get("syncState") not in {"idle", "syncing", "error"}:
        raise ProtocolValidationError("result.syncState is invalid")
    capabilities = result.get("capabilities")
    if not isinstance(capabilities, list) or not all(
        isinstance(capability, str) and capability for capability in capabilities
    ):
        raise ProtocolValidationError("result.capabilities is invalid")
    capability_versions = result.get("capabilityVersions")
    if capability_versions is not None:
        if not isinstance(capability_versions, dict) or not all(
            isinstance(name, str) and isinstance(version, str) and name and version
            for name, version in capability_versions.items()
        ):
            raise ProtocolValidationError("result.capabilityVersions is invalid")
    health = result.get("health")
    if health is not None:
        if not isinstance(health, dict):
            raise ProtocolValidationError("result.health is invalid")
        if health.get("serviceState") not in {
            "stopped",
            "starting",
            "listening",
            "error",
        }:
            raise ProtocolValidationError("result.health.serviceState is invalid")
        if health.get("threadAlive") is not None and not isinstance(
            health.get("threadAlive"), bool
        ):
            raise ProtocolValidationError("result.health.threadAlive is invalid")
        for field in (
            "startedAt",
            "lastRequestAt",
            "lastHeartbeatAt",
        ):
            if health.get(field) is not None and not _is_non_negative_number(
                health.get(field)
            ):
                raise ProtocolValidationError(f"result.health.{field} is invalid")
        for field in ("requestCount", "failedRequestCount"):
            if not _is_non_negative_int(health.get(field)):
                raise ProtocolValidationError(f"result.health.{field} is invalid")
        last_error = health.get("lastError")
        if last_error is not None:
            if not isinstance(last_error, dict):
                raise ProtocolValidationError("result.health.lastError is invalid")
            _require_non_empty_string(last_error.get("code"), "health.lastError.code")
            _require_non_empty_string(
                last_error.get("message"), "health.lastError.message"
            )
            if not _is_non_negative_number(last_error.get("at")):
                raise ProtocolValidationError("health.lastError.at is invalid")
        sync = health.get("sync")
        if not isinstance(sync, dict):
            raise ProtocolValidationError("result.health.sync is invalid")
        if sync.get("state") not in {
            "idle",
            "starting",
            "syncing",
            "finished",
            "error",
        }:
            raise ProtocolValidationError("result.health.sync.state is invalid")
        if not _is_non_negative_int(sync.get("attempts")):
            raise ProtocolValidationError("result.health.sync.attempts is invalid")
        for field in ("requestedAt", "startedAt", "finishedAt"):
            if sync.get(field) is not None and not _is_non_negative_number(
                sync.get(field)
            ):
                raise ProtocolValidationError(f"result.health.sync.{field} is invalid")
        if sync.get("error") is not None and not isinstance(sync.get("error"), str):
            raise ProtocolValidationError("result.health.sync.error is invalid")
    return value


def parse_permission_response(value: object) -> dict[str, Any]:
    result = _parse_success_result(value)
    permission = result.get("permission")
    if permission not in {"granted", "denied"}:
        raise ProtocolValidationError("result.permission is invalid")
    token = result.get("token")
    if permission == "granted":
        _require_non_empty_string(token, "result.token")
    elif token is not None:
        raise ProtocolValidationError("result.token must be omitted when denied")
    return value
