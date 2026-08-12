"""Scheduler-owned study session state with idempotent command handling."""

from __future__ import annotations

import time
from copy import deepcopy
from dataclasses import dataclass, field
from time import monotonic
from typing import Any, Callable, Protocol
from uuid import uuid4


class SessionError(RuntimeError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        details: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.details = details or {}


class SchedulerBackend(Protocol):
    def start(self, deck_id: int) -> object: ...

    def next_item(self) -> dict[str, Any] | None: ...

    def answer(self, item: dict[str, Any], ease: int) -> object: ...

    def undo(self) -> object: ...

    def tomorrow_due(self, deck_id: int) -> int | None: ...


@dataclass
class _CachedCommand:
    action: str
    fingerprint: tuple[object, ...]
    result: dict[str, object]


@dataclass
class _ActiveSession:
    session_id: str
    deck_id: int
    profile_key: str
    active_item: dict[str, Any] | None = None
    last_answered_card_id: int | None = None
    answered_cards: int = 0
    started_at: float = 0.0
    answer_history: list[tuple[int, int]] = field(default_factory=list)
    commands: dict[str, _CachedCommand] = field(default_factory=dict)


# 持久化快照的 answer_history 长度上限（防止 config 无限膨胀）
MAX_PERSISTED_HISTORY = 500


class SessionManager:
    def __init__(
        self,
        backend: SchedulerBackend,
        *,
        session_id_factory: Callable[[], str] = lambda: str(uuid4()),
        clock: Callable[[], float] = monotonic,
        wall_clock: Callable[[], float] = time.time,
        persist: Callable[[dict[str, object]], None] | None = None,
        load_snapshot: Callable[[], dict[str, object] | None] | None = None,
    ) -> None:
        self.backend = backend
        self.session_id_factory = session_id_factory
        self.clock = clock
        self.wall_clock = wall_clock
        self.persist = persist
        self.load_snapshot = load_snapshot
        self._session: _ActiveSession | None = None
        self._last_operation_changes: object | None = None

    # ---- 持久化快照（跨插件重启恢复） ----

    def _snapshot(self, session: _ActiveSession) -> dict[str, object]:
        return {
            "sessionId": session.session_id,
            "deckId": session.deck_id,
            "profileKey": session.profile_key,
            "lastAnsweredCardId": session.last_answered_card_id,
            "answeredCards": session.answered_cards,
            "answerHistory": session.answer_history[-MAX_PERSISTED_HISTORY:],
            "startedAt": session.started_at,
        }

    def _save_snapshot(self) -> None:
        session = self._session
        if self.persist is None or session is None:
            return
        self.persist(self._snapshot(session))

    def _clear_snapshot(self) -> None:
        if self.persist is None:
            return
        self.persist({})  # 空快照 = 无活动会话

    def _resume_from_snapshot(self, deck_id: int, profile_key: str) -> bool:
        """同 deck + 同 profile 的持久快照存在时重建会话（跨插件重启）。"""
        if self.load_snapshot is None or self._session is not None:
            return False
        try:
            snapshot = self.load_snapshot()
        except Exception:
            return False
        if not isinstance(snapshot, dict):
            return False
        if (
            snapshot.get("deckId") != deck_id
            or snapshot.get("profileKey") != profile_key
        ):
            return False
        session_id = snapshot.get("sessionId")
        if not isinstance(session_id, str) or not session_id:
            return False
        history = snapshot.get("answerHistory")
        self._session = _ActiveSession(
            session_id=session_id,
            deck_id=deck_id,
            profile_key=profile_key,
            last_answered_card_id=snapshot.get("lastAnsweredCardId"),
            answered_cards=(
                int(snapshot["answeredCards"]) if snapshot.get("answeredCards") else 0
            ),
            started_at=(
                float(snapshot["startedAt"]) if snapshot.get("startedAt") else self.wall_clock()
            ),
            answer_history=(
                [
                    (int(pair[0]), int(pair[1]))
                    for pair in history
                    if isinstance(pair, list) and len(pair) == 2
                ]
                if isinstance(history, list)
                else []
            ),
            # 幂等 commands 缓存不持久化：重启后旧 requestId 不命中
            commands={},
        )
        # 恢复后重新从 scheduler 队首取（队列归 Anki 所有，不持久化 active_item）
        self._session.active_item = None
        return True

    @property
    def has_active_session(self) -> bool:
        return self._session is not None

    def take_operation_changes(self) -> object | None:
        """Return native OpChanges once for the surrounding CollectionOp."""

        changes = self._last_operation_changes
        self._last_operation_changes = None
        return changes

    def invalidate(self) -> None:
        """Drop session state after any external collection transition."""

        self._session = None
        self._last_operation_changes = None
        self._clear_snapshot()

    def start(self, *, deck_id: int, profile_key: str) -> dict[str, object]:
        if self._session is not None:
            if (
                self._session.deck_id == deck_id
                and self._session.profile_key == profile_key
            ):
                # A renderer may disappear after Anki has accepted the native
                # deck selection. Reconnecting to the same deck must resume
                # the existing scheduler session rather than strand its lock.
                return {"sessionId": self._session.session_id}
            raise SessionError(
                "SESSION_BUSY",
                "A study session is already active.",
                details={"activeDeckId": self._session.deck_id},
            )
        if deck_id <= 0 or not profile_key:
            raise SessionError("INVALID_REQUEST", "deckId and profileKey are required.")

        # 跨插件重启恢复：同 deck + 同 profile 的持久快照存在则重建会话
        if self._resume_from_snapshot(deck_id, profile_key):
            self._last_operation_changes = self.backend.start(deck_id)
            return {"sessionId": self._session.session_id}

        self._last_operation_changes = self.backend.start(deck_id)
        session_id = self.session_id_factory()
        self._session = _ActiveSession(
            session_id=session_id,
            deck_id=deck_id,
            profile_key=profile_key,
            started_at=self.wall_clock(),
        )
        self._save_snapshot()
        return {"sessionId": session_id}

    def _require_session(
        self, *, session_id: str, profile_key: str
    ) -> _ActiveSession:
        session = self._session
        if session is None or session.session_id != session_id:
            raise SessionError("SESSION_NOT_FOUND", "The study session is not active.")
        if session.profile_key != profile_key:
            self._session = None
            self._clear_snapshot()
            raise SessionError(
                "PROFILE_CHANGED",
                "The active Anki profile changed during the study session.",
                details={
                    "expectedProfileKey": session.profile_key,
                    "activeProfileKey": profile_key,
                },
            )
        return session

    @staticmethod
    def _card_id(item: dict[str, Any]) -> int:
        card = item.get("card")
        card_id = card.get("cardId") if isinstance(card, dict) else None
        if not isinstance(card_id, int) or isinstance(card_id, bool) or card_id <= 0:
            raise SessionError(
                "SCHEDULER_PAYLOAD_INVALID",
                "The scheduler returned an invalid card payload.",
            )
        return card_id

    @staticmethod
    def _public_item(
        session: _ActiveSession, item: dict[str, Any]
    ) -> dict[str, object]:
        card = item.get("card")
        remaining = item.get("remaining")
        if not isinstance(card, dict) or not isinstance(remaining, dict):
            raise SessionError(
                "SCHEDULER_PAYLOAD_INVALID",
                "The scheduler returned an invalid queue payload.",
            )
        return {
            "sessionId": session.session_id,
            "card": deepcopy(card),
            "remaining": deepcopy(remaining),
        }

    def _ensure_active_item(self, session: _ActiveSession) -> dict[str, Any]:
        if session.active_item is None:
            session.active_item = self.backend.next_item()
        if session.active_item is None:
            raise SessionError("SESSION_COMPLETE", "The scheduler queue is empty.")
        self._card_id(session.active_item)
        return session.active_item

    def next(self, *, session_id: str, profile_key: str) -> dict[str, object]:
        session = self._require_session(
            session_id=session_id, profile_key=profile_key
        )
        return self._public_item(session, self._ensure_active_item(session))

    def _require_expected_card(
        self, session: _ActiveSession, expected_card_id: int
    ) -> dict[str, Any]:
        item = self._ensure_active_item(session)
        active_card_id = self._card_id(item)
        if active_card_id != expected_card_id:
            raise SessionError(
                "CARD_MISMATCH",
                "The active card does not match expectedCardId.",
                details={
                    "expectedCardId": expected_card_id,
                    "activeCardId": active_card_id,
                },
            )
        return item

    def reveal(
        self,
        *,
        session_id: str,
        expected_card_id: int,
        profile_key: str,
    ) -> dict[str, object]:
        session = self._require_session(
            session_id=session_id, profile_key=profile_key
        )
        item = self._require_expected_card(session, expected_card_id)
        intervals = item.get("intervals")
        if not isinstance(intervals, dict):
            raise SessionError(
                "SCHEDULER_PAYLOAD_INVALID",
                "The scheduler did not return interval labels.",
            )
        return {
            "cardId": expected_card_id,
            "intervals": deepcopy(intervals),
        }

    @staticmethod
    def _cached_result(
        session: _ActiveSession,
        *,
        request_id: str,
        action: str,
        fingerprint: tuple[object, ...],
    ) -> dict[str, object] | None:
        cached = session.commands.get(request_id)
        if cached is None:
            return None
        if cached.action != action or cached.fingerprint != fingerprint:
            raise SessionError(
                "REQUEST_ID_REUSED",
                "requestId was already used for a different command.",
            )
        return deepcopy(cached.result)

    @staticmethod
    def _cache_result(
        session: _ActiveSession,
        *,
        request_id: str,
        action: str,
        fingerprint: tuple[object, ...],
        result: dict[str, object],
    ) -> dict[str, object]:
        session.commands[request_id] = _CachedCommand(
            action=action,
            fingerprint=fingerprint,
            result=deepcopy(result),
        )
        return result

    def answer(
        self,
        *,
        session_id: str,
        expected_card_id: int,
        ease: int,
        request_id: str,
        profile_key: str,
    ) -> dict[str, object]:
        session = self._require_session(
            session_id=session_id, profile_key=profile_key
        )
        if ease not in {1, 2, 3, 4}:
            raise SessionError("INVALID_EASE", "ease must be from 1 to 4.")
        fingerprint = (session_id, expected_card_id, ease, profile_key)
        if cached := self._cached_result(
            session,
            request_id=request_id,
            action="session.answer",
            fingerprint=fingerprint,
        ):
            return cached

        item = self._require_expected_card(session, expected_card_id)
        self._last_operation_changes = self.backend.answer(item, ease)
        session.last_answered_card_id = expected_card_id
        session.answered_cards += 1
        session.answer_history.append((expected_card_id, ease))
        session.active_item = None
        result = self._cache_result(
            session,
            request_id=request_id,
            action="session.answer",
            fingerprint=fingerprint,
            result={"answeredCardId": expected_card_id, "ease": ease},
        )
        self._save_snapshot()
        return result

    def undo(
        self,
        *,
        session_id: str,
        request_id: str,
        profile_key: str,
    ) -> dict[str, object]:
        session = self._require_session(
            session_id=session_id, profile_key=profile_key
        )
        fingerprint = (session_id, profile_key)
        if cached := self._cached_result(
            session,
            request_id=request_id,
            action="session.undo",
            fingerprint=fingerprint,
        ):
            return cached
        previous_card_id = session.last_answered_card_id
        if previous_card_id is None:
            raise SessionError("NOTHING_TO_UNDO", "No Reasonix answer can be undone.")

        session.active_item = None
        self._last_operation_changes = self.backend.undo()
        restored = self._ensure_active_item(session)
        restored_card_id = self._card_id(restored)
        if restored_card_id != previous_card_id:
            raise SessionError(
                "UNDO_MISMATCH",
                "Anki undo did not restore the expected card.",
                details={
                    "expectedCardId": previous_card_id,
                    "activeCardId": restored_card_id,
                },
            )
        result = {
            "restoredCardId": restored_card_id,
            "card": deepcopy(restored["card"]),
            "remaining": deepcopy(restored["remaining"]),
        }
        session.last_answered_card_id = None
        session.answered_cards -= 1
        if (
            session.answer_history
            and session.answer_history[-1][0] == previous_card_id
        ):
            session.answer_history.pop()
        result = self._cache_result(
            session,
            request_id=request_id,
            action="session.undo",
            fingerprint=fingerprint,
            result=result,
        )
        self._save_snapshot()
        return result

    def finish(
        self, *, session_id: str, profile_key: str
    ) -> dict[str, object]:
        session = self._require_session(
            session_id=session_id, profile_key=profile_key
        )
        # durationMs 用墙钟：跨重启恢复的会话 started_at 是墙钟快照，
        # 用 monotonic 计算会得到负值或巨大值
        duration_ms = max(0, int((self.wall_clock() - session.started_at) * 1000))
        ratings = {
            str(ease): sum(
                1
                for _, answered_ease in session.answer_history
                if answered_ease == ease
            )
            for ease in (1, 2, 3, 4)
        }
        weak_card_ids: list[int] = []
        for card_id, ease in session.answer_history:
            if ease <= 2 and card_id not in weak_card_ids:
                weak_card_ids.append(card_id)
        tomorrow_due_provider = getattr(self.backend, "tomorrow_due", None)
        tomorrow_due = (
            tomorrow_due_provider(session.deck_id)
            if callable(tomorrow_due_provider)
            else None
        )
        result = {
            "sessionId": session.session_id,
            "answeredCards": session.answered_cards,
            "durationMs": duration_ms,
            "averageMs": duration_ms // session.answered_cards
            if session.answered_cards
            else 0,
            "ratings": ratings,
            "forgottenRate": (
                ratings["1"] / session.answered_cards
                if session.answered_cards
                else 0.0
            ),
            "weakCardIds": weak_card_ids,
            "tomorrowDue": tomorrow_due,
        }
        self._session = None
        self._clear_snapshot()
        return result
