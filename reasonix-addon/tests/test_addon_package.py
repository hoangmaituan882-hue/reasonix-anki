import importlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile


def load_packager():
    try:
        return importlib.import_module("package_addon")
    except ModuleNotFoundError as error:
        raise AssertionError("addon packaging script is not implemented") from error


class AddonPackageTests(unittest.TestCase):
    def test_package_contains_only_installable_addon_files(self) -> None:
        packager = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "reasonix-anki-addon.ankiaddon"
            packager.build_package(output)

            with ZipFile(output) as archive:
                names = set(archive.namelist())

        self.assertIn("__init__.py", names)
        self.assertIn("manifest.json", names)
        self.assertIn("config.json", names)
        self.assertIn("reasonix_addon/entrypoint.py", names)
        self.assertIn("reasonix_addon/operation_bridge.py", names)
        self.assertNotIn("tests/test_session.py", names)
        self.assertFalse(any("__pycache__" in name for name in names))
        self.assertFalse(any(Path(name).name.startswith("qa_") for name in names))
        self.assertTrue(all(name.endswith((".py", ".json")) for name in names))

    def test_package_imports_from_the_anki_addons_parent_directory(self) -> None:
        packager = load_packager()
        with tempfile.TemporaryDirectory() as temporary:
            parent = Path(temporary)
            output = parent / "reasonix-anki-addon.ankiaddon"
            addon_root = parent / "reasonix-anki"
            packager.build_package(output)
            with ZipFile(output) as archive:
                archive.extractall(addon_root)

            script = """
import importlib
import sys
import types
from pathlib import Path

parent = Path(sys.argv[1])
addon_root = parent / "reasonix-anki"
sys.path.insert(0, str(parent))

aqt = types.ModuleType("aqt")
aqt.gui_hooks = object()
aqt.mw = object()
sys.modules["aqt"] = aqt

core_name = "reasonix-anki.reasonix_addon"
core = types.ModuleType(core_name)
core.__path__ = [str(addon_root / "reasonix_addon")]
sys.modules[core_name] = core

entrypoint = types.ModuleType(f"{core_name}.entrypoint")
entrypoint.install = lambda mw, gui_hooks, **kwargs: "installed"
sys.modules[entrypoint.__name__] = entrypoint

addon = importlib.import_module("reasonix-anki")
assert addon.runtime == "installed"
"""
            result = subprocess.run(
                [sys.executable, "-c", script, str(parent)],
                capture_output=True,
                text=True,
                check=False,
                cwd=parent,
            )

        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
