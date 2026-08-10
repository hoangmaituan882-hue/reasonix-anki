import json
import unittest
from pathlib import Path


ADDON_ROOT = Path(__file__).parents[1]


class AddonPackageLayoutTests(unittest.TestCase):
    def test_installable_root_entrypoint_and_manifest_exist(self) -> None:
        entrypoint = ADDON_ROOT / "__init__.py"
        manifest = ADDON_ROOT / "manifest.json"
        config = ADDON_ROOT / "config.json"

        self.assertTrue(entrypoint.is_file())
        self.assertTrue(manifest.is_file())
        self.assertTrue(config.is_file())
        text = entrypoint.read_text(encoding="utf-8")
        self.assertIn("install", text)
        self.assertIn("reasonix_addon.entrypoint", text)

        data = json.loads(manifest.read_text(encoding="utf-8"))
        self.assertEqual(data["package"], "reasonix-anki")
        self.assertEqual(data["min_point_version"], 250902)
        self.assertEqual(data["max_point_version"], -250902)


if __name__ == "__main__":
    unittest.main()
