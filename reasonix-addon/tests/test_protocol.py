import json
import unittest
from pathlib import Path

from reasonix_addon.protocol import (
    ProtocolValidationError,
    parse_error_response,
    parse_request,
    parse_session_next_response,
    parse_session_reveal_response,
    parse_session_start_response,
    parse_session_answer_response,
    parse_session_undo_response,
    parse_session_finish_response,
    parse_sync_start_response,
    parse_sync_status_response,
    parse_status_response,
    parse_permission_response,
)


FIXTURES = Path(__file__).parents[2] / "protocol" / "fixtures" / "v1"
LAPIS_SAMPLE = Path(__file__).parents[1] / "fixtures" / "lapis-qa-sample.json"


def fixture(name: str) -> object:
    with (FIXTURES / name).open(encoding="utf-8") as source:
        return json.load(source)


class ProtocolFixtureTests(unittest.TestCase):
    def test_python_accepts_the_shared_session_start_fixture(self) -> None:
        request = parse_request(fixture("session-start.request.json"))

        self.assertEqual(request["action"], "session.start")
        self.assertEqual(request["params"], {"deckId": 1781523613318})

        request["params"]["mode"] = "mixed"
        with self.assertRaises(ProtocolValidationError):
            parse_request(request)

    def test_python_requires_expected_card_id_for_answer(self) -> None:
        request = parse_request(fixture("session-answer.request.json"))
        self.assertEqual(request["params"]["expectedCardId"], 1782031602405)

        del request["params"]["expectedCardId"]
        with self.assertRaises(ProtocolValidationError):
            parse_request(request)

    def test_python_accepts_exact_next_reveal_undo_and_finish_requests(self) -> None:
        next_request = parse_request(fixture("session-next.request.json"))
        reveal_request = parse_request(fixture("session-reveal.request.json"))
        undo_request = parse_request(fixture("session-undo.request.json"))
        finish_request = parse_request(fixture("session-finish.request.json"))

        self.assertEqual(next_request["params"], {"sessionId": "study-session-1"})
        self.assertEqual(reveal_request["params"]["expectedCardId"], 1782031602405)
        self.assertEqual(undo_request["action"], "session.undo")
        self.assertEqual(finish_request["action"], "session.finish")

        for request in (next_request, reveal_request, undo_request, finish_request):
            request["params"]["unexpected"] = True
            with self.assertRaises(ProtocolValidationError):
                parse_request(request)

    def test_python_accepts_status_and_permission_fixtures(self) -> None:
        status = parse_request(fixture("status.request.json"))
        permission = parse_request(fixture("request-permission.request.json"))

        self.assertEqual(status["params"], {})
        self.assertEqual(permission["action"], "requestPermission")

        status_response = parse_status_response(fixture("status.response.json"))
        permission_response = parse_permission_response(
            fixture("request-permission.response.json")
        )
        self.assertEqual(status_response["result"]["collectionState"], "open")
        self.assertEqual(permission_response["result"]["permission"], "granted")

        for request in (status, permission):
            request["params"]["unexpected"] = True
            with self.assertRaises(ProtocolValidationError):
                parse_request(request)

    def test_python_accepts_additive_runtime_health_status(self) -> None:
        status_response = fixture("status.response.json")
        status_response["result"]["health"] = {
            "serviceState": "listening",
            "threadAlive": True,
            "startedAt": 1.0,
            "lastRequestAt": 2.0,
            "lastHeartbeatAt": 2.0,
            "requestCount": 3,
            "failedRequestCount": 0,
            "lastError": None,
            "sync": {
                "state": "finished",
                "attempts": 1,
                "requestedAt": 3.0,
                "startedAt": 4.0,
                "finishedAt": 5.0,
                "error": None,
            },
        }

        parsed = parse_status_response(status_response)

        self.assertEqual(parsed["result"]["health"]["sync"]["state"], "finished")

    def test_python_requires_a_token_for_every_session_request(self) -> None:
        for fixture_name in (
            "session-start.request.json",
            "session-next.request.json",
            "session-reveal.request.json",
            "session-answer.request.json",
            "session-undo.request.json",
            "session-finish.request.json",
        ):
            request = fixture(fixture_name)
            del request["token"]
            with self.subTest(fixture_name=fixture_name):
                with self.assertRaises(ProtocolValidationError):
                    parse_request(request)

    def test_python_accepts_the_shared_error_fixture(self) -> None:
        response = parse_error_response(fixture("error.response.json"))

        self.assertEqual(response["error"]["code"], "CARD_MISMATCH")
        self.assertFalse(response["error"]["retryable"])

    def test_python_accepts_the_shared_next_and_reveal_fixtures(self) -> None:
        next_response = parse_session_next_response(
            fixture("session-next.response.json")
        )
        reveal_response = parse_session_reveal_response(
            fixture("session-reveal.response.json")
        )

        self.assertEqual(next_response["result"]["card"]["fields"]["Expression"], "人間")
        self.assertEqual(reveal_response["result"]["intervals"]["3"]["label"], "4 天")

    def test_python_accepts_all_session_success_response_fixtures(self) -> None:
        start = parse_session_start_response(fixture("session-start.response.json"))
        answer = parse_session_answer_response(fixture("session-answer.response.json"))
        undo = parse_session_undo_response(fixture("session-undo.response.json"))
        finish = parse_session_finish_response(fixture("session-finish.response.json"))

        self.assertEqual(start["result"]["sessionId"], "study-session-1")
        self.assertEqual(answer["result"]["ease"], 3)
        self.assertEqual(undo["result"]["restoredCardId"], 1782031602405)
        self.assertEqual(finish["result"]["answeredCards"], 12)

    def test_python_accepts_sync_start_and_status_fixtures(self) -> None:
        start = parse_request(fixture("sync-start.request.json"))
        status = parse_request(fixture("sync-status.request.json"))
        start_response = parse_sync_start_response(
            fixture("sync-start.response.json")
        )
        status_response = parse_sync_status_response(
            fixture("sync-status.response.json")
        )

        self.assertEqual(start["action"], "sync.start")
        self.assertEqual(status["action"], "sync.status")
        self.assertEqual(start_response["result"]["state"], "starting")
        self.assertEqual(status_response["result"]["state"], "syncing")

    def test_lapis_sample_covers_all_preserved_card_kinds(self) -> None:
        with LAPIS_SAMPLE.open(encoding="utf-8") as source:
            sample = json.load(source)

        self.assertEqual(sample["profileName"], "Reasonix QA")
        self.assertEqual(
            {card["cardKind"] for card in sample["notes"][0]["cards"]},
            {"vocabulary", "word_sentence", "click", "sentence", "audio"},
        )
        self.assertIn("Expression", sample["fields"])
        self.assertIn("MainDefinition", sample["fields"])


if __name__ == "__main__":
    unittest.main()
