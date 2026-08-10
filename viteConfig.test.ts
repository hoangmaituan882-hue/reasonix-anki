// @vitest-environment node

import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import configFactory from "./vite.config";

describe("Vite Anki proxy", () => {
  it("removes the browser Origin before forwarding to loopback services", async () => {
    const config =
      typeof configFactory === "function"
        ? await configFactory({ command: "serve", mode: "test" })
        : configFactory;
    const proxy = config.server?.proxy?.["/anki"];
    expect(proxy).toBeTypeOf("object");

    const emitter = new EventEmitter();
    const configure = (proxy as { configure?: (server: EventEmitter) => void })
      .configure;
    expect(configure).toBeTypeOf("function");
    configure?.(emitter);

    const request = { removeHeader: vi.fn() };
    emitter.emit("proxyReq", request);

    expect(request.removeHeader).toHaveBeenCalledWith("origin");
  });
});
