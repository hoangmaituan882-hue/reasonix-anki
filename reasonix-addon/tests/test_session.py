import importlib
import unittest
from copy import deepcopy
from typing import Any


def load_session_module():
    try:
        return importlib.import_module("reasonix_addon.session")
    except ModuleNotFoundError as error:
        raise AssertionError("scheduler session core is not implemented") from error


def scheduler_item(card_id: int, *, new: int, learning: int, review: int):
    return {
        "card": {
            "cardId": card_id,
            "noteId": card_id - 1,
            "deckId": 42,
            "modelId": 99,
            "modelName": "Lapis",
            "templateOrd": 0,
            "templateName": "Vocabulary",
            "queue": 2,
            "type": 2,
            "cardKind": "vocabulary",
            "fields": {"Expression": f"word-{card_id}"},
            "tags": ["ReasonixQA"],
            "question": f"<div>word-{card_id}</div>",
            "answer": f"<div>definition-{card_id}</div>",
            "media": [],
        },
        "remaining": {"new": new, "learning": learning, "review": review},
        "intervals": {
            "1": {"label": "1 分钟", "seconds": 60},
            "2": {"label": "1 天", "seconds": 86400},
            "3": {"label": "4 天", "seconds": 345600},
            "4": {"label": "9 天", "seconds": 777600},
        },
        "opaque": object(),
    }


class FakeSchedulerBackend:
    def __init__(self, items: list[dict[str, Any]]) -> None:
        self.items = items
        self.index = 0
        self.started_decks: list[int] = []
        self.start_changes = object()
        self.answer_calls: list[tuple[int, int]] = []
        self.undo_calls = 0
        self.answer_changes = object()
        self.undo_changes = object()
        self.tomorrow_due_calls: list[int] = []

    def start(self, deck_id: int):
        self.started_decks.append(deck_id)
        return self.start_changes

    def next_item(self) -> dict[str, Any] | None:
        if self.index >= len(self.items):
            return None
        return deepcopy(self.items[self.index])

    def answer(self, item: dict[str, Any], ease: int):
        self.answer_calls.append((item["card"]["cardId"], ease))
        self.index += 1
        return self.answer_changes

    def undo(self):
        self.undo_calls += 1
        self.index -= 1
        return self.undo_changes

    def tomorrow_due(self, deck_id: int) -> int:
        self.tomorrow_due_calls.append(deck_id)
        return 13


