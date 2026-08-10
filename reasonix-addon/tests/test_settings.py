import importlib
import unittest

from reasonix_addon.permissions import PermissionManager


def load_settings_module():
    try:
        return importlib.import_module("reasonix_addon.settings")
    except ModuleNotFoundError as error:
        raise AssertionError("addon settings page is not implemented") from error


class FakeSignal:
    def __init__(self) -> None:
        self.callbacks = []

    def connect(self, callback) -> None:
        self.callbacks.append(callback)


class FakeAction:
    def __init__(self, label, parent) -> None:
        self.label = label
        self.parent = parent
        self.triggered = FakeSignal()


class FakeAddonManager:
    def __init__(self) -> None:
        self.actions = {}

    def setConfigAction(self, addon_name, callback) -> None:
        self.actions[addon_name] = callback


class FakeMenu:
    def __init__(self) -> None:
        self.actions = []

    def addAction(self, action) -> None:
        self.actions.append(action)


class FakeMainWindow:
    def __init__(self) -> None:
        self.addonManager = FakeAddonManager()
        self.form = type("Form", (), {"menuTools": FakeMenu()})()


class SettingsRegistrationTests(unittest.TestCase):
    def test_registers_both_addon_config_and_tools_menu_entries(self) -> None:
        settings = load_settings_module()
        mw = FakeMainWindow()
        permission_manager = PermissionManager(
            confirm=lambda: True,
            run_on_main=lambda callback: callback(),
            token_factory=lambda: "token-a",
        )

        action = settings.register_settings(
            mw,
            addon_name="reasonix-anki",
            permission_manager=permission_manager,
            anki_version_provider=lambda: "25.09.2",
            action_factory=FakeAction,
        )

        self.assertIn("reasonix-anki", mw.addonManager.actions)
        self.assertEqual(action.label, "Reasonix 设置…")
        self.assertEqual(mw.form.menuTools.actions, [action])
        self.assertEqual(len(action.triggered.callbacks), 1)
        self.assertEqual(settings.SETTINGS_TITLE, "Reasonix Anki 设置")


if __name__ == "__main__":
    unittest.main()
