import importlib
import unittest


def load_entrypoint_module():
    try:
        return importlib.import_module("reasonix_addon.entrypoint")
    except ModuleNotFoundError as error:
        raise AssertionError("addon entrypoint is not implemented") from error


class FakeHook:
    def __init__(self) -> None:
        self.callbacks = []

    def append(self, callback) -> None:
        self.callbacks.append(callback)


class FakeHooks:
    def __init__(self) -> None:
        for name in (
            "profile_did_open",
            "profile_will_close",
            "collection_will_temporarily_close",
            "collection_did_temporarily_close",
            "sync_will_start",
            "sync_did_finish",
        ):
            setattr(self, name, FakeHook())


class FakeTaskManager:
    def __init__(self) -> None:
        self.in_main_callback = False

    def run_on_main(self, callback) -> None:
        previous = self.in_main_callback
        self.in_main_callback = True
        try:
            callback()
        finally:
            self.in_main_callback = previous


class FakeProfileManager:
    name = "Reasonix QA"

    def collectionPath(self) -> str:
        return r"C:\QA\Reasonix QA\collection.anki2"


class FakeAddonManager:
    def __init__(self, taskman, config=None) -> None:
        self.taskman = taskman
        self.config = config or {}
        self.writes = []
        self.write_contexts = []

    def getConfig(self, addon_name):
        return self.config

    def writeConfig(self, addon_name, config) -> None:
        self.config = config
        self.writes.append((addon_name, config))
        self.write_contexts.append(self.taskman.in_main_callback)


class FakeMainWindow:
    def __init__(self) -> None:
        self.taskman = FakeTaskManager()
        self.pm = FakeProfileManager()
        self.col = object()
        self.addonManager = FakeAddonManager(self.taskman)


class FakeServer:
    def __init__(self, address, dispatcher) -> None:
        self.address = address
        self.dispatcher = dispatcher

    def serve_forever(self) -> None:
        return

    def shutdown(self) -> None:
        return

    def server_close(self) -> None:
        return


class FakeThread:
    def __init__(self, *, target, name, daemon) -> None:
        self.target = target
        self.name = name
        self.daemon = daemon

    def start(self) -> None:
        self.target()

    def join(self, timeout=None) -> None:
        return


class FakeAdapter:
    def __init__(self, collection) -> None:
        self.collection = collection

    def start(self, deck_id):
        return None

    def next_item(self):
        return None

    def answer(self, item, ease):
        return object()

    def undo(self):
        return object()


class EntrypointTests(unittest.TestCase):
    def test_install_registers_hooks_starts_loopback_server_and_binds_profile(self) -> None:
        entrypoint = load_entrypoint_module()
        hooks = FakeHooks()
        mw = FakeMainWindow()
        servers = []

        runtime = entrypoint.install(
            mw,
            hooks,
            query_op_factory=lambda **kwargs: None,
            collection_op_factory=lambda **kwargs: None,
            scheduler_adapter_factory=FakeAdapter,
            server_factory=lambda address, dispatcher: servers.append(
                FakeServer(address, dispatcher)
            ) or servers[-1],
            thread_factory=FakeThread,
            ask_user=lambda: True,
            empty_changes_factory=object,
            settings_registrar=lambda *args, **kwargs: None,
        )

        self.assertEqual(len(hooks.profile_did_open.callbacks), 1)
        self.assertEqual(len(hooks.profile_will_close.callbacks), 1)
        self.assertEqual(len(hooks.collection_will_temporarily_close.callbacks), 1)
        self.assertEqual(len(hooks.collection_did_temporarily_close.callbacks), 1)
        self.assertEqual(len(hooks.sync_will_start.callbacks), 1)
        self.assertEqual(len(hooks.sync_did_finish.callbacks), 1)
        self.assertEqual(servers[0].address, ("127.0.0.1", 8766))

        hooks.profile_did_open.callbacks[0]()
        status = runtime.dispatch(
            {
                "version": 1,
                "action": "status",
                "requestId": "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
                "params": {},
            }
        )

        self.assertEqual(status["result"]["profileName"], "Reasonix QA")
        self.assertEqual(status["result"]["collectionState"], "open")
        runtime.stop()

    def test_install_remembers_one_global_permission_grant(self) -> None:
        entrypoint = load_entrypoint_module()
        hooks = FakeHooks()
        mw = FakeMainWindow()
        confirmations = []

        runtime = entrypoint.install(
            mw,
            hooks,
            query_op_factory=lambda **kwargs: None,
            collection_op_factory=lambda **kwargs: None,
            scheduler_adapter_factory=FakeAdapter,
            server_factory=FakeServer,
            thread_factory=FakeThread,
            ask_user=lambda: confirmations.append(True) or True,
            empty_changes_factory=object,
            addon_name="reasonix-anki",
            settings_registrar=lambda *args, **kwargs: None,
        )
        request = {
            "version": 1,
            "action": "requestPermission",
            "requestId": "f6b5db80-58f7-4dbb-8d9b-6dcf0adf0d9c",
            "params": {},
        }

        first = runtime.dispatch(request)
        second = runtime.dispatch(request)

        self.assertEqual(first, second)
        self.assertEqual(len(confirmations), 1)
        self.assertEqual(
            mw.addonManager.config["authorization"],
            {"mode": "prompt_once", "granted": True},
        )
        self.assertEqual(mw.addonManager.write_contexts, [True])
        runtime.stop()

    def test_http_bind_failure_does_not_abort_addon_installation(self) -> None:
        entrypoint = load_entrypoint_module()
        hooks = FakeHooks()
        mw = FakeMainWindow()
        settings_calls = []

        runtime = entrypoint.install(
            mw,
            hooks,
            query_op_factory=lambda **kwargs: None,
            collection_op_factory=lambda **kwargs: None,
            scheduler_adapter_factory=FakeAdapter,
            server_factory=lambda _address, _dispatcher: (_ for _ in ()).throw(
                OSError("port occupied")
            ),
            thread_factory=FakeThread,
            ask_user=lambda: True,
            empty_changes_factory=object,
            settings_registrar=lambda *args, **kwargs: settings_calls.append(kwargs),
        )

        self.assertEqual(runtime.status()["health"]["serviceState"], "error")
        self.assertEqual(len(hooks.profile_did_open.callbacks), 1)
        self.assertEqual(len(settings_calls), 1)
        diagnostics = settings_calls[0]["runtime_status_provider"]()
        self.assertEqual(diagnostics["health"]["lastError"]["code"], "HTTP_SERVER_START_FAILED")


if __name__ == "__main__":
    unittest.main()
