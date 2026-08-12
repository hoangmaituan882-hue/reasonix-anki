import importlib
import json
import unittest
from pathlib import Path
from unittest import mock


def load_runtime_module():
    try:
        return importlib.import_module("reasonix_addon.runtime")
    except ModuleNotFoundError as error:
        raise AssertionError("addon lifecycle runtime is not implemented") from error


class AddonVersionTests(unittest.TestCase):
    """单一真源：ADDON_VERSION 必须等于 manifest.json 的 human_version。"""

    def test_loads_version_from_the_manifest_single_source(self) -> None:
        module = load_runtime_module()
        manifest = (
            Path(module.__file__).resolve().parent.parent / "manifest.json"
        )
        with manifest.open(encoding="utf-8") as source:
            expected = json.load(source)["human_version"]

        self.assertEqual(module.ADDON_VERSION, expected)

    def test_falls_back_to_constant_when_manifest_is_unreadable(self) -> None:
        module = load_runtime_module()
        original = module._load_addon_version

        def broken_load() -> str:
            # 模拟 manifest 解析失败（JSON 损坏/缺失字段）→ 兜底常量
            with mock.patch(
                "reasonix_addon.runtime.json.load",
                side_effect=ValueError("broken manifest"),
            ):
                return original()

        with mock.patch(
            "reasonix_addon.runtime._load_addon_version",
            side_effect=broken_load,
        ):
            self.assertEqual(module._load_addon_version(), "0.1.1")
        # 还原后仍能读回 manifest 真源
        self.assertEqual(original(), module.ADDON_VERSION)


class FakeServer:
    def __init__(self, address, dispatcher) -> None:
        self.address = address
        self.dispatcher = dispatcher
        self.serve_calls = 0
        self.shutdown_calls = 0
        self.close_calls = 0

    def serve_forever(self) -> None:
        self.serve_calls += 1

    def shutdown(self) -> None:
        self.shutdown_calls += 1

    def server_close(self) -> None:
        self.close_calls += 1


class FakeThread:
    def __init__(self, *, target, name, daemon) -> None:
        self.target = target
        self.name = name
        self.daemon = daemon
        self.start_calls = 0
        self.join_calls = []

    def start(self) -> None:
        self.start_calls += 1
        self.target()

    def join(self, timeout=None) -> None:
        self.join_calls.append(timeout)


class FakeBridge:
    def __init__(self) -> None:
        self.requests = []

    def dispatch(self, request):
        self.requests.append(request)
        return {"result": {"accepted": True}, "error": None}


class FakePermissionManager:
    token = "qa-session-token"

    def __init__(self) -> None:
        self.calls = 0

    def request_permission(self):
        self.calls += 1
        return {
            "result": {"permission": "granted", "token": self.token},
            "error": None,
        }


