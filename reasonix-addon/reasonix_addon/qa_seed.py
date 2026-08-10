"""Deterministic Lapis-like fixture seeding for the dedicated QA profile."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Protocol
from urllib.request import Request, urlopen

from .qa_profile import require_qa_profile


class QaSeedError(RuntimeError):
    """Raised when an existing QA fixture does not match the source fixture."""


class AnkiClient(Protocol):
    def call(
        self, action: str, params: dict[str, object] | None = None
    ) -> object: ...


class AnkiConnectClient:
    def __init__(
        self,
        endpoint: str = "http://127.0.0.1:8765",
        *,
        timeout: float = 5.0,
        opener: Any = urlopen,
    ) -> None:
        self.endpoint = endpoint
        self.timeout = timeout
        self.opener = opener

    def call(
        self, action: str, params: dict[str, object] | None = None
    ) -> object:
        payload: dict[str, object] = {"action": action, "version": 6}
        if params is not None:
            payload["params"] = params
        request = Request(
            self.endpoint,
            data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.opener(request, timeout=self.timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
        if not isinstance(body, dict):
            raise QaSeedError(f"AnkiConnect {action} returned a non-object response")
        if body.get("error") is not None:
            raise QaSeedError(f"AnkiConnect {action} failed: {body['error']}")
        return body.get("result")


_FRONTS = {
    "vocabulary": "{{Expression}}",
    "word_sentence": "{{Expression}}<div>{{Sentence}}</div>",
    "click": '<button type="button">{{Hint}}</button><div>{{Expression}}</div>',
    "sentence": "{{Sentence}}",
    "audio": "{{ExpressionAudio}}{{SentenceAudio}}",
}

_BACK = (
    "{{FrontSide}}<hr id=answer>"
    '<div class="reading">{{ExpressionFurigana}}</div>'
    '<div class="definition">{{MainDefinition}}</div>'
    '<div class="sentence">{{SentenceFurigana}}</div>'
)


def build_card_templates(fixture: Mapping[str, Any]) -> list[dict[str, str]]:
    notes = fixture.get("notes")
    if not isinstance(notes, list) or not notes:
        raise QaSeedError("fixture must contain at least one note")
    cards = notes[0].get("cards")
    if not isinstance(cards, list) or not cards:
        raise QaSeedError("fixture note must define card templates")

    templates: list[dict[str, str]] = []
    for card in cards:
        card_kind = card.get("cardKind")
        template_name = card.get("templateName")
        if card_kind not in _FRONTS or not isinstance(template_name, str):
            raise QaSeedError(f"unsupported QA card template: {card!r}")
        templates.append(
            {
                "Name": template_name,
                "Front": (
                    f'<section data-reasonix-card-kind="{card_kind}">'
                    f"{_FRONTS[card_kind]}</section>"
                ),
                "Back": _BACK,
            }
        )
    return templates


def fixture_tag(guid: str) -> str:
    return f"reasonix-qa-fixture::{guid}"


def _require_list(value: object, field: str) -> list[Any]:
    if not isinstance(value, list):
        raise QaSeedError(f"{field} returned an invalid value")
    return value


def _require_positive_int(value: object, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise QaSeedError(f"{field} returned an invalid id")
    return value


def _verify_model(
    client: AnkiClient,
    *,
    model_name: str,
    fields: list[str],
    templates: list[dict[str, str]],
) -> None:
    actual_fields = client.call("modelFieldNames", {"modelName": model_name})
    if actual_fields != fields:
        raise QaSeedError(f"existing model {model_name!r} has different fields")

    actual_templates = client.call("modelTemplates", {"modelName": model_name})
    expected_templates = {
        template["Name"]: {
            "Front": template["Front"],
            "Back": template["Back"],
        }
        for template in templates
    }
    if actual_templates != expected_templates:
        raise QaSeedError(f"existing model {model_name!r} has different templates")


def _expected_fields(note: Mapping[str, Any]) -> dict[str, str]:
    fields = note.get("fields")
    if not isinstance(fields, dict) or not all(
        isinstance(name, str) and isinstance(value, str)
        for name, value in fields.items()
    ):
        raise QaSeedError("fixture note fields are invalid")
    return fields


def _verify_note(
    client: AnkiClient,
    *,
    note_id: int,
    model_name: str,
    note: Mapping[str, Any],
) -> None:
    response = _require_list(
        client.call("notesInfo", {"notes": [note_id]}), "notesInfo"
    )
    if len(response) != 1 or not isinstance(response[0], dict):
        raise QaSeedError(f"fixture note {note_id} could not be read back")

    actual = response[0]
    guid = note.get("guid")
    if not isinstance(guid, str) or not guid:
        raise QaSeedError("fixture note guid is invalid")
    expected_fields = _expected_fields(note)
    actual_fields = actual.get("fields")
    normalized_fields = (
        {
            name: field.get("value")
            for name, field in actual_fields.items()
            if isinstance(field, dict)
        }
        if isinstance(actual_fields, dict)
        else None
    )
    cards = actual.get("cards")
    expected_cards = note.get("cards")
    if (
        actual.get("modelName") != model_name
        or normalized_fields != expected_fields
        or fixture_tag(guid) not in actual.get("tags", [])
        or not isinstance(cards, list)
        or not isinstance(expected_cards, list)
        or len(cards) != len(expected_cards)
    ):
        raise QaSeedError(f"existing fixture note {note_id} does not match")


def seed_fixture(
    client: AnkiClient, fixture: Mapping[str, Any]
) -> dict[str, object]:
    profile_name = require_qa_profile(client.call("getActiveProfile"))

    model_name = fixture.get("modelName")
    deck_name = fixture.get("deckName")
    fields = fixture.get("fields")
    notes = fixture.get("notes")
    if (
        not isinstance(model_name, str)
        or not isinstance(deck_name, str)
        or not isinstance(fields, list)
        or not all(isinstance(field, str) for field in fields)
        or not isinstance(notes, list)
    ):
        raise QaSeedError("fixture metadata is invalid")

    templates = build_card_templates(fixture)
    model_names = _require_list(client.call("modelNames"), "modelNames")
    model_created = model_name not in model_names
    if model_created:
        client.call(
            "createModel",
            {
                "modelName": model_name,
                "inOrderFields": fields,
                "cardTemplates": templates,
                "css": (
                    ".card{font-family:sans-serif;text-align:center;}"
                    ".definition{margin-top:1rem;}"
                ),
                "isCloze": False,
            },
        )
    else:
        _verify_model(
            client,
            model_name=model_name,
            fields=fields,
            templates=templates,
        )

    deck_id = _require_positive_int(
        client.call("createDeck", {"deck": deck_name}), "createDeck"
    )
    note_ids: list[int] = []
    notes_created = 0
    for note in notes:
        if not isinstance(note, dict):
            raise QaSeedError("fixture note is invalid")
        guid = note.get("guid")
        if not isinstance(guid, str) or not guid:
            raise QaSeedError("fixture note guid is invalid")
        tag = fixture_tag(guid)
        matches = _require_list(
            client.call("findNotes", {"query": f"tag:{tag}"}), "findNotes"
        )
        if len(matches) > 1:
            raise QaSeedError(f"fixture tag {tag!r} matched multiple notes")
        if matches:
            note_id = _require_positive_int(matches[0], "findNotes")
        else:
            note_id = _require_positive_int(
                client.call(
                    "addNote",
                    {
                        "note": {
                            "deckName": deck_name,
                            "modelName": model_name,
                            "fields": _expected_fields(note),
                            "tags": ["reasonix-qa-fixture", tag],
                        }
                    },
                ),
                "addNote",
            )
            notes_created += 1
        _verify_note(
            client,
            note_id=note_id,
            model_name=model_name,
            note=note,
        )
        note_ids.append(note_id)

    return {
        "profileName": profile_name,
        "deckId": deck_id,
        "modelCreated": model_created,
        "noteIds": note_ids,
        "notesCreated": notes_created,
    }


DEFAULT_FIXTURE_PATH = Path(__file__).parents[1] / "fixtures" / "lapis-qa-sample.json"


def main(
    argv: list[str] | None = None,
    *,
    client: AnkiClient | None = None,
    fixture_path: Path = DEFAULT_FIXTURE_PATH,
) -> int:
    parser = argparse.ArgumentParser(
        description="Seed the deterministic Lapis fixture into Reasonix QA."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="allow writes after the exact Reasonix QA profile guard passes",
    )
    args = parser.parse_args(argv)
    if not args.apply:
        print(
            "QA seeding is write-protected; pass --apply after opening "
            "the exact 'Reasonix QA' profile.",
            file=sys.stderr,
        )
        return 2

    try:
        with fixture_path.open(encoding="utf-8") as source:
            fixture = json.load(source)
        report = seed_fixture(client or AnkiConnectClient(), fixture)
    except Exception as error:
        print(f"QA seed refused to run: {error}", file=sys.stderr)
        return 2

    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0
