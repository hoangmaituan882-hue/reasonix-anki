"""Anki 25.09 scheduler v3 adapter used inside serialized collection ops."""

from __future__ import annotations

from typing import Any, Callable, Mapping


class AnkiAdapterError(RuntimeError):
    """Raised when Anki state cannot satisfy the Reasonix session contract."""


def _default_card_factory(collection: Any, backend_card: Any) -> Any:
    from anki.cards import Card

    return Card(collection, backend_card=backend_card)


def _default_rating_map() -> dict[int, object]:
    from anki.scheduler.v3 import CardAnswer

    return {
        1: CardAnswer.AGAIN,
        2: CardAnswer.HARD,
        3: CardAnswer.GOOD,
        4: CardAnswer.EASY,
    }


class AnkiSchedulerAdapter:
    def __init__(
        self,
        collection: Any,
        *,
        card_factory: Callable[[Any, Any], Any] = _default_card_factory,
        rating_map: Mapping[int, object] | None = None,
    ) -> None:
        self.collection = collection
        self.card_factory = card_factory
        self.rating_map = dict(rating_map) if rating_map is not None else None
        self._answer_undo_step: object | None = None

    def start(self, deck_id: int) -> object:
        deck = self.collection.decks.get(deck_id)
        if not isinstance(deck, dict):
            raise AnkiAdapterError(f"deck {deck_id} does not exist")
        if deck.get("dyn"):
            raise AnkiAdapterError("filtered decks are not supported")
        changes = self.collection.decks.set_current(deck_id)
        self._answer_undo_step = None
        return changes

    def next_item(self) -> dict[str, Any] | None:
        output = self.collection.sched.get_queued_cards(fetch_limit=1)
        if not output.cards:
            return None

        top = output.cards[0]
        states = top.states
        states.current.custom_data = top.card.custom_data
        card = self.card_factory(self.collection, top.card)
        card.start_timer()
        note = card.note()
        notetype = card.note_type()
        template = card.template()
        labels = list(self.collection.sched.describe_next_states(states))
        if len(labels) != 4 or not all(isinstance(label, str) for label in labels):
            raise AnkiAdapterError("scheduler did not return four interval labels")

        fields = dict(note.items())
        if not all(
            isinstance(name, str) and isinstance(value, str)
            for name, value in fields.items()
        ):
            raise AnkiAdapterError("note fields are not string values")

        return {
            "card": {
                "cardId": int(card.id),
                "noteId": int(card.nid),
                "deckId": int(card.did),
                "modelId": int(notetype["id"]),
                "modelName": str(notetype["name"]),
                "templateOrd": int(card.ord),
                "templateName": str(template["name"]),
                "queue": int(card.queue),
                "type": int(card.type),
                "cardKind": "unknown",
                "fields": fields,
                "tags": list(note.tags),
                "question": card.question(),
                "answer": card.answer(),
                "media": [],
            },
            "remaining": {
                "new": int(output.new_count),
                "learning": int(output.learning_count),
                "review": int(output.review_count),
            },
            "intervals": {
                str(ease): {"label": label}
                for ease, label in enumerate(labels, start=1)
            },
            "opaque": {
                "card": card,
                "states": states,
                "context": top.context,
            },
        }

    def answer(self, item: dict[str, Any], ease: int) -> object:
        opaque = item.get("opaque")
        if not isinstance(opaque, dict):
            raise AnkiAdapterError("scheduler item is missing opaque state")
        card = opaque.get("card")
        states = opaque.get("states")
        if card is None or states is None:
            raise AnkiAdapterError("scheduler item is missing card states")

        current_queue = self.collection.sched.get_queued_cards(fetch_limit=1)
        if not current_queue.cards:
            raise AnkiAdapterError("scheduler queue changed before answer")
        current_card_id = int(current_queue.cards[0].card.id)
        if current_card_id != int(card.id):
            raise AnkiAdapterError("scheduler head changed before answer")

        ratings = self.rating_map or _default_rating_map()
        try:
            rating = ratings[ease]
        except KeyError as error:
            raise AnkiAdapterError("ease must be from 1 to 4") from error
        answer = self.collection.sched.build_answer(
            card=card,
            states=states,
            rating=rating,
        )
        changes = self.collection.sched.answer_card(answer)
        try:
            self._answer_undo_step = self.collection.undo_status().last_step
        except Exception:
            # The scheduler has already accepted the rating. Do not report a
            # failed answer merely because the optional undo probe failed;
            # disable Reasonix undo for this answer instead.
            self._answer_undo_step = None
        return changes

    def undo(self) -> object:
        if self._answer_undo_step is None:
            raise AnkiAdapterError("no Reasonix answer is available to undo")
        active_step = self.collection.undo_status().last_step
        if active_step != self._answer_undo_step:
            raise AnkiAdapterError(
                "Anki undo stack changed after the last Reasonix answer"
            )
        changes = self.collection.undo()
        self._answer_undo_step = None
        return changes

    def tomorrow_due(self, deck_id: int) -> int:
        deck_ids = [
            int(child_id)
            for child_id in self.collection.decks.deck_and_child_ids(deck_id)
        ]
        if not deck_ids:
            return 0
        placeholders = ",".join("?" for _ in deck_ids)
        count = self.collection.db.scalar(
            f"""
            select count() from cards
            where did in ({placeholders})
              and queue in (?, ?)
              and due = ?
            """,
            *deck_ids,
            2,
            3,
            int(self.collection.sched.today) + 1,
        )
        return int(count or 0)