class AddonRuntimeTests(unittest.TestCase):
    def make_runtime(self, *, sync_start=None, active_session=False):
        runtime_module = load_runtime_module()
        servers = []
        threads = []
        permission_manager = FakePermissionManager()

        def server_factory(address, dispatcher):
            server = FakeServer(address, dispatcher)
            servers.append(server)
            return server

        def thread_factory(**kwargs):
            thread = FakeThread(**kwargs)
            threads.append(thread)
            return thread

        runtime = runtime_module.AddonRuntime(
            server_factory=server_factory,
            thread_factory=thread_factory,
            permission_manager=permission_manager,
            addon_version="0.1.0-test",
            anki_version_provider=lambda: "25.09.2-test",
            sync_start=sync_start or (lambda: None),
            run_on_main=lambda callback: callback(),
            active_session_provider=lambda: active_session,
        )
        return runtime, servers, threads, permission_manager

    def test_server_is_loopback_only_and_start_is_idempotent(self) -> None:
        runtime, servers, threads, _ = self.make_runtime()

        runtime.start()
        runtime.start()

        self.assertEqual(len(servers), 1)
        self.assertEqual(servers[0].address, ("127.0.0.1", 8766))
        self.assertEqual(len(threads), 1)
        self.assertEqual(threads[0].name, "reasonix-addon-http")
        self.assertTrue(threads[0].daemon)
        self.assertEqual(threads[0].start_calls, 1)
        self.assertEqual(servers[0].serve_calls, 1)

    def test_server_start_failure_is_nonfatal_reported_and_retryable(self) -> None:
        runtime_module = load_runtime_module()
        servers = []
        attempts = 0

        def server_factory(address, dispatcher):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise OSError("address already in use")
            server = FakeServer(address, dispatcher)
            servers.append(server)
            return server

        runtime = runtime_module.AddonRuntime(
            server_factory=server_factory,
            thread_factory=FakeThread,
            clock=lambda: 100.0,
        )

        self.assertFalse(runtime.start())
        failed = runtime.status()
        self.assertEqual(failed["health"]["serviceState"], "error")
        self.assertEqual(
            failed["health"]["lastError"]["code"],
            "HTTP_SERVER_START_FAILED",
        )

        self.assertTrue(runtime.start())
        recovered = runtime.status()
        self.assertEqual(recovered["health"]["serviceState"], "listening")
        self.assertEqual(len(servers), 1)

    def test_worker_exception_is_exposed_as_a_service_health_error(self) -> None:
        runtime_module = load_runtime_module()

        class CrashingServer(FakeServer):
            def serve_forever(self) -> None:
                self.serve_calls += 1
                raise RuntimeError("worker failed")

        runtime = runtime_module.AddonRuntime(
            server_factory=CrashingServer,
            thread_factory=FakeThread,
        )

        self.assertTrue(runtime.start())
        status = runtime.status()
        self.assertEqual(status["health"]["serviceState"], "error")
        self.assertEqual(status["health"]["lastError"]["code"], "HTTP_SERVER_STOPPED")

    def test_thread_creation_failure_closes_the_partially_created_server(self) -> None:
        runtime_module = load_runtime_module()
        servers = []

        def server_factory(address, dispatcher):
            server = FakeServer(address, dispatcher)
            servers.append(server)
            return server

        runtime = runtime_module.AddonRuntime(
            server_factory=server_factory,
            thread_factory=lambda **_kwargs: (_ for _ in ()).throw(
                RuntimeError("thread unavailable")
            ),
        )

        self.assertFalse(runtime.start())
        self.assertEqual(servers[0].shutdown_calls, 1)
        self.assertEqual(servers[0].close_calls, 1)

    def test_status_tracks_heartbeat_request_and_failure_counts(self) -> None:
        runtime, _, _, _ = self.make_runtime()

        runtime.dispatch({"action": "invalid"})
        status = runtime.dispatch(
            {
                "version": 1,
                "action": "status",
                "requestId": "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
                "params": {},
            }
        )["result"]

        self.assertEqual(status["health"]["requestCount"], 2)
        self.assertEqual(status["health"]["failedRequestCount"], 1)
        self.assertIsNotNone(status["health"]["lastHeartbeatAt"])

    def test_profile_collection_and_sync_hooks_fail_closed(self) -> None:
        runtime, _, _, _ = self.make_runtime()
        bridge = FakeBridge()
        invalidations = []
        request = {
            "version": 1,
            "action": "session.next",
            "requestId": "905aa70c-32af-4e71-b236-8897c36a1d9d",
            "token": "qa-session-token",
            "params": {"sessionId": "study-session-1"},
        }

        unavailable = runtime.dispatch(request)
        runtime.profile_did_open(
            bridge,
            invalidate=lambda: invalidations.append(True),
            profile_name="Reasonix QA",
            profile_key="sha256:qa-profile",
        )
        accepted = runtime.dispatch(request)
        runtime.collection_will_temporarily_close()
        temporarily_closed = runtime.dispatch(request)
        runtime.collection_did_temporarily_close()
        accepted_after_reopen = runtime.dispatch(request)
        runtime.sync_will_start()
        syncing = runtime.dispatch(request)
        runtime.sync_did_finish()
        accepted_after_sync = runtime.dispatch(request)
        runtime.profile_will_close()
        profile_closed = runtime.dispatch(request)

        self.assertEqual(unavailable["error"]["code"], "COLLECTION_UNAVAILABLE")
        self.assertEqual(accepted["result"], {"accepted": True})
        self.assertEqual(temporarily_closed["error"]["code"], "COLLECTION_UNAVAILABLE")
        self.assertEqual(accepted_after_reopen["result"], {"accepted": True})
        self.assertEqual(syncing["error"]["code"], "SYNC_IN_PROGRESS")
        self.assertEqual(accepted_after_sync["result"], {"accepted": True})
        self.assertEqual(profile_closed["error"]["code"], "COLLECTION_UNAVAILABLE")
        self.assertEqual(len(bridge.requests), 3)
        self.assertEqual(len(invalidations), 3)

    def test_stop_shuts_down_and_closes_the_server_once(self) -> None:
        runtime, servers, threads, _ = self.make_runtime()
        runtime.start()

        runtime.stop()
        runtime.stop()

        self.assertEqual(servers[0].shutdown_calls, 1)
        self.assertEqual(servers[0].close_calls, 1)
        self.assertEqual(threads[0].join_calls, [2.0])

    def test_stop_invalidates_the_profile_boundary(self) -> None:
        runtime, _, _, _ = self.make_runtime()
        bridge = FakeBridge()
        invalidations = []
        runtime.profile_did_open(
            bridge,
            invalidate=lambda: invalidations.append(True),
            profile_name="Reasonix QA",
            profile_key="sha256:qa-profile",
        )
        runtime.start()

        runtime.stop()

        response = runtime.dispatch(
            {
                "version": 1,
                "action": "session.next",
                "requestId": "905aa70c-32af-4e71-b236-8897c36a1d9d",
                "token": "qa-session-token",
                "params": {"sessionId": "study-session-1"},
            }
        )
        self.assertEqual(response["error"]["code"], "COLLECTION_UNAVAILABLE")
        self.assertEqual(invalidations, [True])

    def test_status_and_permission_work_without_an_open_collection(self) -> None:
        runtime, _, _, permission_manager = self.make_runtime()
        status_request = {
            "version": 1,
            "action": "status",
            "requestId": "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
            "params": {},
        }
        permission_request = {
            "version": 1,
            "action": "requestPermission",
            "requestId": "f6b5db80-58f7-4dbb-8d9b-6dcf0adf0d9c",
            "params": {},
        }

        closed = runtime.dispatch(status_request)
        permission = runtime.dispatch(permission_request)
        runtime.profile_did_open(
            FakeBridge(),
            invalidate=lambda: None,
            profile_name="Reasonix QA",
            profile_key="sha256:qa-profile",
        )
        opened = runtime.dispatch(status_request)
        runtime.collection_will_temporarily_close()
        temporary = runtime.dispatch(status_request)
        runtime.collection_did_temporarily_close()
        runtime.sync_will_start()
        syncing = runtime.dispatch(status_request)

        self.assertEqual(closed["result"]["addonVersion"], "0.1.0-test")
        self.assertEqual(closed["result"]["ankiVersion"], "25.09.2-test")
        self.assertIsNone(closed["result"]["profileKey"])
        self.assertEqual(closed["result"]["collectionState"], "closed")
        self.assertEqual(permission["result"]["permission"], "granted")
        self.assertEqual(permission_manager.calls, 1)
        self.assertEqual(opened["result"]["profileName"], "Reasonix QA")
        self.assertEqual(opened["result"]["collectionState"], "open")
        self.assertEqual(temporary["result"]["collectionState"], "temporarilyClosed")
        self.assertEqual(syncing["result"]["syncState"], "syncing")
        self.assertIn("session.answer", opened["result"]["capabilities"])
        self.assertIn("sync.start", opened["result"]["capabilities"])

    def test_sync_start_is_authenticated_serialized_and_locked_around_a_session(self) -> None:
        sync_calls = []
        runtime, _, _, _ = self.make_runtime(sync_start=lambda: sync_calls.append(True))
        runtime.profile_did_open(
            FakeBridge(),
            invalidate=lambda: None,
            profile_name="Japanese",
            profile_key="sha256:profile",
        )
        request = {
            "version": 1,
            "action": "sync.start",
            "requestId": "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
            "token": "qa-session-token",
            "params": {},
        }

        accepted = runtime.dispatch(request)
        self.assertEqual(accepted["result"], {"state": "starting"})
        self.assertEqual(sync_calls, [True])

        runtime.sync_will_start()
        duplicate = runtime.dispatch(request)
        self.assertEqual(duplicate["result"], {"state": "starting"})
        concurrent = runtime.dispatch(
            dict(request, requestId="6d3027b6-edcc-4abf-8454-24fc9dd1549e")
        )
        self.assertEqual(concurrent["error"]["code"], "SYNC_IN_PROGRESS")
        runtime.sync_did_finish()

        completed_duplicate = runtime.dispatch(request)
        self.assertEqual(completed_duplicate["result"], {"state": "idle"})

        unauthorized = dict(request, token="wrong-token")
        denied = runtime.dispatch(unauthorized)
        self.assertEqual(denied["error"]["code"], "UNAUTHORIZED")

    def test_sync_request_stays_pending_until_hook_or_timeout(self) -> None:
        runtime_module = load_runtime_module()
        now = [100.0]
        runtime = runtime_module.AddonRuntime(
            server_factory=FakeServer,
            thread_factory=FakeThread,
            permission_manager=FakePermissionManager(),
            sync_start=lambda: None,
            run_on_main=lambda callback: callback(),
            clock=lambda: now[0],
            sync_pending_timeout=30.0,
        )
        runtime.profile_did_open(
            FakeBridge(),
            invalidate=lambda: None,
            profile_name="Japanese",
            profile_key="sha256:profile",
        )
        request = {
            "version": 1,
            "action": "sync.start",
            "requestId": "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
            "token": "qa-session-token",
            "params": {},
        }

        accepted = runtime.dispatch(request)
        self.assertEqual(accepted["result"], {"state": "starting"})
        self.assertEqual(runtime.status()["syncState"], "syncing")

        now[0] = 131.0
        timed_out = runtime.status()
        self.assertEqual(timed_out["syncState"], "error")
        self.assertEqual(timed_out["health"]["sync"]["state"], "error")
        self.assertEqual(
            timed_out["health"]["lastError"]["code"],
            "SYNC_START_TIMEOUT",
        )

    def test_sync_start_rejects_an_active_study_session(self) -> None:
        runtime, _, _, _ = self.make_runtime(active_session=True)
        runtime.profile_did_open(
            FakeBridge(),
            invalidate=lambda: None,
            profile_name="Japanese",
            profile_key="sha256:profile",
        )
        request = {
            "version": 1,
            "action": "sync.start",
            "requestId": "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
            "token": "qa-session-token",
            "params": {},
        }

        response = runtime.dispatch(request)

        self.assertEqual(response["error"]["code"], "STUDY_SESSION_ACTIVE")

    def test_invalid_or_unsupported_requests_are_rejected_before_lifecycle_gating(self) -> None:
        runtime, _, _, _ = self.make_runtime()

        invalid = runtime.dispatch({"action": "session.next"})
        unsupported = runtime.dispatch(
            {
                "version": 1,
                "action": "not.supported",
                "requestId": "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
                "params": {},
            }
        )

        self.assertEqual(invalid["error"]["code"], "INVALID_REQUEST")
        self.assertEqual(unsupported["error"]["code"], "ACTION_NOT_SUPPORTED")


if __name__ == "__main__":
    unittest.main()
