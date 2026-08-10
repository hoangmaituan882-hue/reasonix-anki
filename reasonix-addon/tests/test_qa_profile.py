import json
import unittest
from io import BytesIO
from urllib.request import Request

from reasonix_addon.qa_preflight import verify_active_profile
from reasonix_addon.qa_profile import (
    QA_PROFILE_NAME,
    UnsafeProfileError,
    require_qa_profile,
)


class FakeResponse(BytesIO):
    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()


def opener_with_profile(profile_name: str):
    def open_request(request: Request, *, timeout: float) -> FakeResponse:
        payload = json.loads(request.data or b"{}")
        if payload != {"action": "getActiveProfile", "version": 6}:
            raise AssertionError(f"unexpected read request: {payload!r}")
        if timeout <= 0:
            raise AssertionError("timeout must be positive")
        return FakeResponse(
            json.dumps({"result": profile_name, "error": None}).encode("utf-8")
        )

    return open_request


class QaProfileGuardTests(unittest.TestCase):
    def test_accepts_only_the_dedicated_profile(self) -> None:
        self.assertEqual(require_qa_profile(QA_PROFILE_NAME), QA_PROFILE_NAME)

    def test_rejects_real_or_ambiguous_profiles(self) -> None:
        for profile_name in ("账户 1", "233", "", "Reasonix QA Copy", " reasonix qa "):
            with self.subTest(profile_name=profile_name):
                with self.assertRaises(UnsafeProfileError):
                    require_qa_profile(profile_name)

    def test_http_preflight_accepts_the_qa_profile(self) -> None:
        self.assertEqual(
            verify_active_profile(opener=opener_with_profile(QA_PROFILE_NAME)),
            QA_PROFILE_NAME,
        )

    def test_http_preflight_fails_closed_on_a_real_profile(self) -> None:
        with self.assertRaises(UnsafeProfileError):
            verify_active_profile(opener=opener_with_profile("账户 1"))


if __name__ == "__main__":
    unittest.main()
