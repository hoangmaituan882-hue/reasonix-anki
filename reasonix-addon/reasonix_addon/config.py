"""Global, profile-independent settings for the Reasonix Anki addon."""

from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from typing import Any, Literal


AuthorizationMode = Literal["prompt_once", "prompt_each_start", "deny"]
DEFAULT_AUTHORIZATION_MODE: AuthorizationMode = "prompt_once"
VALID_AUTHORIZATION_MODES = frozenset(
    {"prompt_once", "prompt_each_start", "deny"}
)


def normalize_config(value: object) -> dict[str, Any]:
    """Return a safe config while preserving unrelated future settings."""

    raw: dict[str, Any] = deepcopy(dict(value)) if isinstance(value, Mapping) else {}
    authorization = raw.get("authorization")
    authorization = dict(authorization) if isinstance(authorization, Mapping) else {}
    mode = authorization.get("mode")
    if mode not in VALID_AUTHORIZATION_MODES:
        mode = DEFAULT_AUTHORIZATION_MODE
    granted = authorization.get("granted") is True and mode == "prompt_once"
    raw["authorization"] = {"mode": mode, "granted": granted}
    return raw


def authorization_settings(value: object) -> tuple[AuthorizationMode, bool]:
    normalized = normalize_config(value)["authorization"]
    return normalized["mode"], normalized["granted"]


def update_authorization(
    value: object,
    *,
    mode: AuthorizationMode,
    granted: bool,
) -> dict[str, Any]:
    if mode not in VALID_AUTHORIZATION_MODES:
        raise ValueError("authorization mode is invalid")
    normalized = normalize_config(value)
    normalized["authorization"] = {
        "mode": mode,
        "granted": bool(granted and mode == "prompt_once"),
    }
    return normalized
