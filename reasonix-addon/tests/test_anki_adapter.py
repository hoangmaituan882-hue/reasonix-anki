import importlib
import unittest
from types import SimpleNamespace


def load_adapter_module():
    try:
        return importlib.import_module("reasonix_addon.anki_adapter")
    except ModuleNotFoundError as error:
        raise AssertionError("Anki 25.09 scheduler adapter is not implemented") from error


class FakeNote:
    mid = 99
    tags = ["ReasonixQA"]

    def items(self):
        return [("Expression", "人間"), ("MainDefinition", "人类；人。")]


class FakeCard:
    def __init__(self, card_id: int) -> None:
        self.id = card_id
        self.nid = card_id - 1
        self.did = 42
        self.ord = 0
        self.queue = 2
        self.type = 2
        self.custom_data = "qa-custom-data"
        self.timer_started = False

    def note(self) -> FakeNote:
        return FakeNote()

    def note_type(self):
        return {"id": 99, "name": "Reasonix QA Lapis"}

    def template(self):
        return {"name": "Vocabulary"}

    def question(self) -> str:
        return "<div>人間</div>"

    def answer(self) -> str:
        return "<div>人类；人。</div>"

    def start_timer(self) -> None:
        self.timer_started = True


class FakeDecks:
    def __init__(self, *, filtered: bool = False) -> None:
        self.filtered = filtered
        self.selected_ids: list[int] = []
        self.selection_changes = object()

    def get(self, deck_id: int):
        if deck_id != 42:
            return None
        return {"id": 42, "name": "Reasonix QA::Lapis", "dyn": self.filtered}

    def select(self, deck_id: int) -> None:
        self.selected_ids.append(deck_id)

    def set_current(self, deck_id: int):
        self.selected_ids.append(deck_id)
        return self.selection_changes

    def deck_and_child_ids(self, deck_id: int):
        return [deck_id, 43]


class FakeScheduler:
    def __init__(self, collection) -> None:
        self.collection = collection
        self.index = 0
        self.cards = [FakeCard(101), FakeCard(202)]
        self.build_calls = []
        self.answer_calls = []
        self.answer_changes = object()
        self.today = 10

    def get_queued_cards(self, *, fetch_limit: int = 1):
        if self.index >= len(self.cards):
            return SimpleNamespace(
                cards=[], new_count=0, learning_count=0, review_count=0
            )
        card = self.cards[self.index]
        states = SimpleNamespace(current=SimpleNamespace(custom_data=""))
        top = SimpleNamespace(
            card=card,
            states=states,
            context=SimpleNamespace(),
            queue=2,
        )
        return SimpleNamespace(
            cards=[top],
            new_count=2,
            learning_count=1,
            review_count=4 - self.index,
        )

    def describe_next_states(self, states):
        return ["1 分钟", "1 天", "4 天", "9 天"]

    def build_answer(self, *, card, states, rating):
        answer = SimpleNamespace(card=card, states=states, rating=rating)
        self.build_calls.append(answer)
        return answer

    def counts(self, *, deck_id: int, include_child_decks: bool) -> SimpleNamespace:
        self.count_calls = getattr(self, "count_calls", [])
        self.count_calls.append((deck_id, include_child_decks))
        return SimpleNamespace(new=3, learn=1, review=5)

    def deck_due_tree(self, top_deck_id: int) -> SimpleNamespace | None:
        self.deck_tree_calls = getattr(self, "deck_tree_calls", [])
        self.deck_tree_calls.append(top_deck_id)
        return SimpleNamespace(
            deck_id=42,
            new_count=3,
            learn_count=1,
            review_count=5,
            total_in_deck=20,
        )

    def answer_card(self, answer):
        self.answer_calls.append(answer)
        self.index += 1
        self.collection.undo_step += 1
        return self.answer_changes


class FakeCollection:
    def __init__(self, *, filtered: bool = False) -> None:
        self.decks = FakeDecks(filtered=filtered)
        self.undo_step = 10
        self.sched = FakeScheduler(self)
        self.db = SimpleNamespace(scalar=lambda _query, *_args: 7)
        self.undo_calls = 0
        self.undo_changes = object()
        self.fail_undo_status = False

    def undo_status(self):
        if self.fail_undo_status:
            raise RuntimeError("undo status unavailable")
        return SimpleNamespace(last_step=self.undo_step)

    def undo(self):
        self.undo_calls += 1
        self.sched.index -= 1
        self.undo_step -= 1
        return self.undo_changes


