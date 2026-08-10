"""Fail-closed guard for integration tests that mutate Anki scheduling."""

QA_PROFILE_NAME = "Reasonix QA"


class UnsafeProfileError(RuntimeError):
    """Raised before a scheduling test can touch a non-QA profile."""


def require_qa_profile(active_profile: object) -> str:
    if active_profile != QA_PROFILE_NAME:
        raise UnsafeProfileError(
            "Scheduling tests require the exact active Anki profile "
            f"{QA_PROFILE_NAME!r}; got {active_profile!r}."
        )
    return QA_PROFILE_NAME
