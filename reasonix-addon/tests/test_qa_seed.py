import importlib
import json
import unittest
from contextlib import redirect_stderr
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any
from urllib.request import Request

from reasonix_addon.qa_profile import QA_PROFILE_NAME, UnsafeProfileError


FIXTURE_PATH = Path(__file__).parents[1] / "fixtures" / "lapis-qa-sample.json"


def load_seed_module():
    try:
        return importlib.import_module("reasonix_addon.qa_seed")
    except ModuleNotFoundError as error:
        raise AssertionError("qa_seed is not implemented") from error


def load_fixture() -> dict[str, Any]:
    with FIXTURE_PATH.open(encoding="utf-8") as source:
        return json.load(source)


class RecordingClient:
    def __init__(self, responses: dict[str, object]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, dict[str, object] | None]] = []

    def call(
        self, action: str, params: dict[str, object] | None = None
    ) -> object:
        self.calls.append((action, params))
        response = self.responses[action]
        if callable(response):
            return response(params)
        return response


class FakeResponse(BytesIO):
    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()


def note_info(fixture: dict[str, Any], note_id: int) -> dict[str, object]:
    note = fixture["notes"][0]
    return {
        "noteId": note_id,
        "modelName": fixture["modelName"],
        "tags": [f"reasonix-qa-fixture::{note['guid']}"],
        "fields": {
            name: {"value": value, "order": index}
            for index, (name, value) in enumerate(note["fields"].items())
        },
        "cards": [101, 102, 103, 104, 105],
    }


class QaSeedTests(unittest.TestCase):
    def test_refuses_a_non_qa_profile_before_any_mutation(self) -> None:
        seed = load_seed_module()
        client = RecordingClient({"getActiveProfile": "账户 1"})

        with self.assertRaises(UnsafeProfileError):
            seed.seed_fixture(client, load_fixture())

        self.assertEqual(client.calls, [("getActiveProfile", None)])

    def test_creates_the_model_deck_and_note_from_the_fixture(self) -> None:
        seed = load_seed_module()
        fixture = load_fixture()
        client = RecordingClient(
            {
                "getActiveProfile": QA_PROFILE_NAME,
                "modelNames": [],
                "createModel": {"id": 9001},
                "createDeck": 8001,
                "findNotes": [],
                "addNote": 7001,
                "notesInfo": [note_info(fixture, 7001)],
            }
        )

        report = seed.seed_fixture(client, fixture)

        self.assertEqual(
            report,
            {
                "profileName": QA_PROFILE_NAME,
                "deckId": 8001,
                "modelCreated": True,
                "noteIds": [7001],
                "notesCreated": 1,
            },
        )
        create_model = next(params for action, params in client.calls if action == "createModel")
        self.assertEqual(create_model["modelName"], fixture["modelName"])
        self.assertEqual(create_model["inOrderFields"], fixture["fields"])
        self.assertEqual(
            [template["Name"] for template in create_model["cardTemplates"]],
            [card["templateName"] for card in fixture["notes"][0]["cards"]],
        )
        add_note = next(params for action, params in client.calls if action == "addNote")
        self.assertEqual(add_note["note"]["deckName"], fixture["deckName"])
        self.assertEqual(add_note["note"]["modelName"], fixture["modelName"])
        self.assertIn("reasonix-qa-fixture::reasonix-qa-ningen", add_note["note"]["tags"])

    def test_reuses_and_verifies_an_existing_fixture_without_duplicate_notes(self) -> None:
        seed = load_seed_module()
        fixture = load_fixture()
        templates = seed.build_card_templates(fixture)
        client = RecordingClient(
            {
                "getActiveProfile": QA_PROFILE_NAME,
                "modelNames": [fixture["modelName"]],
                "modelFieldNames": fixture["fields"],
                "modelTemplates": {
                    template["Name"]: {
                        "Front": template["Front"],
                        "Back": template["Back"],
                    }
                    for template in templates
                },
                "createDeck": 8001,
                "findNotes": [7001],
                "notesInfo": [note_info(fixture, 7001)],
            }
        )

        report = seed.seed_fixture(client, fixture)

        self.assertFalse(report["modelCreated"])
        self.assertEqual(report["notesCreated"], 0)
        self.assertEqual(report["noteIds"], [7001])
        self.assertNotIn("createModel", [action for action, _ in client.calls])
        self.assertNotIn("addNote", [action for action, _ in client.calls])

    def test_http_client_uses_ankiconnect_v6_and_unwraps_the_result(self) -> None:
        seed = load_seed_module()
        self.assertTrue(hasattr(seed, "AnkiConnectClient"), "HTTP client is missing")
        captured: list[dict[str, object]] = []

        def opener(request: Request, *, timeout: float) -> FakeResponse:
            captured.append(json.loads(request.data or b"{}"))
            self.assertGreater(timeout, 0)
            return FakeResponse(
                json.dumps({"result": ["Basic"], "error": None}).encode("utf-8")
            )

        client = seed.AnkiConnectClient(opener=opener)

        self.assertEqual(client.call("modelNames"), ["Basic"])
        self.assertEqual(
            captured,
            [{"action": "modelNames", "version": 6}],
        )

    def test_cli_requires_an_explicit_apply_flag_before_network_access(self) -> None:
        seed = load_seed_module()
        self.assertTrue(hasattr(seed, "main"), "seed CLI is missing")
        client = RecordingClient({})
        stderr = StringIO()

        with redirect_stderr(stderr):
            exit_code = seed.main([], client=client, fixture_path=FIXTURE_PATH)

        self.assertEqual(exit_code, 2)
        self.assertEqual(client.calls, [])
        self.assertIn("--apply", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
