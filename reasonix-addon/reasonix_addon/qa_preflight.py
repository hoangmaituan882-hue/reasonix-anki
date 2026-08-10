"""Read-only AnkiConnect preflight used before any scheduling integration test."""

from __future__ import annotations

import json
import sys
from collections.abc import Callable
from typing import Any
from urllib.request import Request, urlopen

from .qa_profile import QA_PROFILE_NAME, UnsafeProfileError, require_qa_profile


ANKI_CONNECT_URL = "http://127.0.0.1:8765"


def verify_active_profile(
    endpoint: str = ANKI_CONNECT_URL,
    *,
    timeout: float = 3.0,
    opener: Callable[..., Any] = urlopen,
) -> str:
    request = Request(
        endpoint,
        data=json.dumps(
            {"action": "getActiveProfile", "version": 6},
            separators=(",", ":"),
        ).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with opener(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if not isinstance(payload, dict) or payload.get("error") is not None:
        raise UnsafeProfileError(
            f"Could not prove that the active Anki profile is {QA_PROFILE_NAME!r}."
        )
    return require_qa_profile(payload.get("result"))


def main() -> int:
    try:
        profile = verify_active_profile()
    except Exception as error:
        print(f"QA preflight refused to run: {error}", file=sys.stderr)
        return 2
    print(f"QA preflight passed: active profile is {profile!r}.")
    return 0
