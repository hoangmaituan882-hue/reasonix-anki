"""Loopback-only JSON HTTP boundary for the Reasonix companion addon."""

from __future__ import annotations

import json
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


MAX_BODY_BYTES = 1024 * 1024
DRAIN_CHUNK_BYTES = 64 * 1024
DRAIN_TIMEOUT_SECONDS = 2.0


def _error(code: str, message: str) -> dict[str, object]:
    return {
        "result": None,
        "error": {
            "code": code,
            "message": message,
            "retryable": False,
        },
    }


class AddonHttpServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        server_address: tuple[str, int],
        dispatcher: Callable[[object], dict[str, object]],
    ) -> None:
        self.dispatcher = dispatcher
        super().__init__(server_address, AddonRequestHandler)


class AddonRequestHandler(BaseHTTPRequestHandler):
    server: AddonHttpServer

    def _send(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(
            payload, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if self.path != "/":
            self._send(404, _error("NOT_FOUND", "Only POST / is supported."))
            return
        if self.headers.get_content_type() != "application/json":
            self._send(
                415,
                _error(
                    "UNSUPPORTED_MEDIA_TYPE",
                    "Content-Type must be application/json.",
                ),
            )
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send(400, _error("INVALID_LENGTH", "Content-Length is invalid."))
            return
        if content_length < 0:
            self._send(400, _error("INVALID_LENGTH", "Content-Length is invalid."))
            return
        if content_length > MAX_BODY_BYTES:
            # On Windows, closing a socket with unread inbound data can turn a
            # valid 413 response into WSAECONNABORTED at the client.  Drain in
            # fixed-size chunks with a short timeout before closing; the body
            # is never retained or parsed.
            previous_timeout = self.connection.gettimeout()
            try:
                self.connection.settimeout(DRAIN_TIMEOUT_SECONDS)
                remaining = content_length
                while remaining:
                    chunk = self.rfile.read(min(DRAIN_CHUNK_BYTES, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
            except (OSError, TimeoutError):
                pass
            finally:
                self.connection.settimeout(previous_timeout)
            self.close_connection = True
            self._send(
                413,
                _error("PAYLOAD_TOO_LARGE", "Request body exceeds one megabyte."),
            )
            return
        try:
            payload: Any = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send(400, _error("INVALID_JSON", "Request body is not valid JSON."))
            return

        try:
            response = self.server.dispatcher(payload)
        except Exception:
            self._send(
                500,
                {
                    "result": None,
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "The addon could not process the request.",
                        "retryable": True,
                    },
                },
            )
            return
        self._send(200, response)

    def do_GET(self) -> None:
        self._send(405, _error("METHOD_NOT_ALLOWED", "Use POST with JSON."))

    def log_message(self, format: str, *args: object) -> None:
        return
