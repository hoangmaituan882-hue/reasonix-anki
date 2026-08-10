import importlib
import unittest


def load_config_module():
    try:
        return importlib.import_module("reasonix_addon.config")
    except ModuleNotFoundError as error:
        raise AssertionError("addon config module is not implemented") from error


class AddonConfigTests(unittest.TestCase):
    def test_default_config_uses_global_prompt_once_authorization(self) -> None:
        config = load_config_module()

        normalized = config.normalize_config({})

        self.assertEqual(
            normalized["authorization"],
            {"mode": "prompt_once", "granted": False},
        )

    def test_invalid_or_legacy_values_fail_closed_to_prompt_once(self) -> None:
        config = load_config_module()

        normalized = config.normalize_config(
            {"authorization": {"mode": "auto_allow", "granted": "yes"}}
        )

        self.assertEqual(
            normalized["authorization"],
            {"mode": "prompt_once", "granted": False},
        )

    def test_prompt_each_start_never_persists_granted_state(self) -> None:
        config = load_config_module()

        normalized = config.normalize_config(
            {"authorization": {"mode": "prompt_each_start", "granted": True}}
        )

        self.assertEqual(
            normalized["authorization"],
            {"mode": "prompt_each_start", "granted": False},
        )


if __name__ == "__main__":
    unittest.main()