class SchedulerSessionTests(unittest.TestCase):
    def make_manager(self):
        session = load_session_module()
        backend = FakeSchedulerBackend(
            [
                scheduler_item(101, new=2, learning=1, review=4),
                scheduler_item(202, new=2, learning=1, review=3),
            ]
        )
        manager = session.SessionManager(
            backend, session_id_factory=lambda: "study-session-1"
        )
        manager.start(deck_id=42, profile_key="profile-qa")
        return session, backend, manager

    def test_next_returns_the_scheduler_head_without_reordering(self) -> None:
        _, backend, manager = self.make_manager()

        result = manager.next(
            session_id="study-session-1", profile_key="profile-qa"
        )

        self.assertEqual(backend.started_decks, [42])
        self.assertEqual(result["card"]["cardId"], 101)
        self.assertEqual(result["remaining"], {"new": 2, "learning": 1, "review": 4})
        self.assertEqual(
            manager.next(session_id="study-session-1", profile_key="profile-qa"),
            result,
        )

    def test_start_exposes_native_deck_selection_changes(self) -> None:
        _, backend, manager = self.make_manager()

        self.assertIs(manager.take_operation_changes(), backend.start_changes)
        self.assertIsNone(manager.take_operation_changes())

    def test_start_resumes_an_active_session_for_the_same_deck(self) -> None:
        _, backend, manager = self.make_manager()
        first = manager.next(
            session_id="study-session-1", profile_key="profile-qa"
        )

        resumed = manager.start(deck_id=42, profile_key="profile-qa")

        self.assertEqual(resumed, {"sessionId": "study-session-1"})
        self.assertEqual(backend.started_decks, [42])
        self.assertEqual(
            manager.next(
                session_id=resumed["sessionId"], profile_key="profile-qa"
            ),
            first,
        )

    def test_start_keeps_a_different_active_deck_locked(self) -> None:
        session, backend, manager = self.make_manager()

        with self.assertRaises(session.SessionError) as raised:
            manager.start(deck_id=84, profile_key="profile-qa")

        self.assertEqual(raised.exception.code, "SESSION_BUSY")
        self.assertEqual(raised.exception.details, {"activeDeckId": 42})
        self.assertEqual(backend.started_decks, [42])

    def test_reveal_returns_the_backend_interval_labels_unchanged(self) -> None:
        _, _, manager = self.make_manager()
        manager.next(session_id="study-session-1", profile_key="profile-qa")

        result = manager.reveal(
            session_id="study-session-1",
            expected_card_id=101,
            profile_key="profile-qa",
        )

        self.assertEqual(result["cardId"], 101)
        self.assertEqual(result["intervals"]["3"], {"label": "4 天", "seconds": 345600})

    def test_card_mismatch_is_rejected_before_answering(self) -> None:
        session, backend, manager = self.make_manager()
        manager.next(session_id="study-session-1", profile_key="profile-qa")

        with self.assertRaises(session.SessionError) as raised:
            manager.answer(
                session_id="study-session-1",
                expected_card_id=999,
                ease=3,
                request_id="request-1",
                profile_key="profile-qa",
            )

        self.assertEqual(raised.exception.code, "CARD_MISMATCH")
        self.assertEqual(backend.answer_calls, [])

    def test_duplicate_answer_request_does_not_rate_twice(self) -> None:
        _, backend, manager = self.make_manager()
        manager.next(session_id="study-session-1", profile_key="profile-qa")
        kwargs = {
            "session_id": "study-session-1",
            "expected_card_id": 101,
            "ease": 3,
            "request_id": "request-1",
            "profile_key": "profile-qa",
        }

        first = manager.answer(**kwargs)
        second = manager.answer(**kwargs)

        self.assertEqual(first, second)
        self.assertEqual(backend.answer_calls, [(101, 3)])
        following = manager.next(
            session_id="study-session-1", profile_key="profile-qa"
        )
        self.assertEqual(following["card"]["cardId"], 202)

    def test_undo_restores_the_previous_scheduler_card(self) -> None:
        _, backend, manager = self.make_manager()
        manager.next(session_id="study-session-1", profile_key="profile-qa")
        manager.answer(
            session_id="study-session-1",
            expected_card_id=101,
            ease=3,
            request_id="request-1",
            profile_key="profile-qa",
        )
        manager.next(session_id="study-session-1", profile_key="profile-qa")

        restored = manager.undo(
            session_id="study-session-1",
            request_id="undo-request-1",
            profile_key="profile-qa",
        )

        self.assertEqual(backend.undo_calls, 1)
        self.assertEqual(restored["restoredCardId"], 101)
        self.assertEqual(restored["card"]["cardId"], 101)

    def test_exposes_and_clears_native_collection_operation_changes(self) -> None:
        _, backend, manager = self.make_manager()
        manager.next(session_id="study-session-1", profile_key="profile-qa")

        manager.answer(
            session_id="study-session-1",
            expected_card_id=101,
            ease=3,
            request_id="request-1",
            profile_key="profile-qa",
        )

        self.assertIs(manager.take_operation_changes(), backend.answer_changes)
        self.assertIsNone(manager.take_operation_changes())

        manager.undo(
            session_id="study-session-1",
            request_id="undo-request-1",
            profile_key="profile-qa",
        )
        self.assertIs(manager.take_operation_changes(), backend.undo_changes)

    def test_duplicate_commands_do_not_reuse_a_previous_collection_change(self) -> None:
        _, backend, manager = self.make_manager()
        manager.next(session_id="study-session-1", profile_key="profile-qa")
        kwargs = {
            "session_id": "study-session-1",
            "expected_card_id": 101,
            "ease": 3,
            "request_id": "request-1",
            "profile_key": "profile-qa",
        }

        manager.answer(**kwargs)
        self.assertIs(manager.take_operation_changes(), backend.answer_changes)
        manager.answer(**kwargs)
        self.assertIsNone(manager.take_operation_changes())
        self.assertEqual(backend.answer_calls, [(101, 3)])

    def test_profile_switch_invalidates_the_active_session(self) -> None:
        session, backend, manager = self.make_manager()

        with self.assertRaises(session.SessionError) as raised:
            manager.next(session_id="study-session-1", profile_key="profile-other")

        self.assertEqual(raised.exception.code, "PROFILE_CHANGED")
        self.assertEqual(backend.answer_calls, [])

    def test_finish_releases_the_lock_and_reports_net_answers(self) -> None:
        _, _, manager = self.make_manager()
        manager.next(session_id="study-session-1", profile_key="profile-qa")
        manager.answer(
            session_id="study-session-1",
            expected_card_id=101,
            ease=3,
            request_id="request-1",
            profile_key="profile-qa",
        )

        report = manager.finish(
            session_id="study-session-1", profile_key="profile-qa"
        )

        self.assertEqual(report["sessionId"], "study-session-1")
        self.assertEqual(report["answeredCards"], 1)
        self.assertEqual(report["ratings"], {"1": 0, "2": 0, "3": 1, "4": 0})
        self.assertEqual(report["tomorrowDue"], 13)
        restarted = manager.start(deck_id=42, profile_key="profile-qa")
        self.assertEqual(restarted["sessionId"], "study-session-1")

    def test_finish_reports_duration_ratings_weak_cards_and_native_forecast(self) -> None:
        session = load_session_module()
        backend = FakeSchedulerBackend(
            [
                scheduler_item(101, new=1, learning=0, review=1),
                scheduler_item(202, new=0, learning=0, review=1),
            ]
        )
        times = iter((100.0, 125.0))
        manager = session.SessionManager(
            backend,
            session_id_factory=lambda: "study-session-1",
            clock=lambda: next(times),
        )
        manager.start(deck_id=42, profile_key="profile-qa")
        manager.next(session_id="study-session-1", profile_key="profile-qa")
        manager.answer(
            session_id="study-session-1",
            expected_card_id=101,
            ease=1,
            request_id="answer-1",
            profile_key="profile-qa",
        )
        manager.next(session_id="study-session-1", profile_key="profile-qa")
        manager.answer(
            session_id="study-session-1",
            expected_card_id=202,
            ease=3,
            request_id="answer-2",
            profile_key="profile-qa",
        )

        report = manager.finish(
            session_id="study-session-1", profile_key="profile-qa"
        )

        self.assertEqual(report["durationMs"], 25_000)
        self.assertEqual(report["averageMs"], 12_500)
        self.assertEqual(report["ratings"], {"1": 1, "2": 0, "3": 1, "4": 0})
        self.assertEqual(report["forgottenRate"], 0.5)
        self.assertEqual(report["weakCardIds"], [101])
        self.assertEqual(report["tomorrowDue"], 13)
        self.assertEqual(backend.tomorrow_due_calls, [42])

    def test_external_collection_transition_invalidates_the_session(self) -> None:
        session, _, manager = self.make_manager()

        manager.invalidate()

        with self.assertRaises(session.SessionError) as raised:
            manager.next(session_id="study-session-1", profile_key="profile-qa")
        self.assertEqual(raised.exception.code, "SESSION_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
