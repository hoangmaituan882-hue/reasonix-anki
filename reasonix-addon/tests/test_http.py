import importlib
import json
import threading
import unittest
from http.client import HTTPConnection


def load_http_module():
    try:
        return importlib.import_module("reasonix_addon.http")
    except ModuleNotFoundError as error:
        raise AssertionError("addon HTTP boundary is not implemented") from error


class AddonHttpTests(unittest.TestCase):
    def setUp(self) -> None:
        module = load_http_module()
        self.seen: list[object] = []

        def dispatch(request: object) -> dict[str, object]:
            self.seen.append(request)
            return {"result": {"ok": True}, "error": None}

        self.server = module.AddonHttpServer(("127.0.0.1", 0), dispatch)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.server.server_address

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def post(
        self,
        body: bytes,
        path: str = "/",
        content_type: str = "application/json",
    ):
        connection = HTTPConnection(self.host, self.port, timeout=2)
        connection.request(
            "POST",
            path,
            body=body,
            headers={"Content-Type": content_type},
        )
        response = connection.getresponse()
        payload = response.read()
        connection.close()
        return response.status, json.loads(payload.decode("utf-8"))

    def test_dispatches_json_and_returns_a_protocol_envelope(self) -> None:
        request = {"version": 1, "action": "status", "params": {}}

        status, payload = self.post(json.dumps(request).encode("utf-8"))

        self.assertEqual(status, 200)
        self.assertEqual(payload, {"result": {"ok": True}, "error": None})
        self.assertEqual(self.seen, [request])

    def test_loopback_server_allows_rebinding_after_a_clean_restart(self) -> None:
        self.assertTrue(self.server.allow_reuse_address)

    def test_invalid_json_is_rejected_without_dispatching(self) -> None:
        status, payload = self.post(b"not-json")

        self.assertEqual(status, 400)
        self.assertIsNone(payload["result"])
        self.assertEqual(payload["error"]["code"], "INVALID_JSON")
        self.assertEqual(self.seen, [])

    def test_non_json_content_type_is_rejected_without_dispatching(self) -> None:
        status, payload = self.post(b"{}", content_type="text/plain")

        self.assertEqual(status, 415)
        self.assertEqual(payload["error"]["code"], "UNSUPPORTED_MEDIA_TYPE")
        self.assertEqual(self.seen, [])

    def test_payload_over_one_megabyte_is_rejected(self) -> None:
        status, payload = self.post(b"{" + b"a" * (1024 * 1024) + b"}")

        self.assertEqual(status, 413)
        self.assertEqual(payload["error"]["code"], "PAYLOAD_TOO_LARGE")
        self.assertEqual(self.seen, [])

    def test_non_post_requests_are_not_dispatched(self) -> None:
        connection = HTTPConnection(self.host, self.port, timeout=2)
        connection.request("GET", "/")
        response = connection.getresponse()
        response.read()
        connection.close()

        self.assertEqual(response.status, 405)
        self.assertEqual(self.seen, [])

    def test_negative_content_length_is_rejected_without_reading(self) -> None:
        connection = HTTPConnection(self.host, self.port, timeout=2)
        connection.putrequest("POST", "/")
        connection.putheader("Content-Type", "application/json")
        connection.putheader("Content-Length", "-1")
        connection.endheaders()

        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        connection.close()

        self.assertEqual(response.status, 400)
        self.assertEqual(payload["error"]["code"], "INVALID_LENGTH")
        self.assertEqual(self.seen, [])


if __name__ == "__main__":
    unittest.main()
