import { afterEach, describe, expect, it, vi } from "vitest";

describe("Reasonix addon control client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests status with an unauthenticated exact envelope and validates it", async () => {
    const { reasonixStatus } = await import("./client");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          addonVersion: "0.1.0",
          protocolVersion: 1,
          ankiVersion: "25.09.2",
          profileKey: null,
          profileName: null,
          collectionState: "closed",
          syncState: "idle",
          capabilities: ["status", "requestPermission"],
        },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await reasonixStatus(
      "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
    );

    expect(result.profileName).toBeNull();
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({
        version: 1,
        action: "status",
        requestId: "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
        params: {},
      }),
    );
  });

  it("requests permission and preserves the issued token", async () => {
    const { reasonixRequestPermission } = await import("./client");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: { permission: "granted", token: "qa-session-token" },
          error: null,
        }),
      }),
    );

    const result = await reasonixRequestPermission(
      "f6b5db80-58f7-4dbb-8d9b-6dcf0adf0d9c",
    );

    expect(result).toEqual({ permission: "granted", token: "qa-session-token" });
  });

  it("submits a native ease with expectedCardId and returns the answer result", async () => {
    const { reasonixSessionAnswer } = await import("./client");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { answeredCardId: 1782031602405, ease: 3 },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await reasonixSessionAnswer({
      requestId: "881b99e4-ef1e-4b1b-a267-1fc59af6a59c",
      token: "qa-session-token",
      sessionId: "study-session-1",
      expectedCardId: 1782031602405,
      ease: 3,
    });

    expect(result).toEqual({ answeredCardId: 1782031602405, ease: 3 });
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({
        version: 1,
        action: "session.answer",
        requestId: "881b99e4-ef1e-4b1b-a267-1fc59af6a59c",
        token: "qa-session-token",
        params: {
          sessionId: "study-session-1",
          expectedCardId: 1782031602405,
          ease: 3,
        },
      }),
    );
  });

  it("starts and reads sync through authenticated versioned requests", async () => {
    const { reasonixSyncStart, reasonixSyncStatus } = await import("./client");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { state: "starting" }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { state: "idle", error: null }, error: null }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await reasonixSyncStart({
      requestId: "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
      token: "qa-session-token",
    });
    await reasonixSyncStatus({
      requestId: "f6b5db80-58f7-4dbb-8d9b-6dcf0adf0d9c",
      token: "qa-session-token",
    });

    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      {
        version: 1,
        action: "sync.start",
        requestId: "b9c1905c-2a6b-4c1b-a48d-3df39ee76b2c",
        token: "qa-session-token",
        params: {},
      },
      {
        version: 1,
        action: "sync.status",
        requestId: "f6b5db80-58f7-4dbb-8d9b-6dcf0adf0d9c",
        token: "qa-session-token",
        params: {},
      },
    ]);
  });
});
