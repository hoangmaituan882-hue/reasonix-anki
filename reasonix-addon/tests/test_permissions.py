import importlib
import unittest


def load_permissions_module():
    try:
        return importlib.import_module("reasonix_addon.permissions")
    except ModuleNotFoundError as error:
        raise AssertionError("permission manager is not implemented") from error


class PermissionManagerTests(unittest.TestCase):
    def test_confirmation_runs_on_main_and_grant_returns_the_session_token(self) -> None:
        permissions = load_permissions_module()
        main_calls = []
        confirmations = []

        def run_on_main(callback):
            main_calls.append(callback)
            callback()

        manager = permissions.PermissionManager(
            confirm=lambda: confirmations.append(True) or True,
            run_on_main=run_on_main,
            token_factory=lambda: "issued-session-token",
            timeout=0.2,
        )

        first = manager.request_permission()
        second = manager.request_permission()

        self.assertEqual(first, second)
        self.assertEqual(
            first,
            {
                "result": {
                    "permission": "granted",
                    "token": "issued-session-token",
                },
                "error": None,
            },
        )
        self.assertEqual(len(main_calls), 1)
        self.assertEqual(len(confirmations), 1)
        self.assertEqual(manager.token, "issued-session-token")

    def test_denial_can_be_retried_and_only_a_grant_is_remembered(self) -> None:
        permissions = load_permissions_module()
        confirmations = iter([False, True])
        manager = permissions.PermissionManager(
            confirm=lambda: next(confirmations),
            run_on_main=lambda callback: callback(),
            token_factory=lambda: "issued-session-token",
            timeout=0.2,
        )

        denied = manager.request_permission()
        granted = manager.request_permission()
        remembered = manager.request_permission()

        self.assertEqual(denied, {"result": {"permission": "denied"}, "error": None})
        self.assertEqual(granted["result"]["permission"], "granted")
        self.assertEqual(remembered, granted)

    def test_denial_does_not_expose_a_token(self) -> None:
        permissions = load_permissions_module()
        manager = permissions.PermissionManager(
            confirm=lambda: False,
            run_on_main=lambda callback: callback(),
            token_factory=lambda: "secret-token",
            timeout=0.2,
        )

        response = manager.request_permission()

        self.assertEqual(response, {"result": {"permission": "denied"}, "error": None})
        self.assertNotIn("token", response["result"])

    def test_timeout_is_structured_and_retryable(self) -> None:
        permissions = load_permissions_module()
        manager = permissions.PermissionManager(
            confirm=lambda: True,
            run_on_main=lambda callback: None,
            token_factory=lambda: "secret-token",
            timeout=0.01,
        )

        response = manager.request_permission()

        self.assertEqual(response["error"]["code"], "PERMISSION_TIMEOUT")
        self.assertTrue(response["error"]["retryable"])

    def test_confirmation_callback_is_ignored_if_it_runs_after_timeout(self) -> None:
        permissions = load_permissions_module()
        scheduled = []
        confirmations = []
        manager = permissions.PermissionManager(
            confirm=lambda: confirmations.append(True) or True,
            run_on_main=lambda callback: scheduled.append(callback),
            token_factory=lambda: "secret-token",
            timeout=0.01,
        )

        response = manager.request_permission()
        scheduled[0]()

        self.assertEqual(response["error"]["code"], "PERMISSION_TIMEOUT")
        self.assertEqual(confirmations, [])
        self.assertFalse(manager.granted)

    def test_confirmation_errors_are_not_leaked(self) -> None:
        permissions = load_permissions_module()

        def fail():
            raise RuntimeError("private Qt details")

        manager = permissions.PermissionManager(
            confirm=fail,
            run_on_main=lambda callback: callback(),
            token_factory=lambda: "secret-token",
            timeout=0.2,
        )

        response = manager.request_permission()

        self.assertEqual(response["error"]["code"], "PERMISSION_FAILED")
        self.assertNotIn("private Qt details", response["error"]["message"])

    def test_remembered_grant_skips_confirmation_after_anki_restart(self) -> None:
        permissions = load_permissions_module()
        confirmations = []
        manager = permissions.PermissionManager(
            confirm=lambda: confirmations.append(True) or True,
            run_on_main=lambda callback: callback(),
            token_factory=lambda: "fresh-process-token",
            remembered_grant=True,
        )

        response = manager.request_permission()

        self.assertEqual(response["result"]["permission"], "granted")
        self.assertEqual(response["result"]["token"], "fresh-process-token")
        self.assertEqual(confirmations, [])

    def test_revoke_rotates_token_and_requires_a_new_confirmation(self) -> None:
        permissions = load_permissions_module()
        tokens = iter(["token-before-revoke", "token-after-revoke"])
        confirmations = []
        manager = permissions.PermissionManager(
            confirm=lambda: confirmations.append(True) or True,
            run_on_main=lambda callback: callback(),
            token_factory=lambda: next(tokens),
            remembered_grant=True,
        )

        manager.revoke()
        response = manager.request_permission()

        self.assertEqual(manager.token, "token-after-revoke")
        self.assertEqual(response["result"]["token"], "token-after-revoke")
        self.assertEqual(confirmations, [True])


if __name__ == "__main__":
    unittest.main()