class AnkiSchedulerAdapterTests(unittest.TestCase):
    def make_adapter(self, *, filtered: bool = False):
        adapter_module = load_adapter_module()
        collection = FakeCollection(filtered=filtered)
        adapter = adapter_module.AnkiSchedulerAdapter(
            collection,
            card_factory=lambda _collection, backend_card: backend_card,
            rating_map={1: "again", 2: "hard", 3: "good", 4: "easy"},
        )
        return adapter_module, collection, adapter

    def test_selects_the_deck_and_adapts_only_the_scheduler_head(self) -> None:
        _, collection, adapter = self.make_adapter()

        changes = adapter.start(42)
        item = adapter.next_item()

        self.assertEqual(collection.decks.selected_ids, [42])
        self.assertIs(changes, collection.decks.selection_changes)
        self.assertEqual(item["card"]["cardId"], 101)
        self.assertEqual(item["card"]["fields"]["Expression"], "人間")
        self.assertEqual(item["remaining"], {"new": 2, "learning": 1, "review": 4})
        self.assertEqual(item["intervals"]["3"], {"label": "4 天"})
        self.assertTrue(collection.sched.cards[0].timer_started)

    def test_answers_with_the_exact_card_states_and_native_rating(self) -> None:
        _, collection, adapter = self.make_adapter()
        adapter.start(42)
        item = adapter.next_item()

        changes = adapter.answer(item, 3)

        built = collection.sched.build_calls[0]
        self.assertIs(built.card, collection.sched.cards[0])
        self.assertIs(built.states, item["opaque"]["states"])
        self.assertEqual(built.states.current.custom_data, "qa-custom-data")
        self.assertEqual(built.rating, "good")
        self.assertEqual(len(collection.sched.answer_calls), 1)
        self.assertIs(changes, collection.sched.answer_changes)

    def test_answer_remains_successful_if_post_answer_undo_state_is_unavailable(self) -> None:
        adapter_module, collection, adapter = self.make_adapter()
        adapter.start(42)
        item = adapter.next_item()
        collection.fail_undo_status = True

        changes = adapter.answer(item, 3)

        self.assertIs(changes, collection.sched.answer_changes)
        self.assertEqual(collection.sched.index, 1)
        with self.assertRaises(adapter_module.AnkiAdapterError):
            adapter.undo()

    def test_undo_is_tied_to_the_answer_undo_step(self) -> None:
        adapter_module, collection, adapter = self.make_adapter()
        adapter.start(42)
        item = adapter.next_item()
        adapter.answer(item, 3)
        collection.undo_step += 1

        with self.assertRaises(adapter_module.AnkiAdapterError):
            adapter.undo()

        self.assertEqual(collection.undo_calls, 0)

    def test_rejects_answer_if_the_native_scheduler_head_changed(self) -> None:
        adapter_module, collection, adapter = self.make_adapter()
        adapter.start(42)
        item = adapter.next_item()
        collection.sched.index = 1

        with self.assertRaises(adapter_module.AnkiAdapterError):
            adapter.answer(item, 3)

        self.assertEqual(collection.sched.answer_calls, [])

    def test_answer_then_undo_restores_the_scheduler_head(self) -> None:
        _, collection, adapter = self.make_adapter()
        adapter.start(42)
        first = adapter.next_item()
        adapter.answer(first, 3)

        changes = adapter.undo()
        restored = adapter.next_item()

        self.assertEqual(collection.undo_calls, 1)
        self.assertIs(changes, collection.undo_changes)
        self.assertEqual(restored["card"]["cardId"], 101)

    def test_rejects_filtered_decks(self) -> None:
        adapter_module, collection, adapter = self.make_adapter(filtered=True)

        with self.assertRaises(adapter_module.AnkiAdapterError):
            adapter.start(42)

        self.assertEqual(collection.decks.selected_ids, [])

    def test_reports_tomorrow_due_using_anki_deck_and_child_queue_rules(self) -> None:
        _, collection, adapter = self.make_adapter()

        tomorrow = adapter.tomorrow_due(42)

        self.assertEqual(tomorrow, 7)
        self.assertEqual(collection.decks.deck_and_child_ids(42), [42, 43])

    def test_today_counts_uses_native_scheduler_tree_with_child_decks(self) -> None:
        _, collection, adapter = self.make_adapter()

        counts = adapter.today_counts(42)

        self.assertEqual(
            counts,
            {
                "deckId": 42,
                "new": 3,
                "learning": 1,
                "review": 5,
                "tomorrowDue": 7,
            },
        )
        self.assertEqual(collection.sched.deck_tree_calls, [42])

    def test_infer_card_kind_from_template_name(self) -> None:
        adapter_module, _collection, _adapter = self.make_adapter()
        infer = adapter_module.AnkiSchedulerAdapter._infer_card_kind

        self.assertEqual(infer("Vocabulary"), "vocabulary")
        self.assertEqual(infer("Word And Sentence Card"), "word_sentence")
        self.assertEqual(infer("Click Card"), "click")
        self.assertEqual(infer("Sentence Card"), "sentence")
        self.assertEqual(infer("Audio Card"), "audio")
        self.assertEqual(infer("Listening Card"), "audio")
        self.assertEqual(infer("VocabularyWithFurigana"), "vocabulary")
        self.assertEqual(infer("UnknownTemplate"), "unknown")

    def test_collect_media_extracts_local_filenames_and_skips_externals(self) -> None:
        adapter_module, _collection, _adapter = self.make_adapter()
        collect = adapter_module.AnkiSchedulerAdapter._collect_media

        media = collect(
            '声 [sound:kaigi.mp3] 例句',
            '<img src="pic.jpg"><audio src="audio/klaxon.mp3">'
            '<img src="https://example.com/remote.png">',
            '.bg{background:url("bg.webp")}',
        )
        # kaigi.mp3（sound 标签）、pic.jpg（img src）、bg.webp（url()）
        # 被收集；audio/klaxon.mp3 含路径分隔符、remote.png 外链被跳过
        self.assertEqual(media, ["kaigi.mp3", "pic.jpg", "bg.webp"])

        # 去重保序
        self.assertEqual(
            collect("[sound:a.mp3]", "[sound:a.mp3]", "b"),
            ["a.mp3"],
        )


if __name__ == "__main__":
    unittest.main()
