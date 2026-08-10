import importlib
import unittest


def load_profile_key_module():
    try:
        return importlib.import_module("reasonix_addon.profile_key")
    except ModuleNotFoundError as error:
        raise AssertionError("profile key derivation is not implemented") from error


class ProfileKeyTests(unittest.TestCase):
    def test_key_is_stable_path_scoped_and_does_not_expose_the_path(self) -> None:
        profile_key = load_profile_key_module()
        path = r"C:\Users\Linze\AppData\Roaming\Anki2\Reasonix QA\collection.anki2"

        first = profile_key.derive_profile_key(path)
        second = profile_key.derive_profile_key(path)
        other = profile_key.derive_profile_key(
            r"C:\Users\Linze\AppData\Roaming\Anki2\Account 1\collection.anki2"
        )

        self.assertEqual(first, second)
        self.assertTrue(first.startswith("sha256:"))
        self.assertEqual(len(first), len("sha256:") + 64)
        self.assertNotEqual(first, other)
        self.assertNotIn("Linze", first)
        self.assertNotIn("Reasonix QA", first)


if __name__ == "__main__":
    unittest.main()
