import { afterEach, describe, expect, it, vi } from "vitest";

async function loadTransport() {
  const modulePath = "./transport";
  try {
    return await import(/* @vite-ignore */ modulePath);
  } catch {
    throw new Error("Reasonix addon transport is not implemented");
  }
}

const request = {
  version: 1,
  action: "session.next",
  requestId: "905aa70c-32af-4e71-b236-8897c36a1d9d",
  token: "qa-session-token",
  params: { sessionId: "study-session-1" },
} as const;

describe("Reasonix addon transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the complete versioned request through the browser proxy", async () => {
    const { reasonixCall } = await loadTransport();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { sessionId: "study-session-1" }, error: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await reasonixCall(request);

    expect(result).toEqual({ sessionId: "study-session-1" });
    expect(fetchMock).toHaveBeenCalledWith("/reasonix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  });

  it("throws a structured addon error without losing its code", async () => {
    const { reasonixCall, ReasonixAddonError } = await loadTransport();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: null,
          error: {
            code: "CARD_MISMATCH",
            message: "The active card does not match expectedCardId.",
            retryable: false,
            details: { activeCardId: 101 },
          },
        }),
      }),
    );

    const error = await reasonixCall(request).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ReasonixAddonError);
    expect(error.code).toBe("CARD_MISMATCH");
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ activeCardId: 101 });
  });

  it("normalizes connection failures", async () => {
    const { reasonixCall } = await loadTransport();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(reasonixCall(request)).rejects.toThrow(
      "无法连接 Reasonix Anki 插件（127.0.0.1:8766）",
    );
  });
});
