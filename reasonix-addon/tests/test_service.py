import importlib
import unittest

from reasonix_addon.session import SessionManager
from tests.test_session import FakeSchedulerBackend, scheduler_item


def load_service_module():
    try:
        return importlib.import_module("reasonix_addon.service")
    except ModuleNotFoundError as error:
        raise AssertionError("protocol service is not implemented") from error


def request(
    action: str,
    request_id: str,
    params: dict[str, object],
    *,
    token: str = "qa-session-token",
) -> dict[str, object]:
    return {
        "version": 1,
        "action": action,
        "requestId": request_id,
        "token": token,
        "params": params,
    }


class AddonServiceTests(unittest.TestCase):
    def make_service(self):
        service_module = load_service_module()
        backend = FakeSchedulerBackend(
            [
                scheduler_item(101, new=2, learning=1, review=4),
                scheduler_item(202, new=2, learning=1, review=3),
            ]
        )
        manager = SessionManager(
            backend, session_id_factory=lambda: "study-session-1"
        )
        service = service_module.AddonService(
            manager,
            token="qa-session-token",
            profile_key_provider=lambda: "profile-qa",
        )
        return backend, service

    def test_dispatches_start_next_reveal_answer_and_undo(self) -> None:
        backend, service = self.make_service()

        started = service.handle(
            request(
                "session.start",
                "b76c912a-953b-4eb2-bfc4-8b9d76fa2012",
                {"deckId": 42},
            )
        )
        next_card = service.handle(
            request(
                "session.next",
                "905aa70c-32af-4e71-b236-8897c36a1d9d",
                {"sessionId": "study-session-1"},
            )
        )
        revealed = service.handle(
            request(
                "session.reveal",
                "a2938a48-446b-43a3-bf00-763f03a4af1e",
                {"sessionId": "study-session-1", "expectedCardId": 101},
            )
        )
        answer_request = request(
            "session.answer",
            "881b99e4-ef1e-4b1b-a267-1fc59af6a59c",
            {"sessionId": "study-session-1", "expectedCardId": 101, "ease": 3},
        )
        answered = service.handle(answer_request)
        duplicate = service.handle(answer_request)
        service.handle(
            request(
                "session.next",
                "da96ac48-cf63-4bb3-a220-4ecbe67d23cd",
                {"sessionId": "study-session-1"},
            )
        )
        undone = service.handle(
            request(
                "session.undo",
                "0df8097b-ab75-4e44-b1a4-8e2edc532686",
                {"sessionId": "study-session-1"},
            )
        )
        finished = service.handle(
            request(
                "session.finish",
                "880756a9-138e-4d58-a0be-50305e136bf1",
                {"sessionId": "study-session-1"},
            )
        )

        self.assertEqual(
            started,
            {
                "result": {
                    "sessionId": "study-session-1",
                    "profileKey": "profile-qa",
                },
                "error": None,
            },
        )
        self.assertEqual(next_card["result"]["card"]["cardId"], 101)
        self.assertEqual(revealed["result"]["intervals"]["3"]["label"], "4 天")
        self.assertEqual(answered, duplicate)
        self.assertEqual(backend.answer_calls, [(101, 3)])
        self.assertEqual(undone["result"]["restoredCardId"], 101)
        self.assertEqual(finished["result"]["answeredCards"], 0)

    def test_returns_a_structured_card_mismatch_error(self) -> None:
        backend, service = self.make_service()
        service.handle(
            request(
                "session.start",
                "b76c912a-953b-4eb2-bfc4-8b9d76fa2012",
                {"deckId": 42},
            )
        )

        response = service.handle(
            request(
                "session.answer",
                "881b99e4-ef1e-4b1b-a267-1fc59af6a59c",
                {"sessionId": "study-session-1", "expectedCardId": 999, "ease": 3},
            )
        )

        self.assertIsNone(response["result"])
        self.assertEqual(response["error"]["code"], "CARD_MISMATCH")
        self.assertEqual(response["error"]["details"]["activeCardId"], 101)
        self.assertEqual(backend.answer_calls, [])

    def test_rejects_an_invalid_token_before_touching_the_session(self) -> None:
        backend, service = self.make_service()

        response = service.handle(
            request(
                "session.start",
                "b76c912a-953b-4eb2-bfc4-8b9d76fa2012",
                {"deckId": 42},
                token="wrong-token",
            )
        )

        self.assertEqual(response["error"]["code"], "UNAUTHORIZED")
        self.assertEqual(backend.started_decks, [])

    def test_exposes_native_changes_to_the_operation_bridge_once(self) -> None:
        backend, service = self.make_service()
        service.handle(
            request(
                "session.start",
                "b76c912a-953b-4eb2-bfc4-8b9d76fa2012",
                {"deckId": 42},
            )
        )
        service.handle(
            request(
                "session.answer",
                "881b99e4-ef1e-4b1b-a267-1fc59af6a59c",
                {"sessionId": "study-session-1", "expectedCardId": 101, "ease": 3},
            )
        )

        self.assertIs(service.take_collection_changes(), backend.answer_changes)
        self.assertIsNone(service.take_collection_changes())

    def test_unexpected_anki_errors_do_not_leak_internal_details(self) -> None:
        _, service = self.make_service()
        service.manager.start = lambda **kwargs: (_ for _ in ()).throw(
            RuntimeError(r"database busy at C:\Users\private\collection.anki2")
        )

        response = service.handle(
            request(
                "session.start",
                "b76c912a-953b-4eb2-bfc4-8b9d76fa2012",
                {"deckId": 42},
            )
        )

        self.assertEqual(response["error"]["code"], "ANKI_OPERATION_FAILED")
        self.assertTrue(response["error"]["retryable"])
        self.assertNotIn("collection.anki2", response["error"]["message"])
        self.assertNotIn("database busy", response["error"]["message"])

    def test_dynamic_token_provider_invalidates_a_revoked_token(self) -> None:
        service_module = load_service_module()
        backend = FakeSchedulerBackend([])
        active_token = ["token-before-revoke"]
        service = service_module.AddonService(
            SessionManager(backend),
            token_provider=lambda: active_token[0],
            profile_key_provider=lambda: "profile-qa",
        )

        active_token[0] = "token-after-revoke"
        rejected = service.handle(
            request(
                "session.start",
                "b76c912a-953b-4eb2-bfc4-8b9d76fa2012",
                {"deckId": 42},
                token="token-before-revoke",
            )
        )
        accepted = service.handle(
            request(
                "session.start",
                "c76c912a-953b-4eb2-bfc4-8b9d76fa2012",
                {"deckId": 42},
                token="token-after-revoke",
            )
        )

        self.assertEqual(rejected["error"]["code"], "UNAUTHORIZED")
        self.assertIsNone(accepted["error"])

    def test_dispatches_decks_today_to_the_backend(self) -> None:
        backend, service = self.make_service()

        response = service.handle(
            request("decks.today", "b76c912a-953b-4eb2-bfc4-8b9d76fa2013", {"deckId": 42})
        )

        self.assertIsNone(response["error"])
        self.assertEqual(backend.today_counts_calls, [42])
        self.assertEqual(
            response["result"],
            {
                "deckId": 42,
                "new": 3,
                "learning": 1,
                "review": 5,
                "tomorrowDue": 13,
            },
        )


if __name__ == "__main__":
    unittest.main()
