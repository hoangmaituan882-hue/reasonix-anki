import { describe, expect, it, vi } from "vitest";
import sessionNextFixture from "../../protocol/fixtures/v1/session-next.response.json";
import { parseSessionNextResponse } from "../lib/reasonix-addon/schemas";
import {
  createStudySessionStore,
  type StudySessionApi,
  type StudyMappingRepository,
} from "./studySession";

function createApi(): StudySessionApi {
  const next = parseSessionNextResponse(sessionNextFixture).result;
  return {
    status: vi.fn(async () => ({
      profileKey: "profile-a",
      collectionState: "open" as const,
      syncState: "idle" as const,
      capabilities: [
        "session.start",
        "session.next",
        "session.reveal",
        "session.answer",
        "session.undo",
        "session.finish",
      ],
    })),
    requestPermission: vi.fn(async () => ({
      permission: "granted" as const,
      token: "token-a",
    })),
    start: vi.fn(async () => ({
      sessionId: "session-a",
      profileKey: "profile-a",
    })),
    next: vi.fn(async () => next),
    reveal: vi.fn(),
    answer: vi.fn(),
    undo: vi.fn(),
    finish: vi.fn(),
  };
}

describe("study session start", () => {
  it("starts the native scheduler with deckId only and presents its head", async () => {
    const api = createApi();
    const store = createStudySessionStore(api);

    await store.getState().start(1781523613318, "Japanese");

    expect(api.start).toHaveBeenCalledTimes(1);
    const startInput = vi.mocked(api.start).mock.calls[0][0];
    expect(startInput.deckId).toBe(1781523613318);
    expect(Object.keys(startInput).sort()).toEqual([
      "deckId",
      "requestId",
      "token",
    ]);
    expect(store.getState()).toMatchObject({
      phase: "front",
      deckId: 1781523613318,
      deckName: "Japanese",
      sessionId: "session-a",
      profileKey: "profile-a",
      card: { cardId: 1782031602405 },
      word: { expressionHtml: "人間", cardKind: "vocabulary" },
      remaining: { new: 10, learning: 2, review: 35 },
      error: null,
    });
  });

  it("finishes a started session when the native queue is empty", async () => {
    const api = createApi();
    const complete = Object.assign(new Error("queue empty"), {
      code: "SESSION_COMPLETE",
    });
    vi.mocked(api.next).mockRejectedValue(complete);
    vi.mocked(api.finish).mockResolvedValue({
      sessionId: "session-a",
      answeredCards: 0,
    });
    const store = createStudySessionStore(api);

    await store.getState().start(1781523613318, "Japanese");

    expect(api.finish).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session-a", token: "token-a" }),
    );
    expect(store.getState()).toMatchObject({
      phase: "done",
      sessionId: null,
      answeredCards: 0,
      error: null,
    });
  });

  it("requests permission again when Anki has revoked the cached token", async () => {
    const api = createApi();
    const unauthorized = Object.assign(new Error("token revoked"), {
      code: "UNAUTHORIZED",
    });
    vi.mocked(api.start)
      .mockRejectedValueOnce(unauthorized)
      .mockResolvedValueOnce({ sessionId: "session-b", profileKey: "profile-a" });
    const store = createStudySessionStore(api);
    store.setState({ token: "stale-token" });

    await store.getState().start(1781523613318, "Japanese");

    expect(api.requestPermission).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.start).mock.calls.map(([input]) => input.token)).toEqual([
      "stale-token",
      "token-a",
    ]);
    expect(store.getState()).toMatchObject({
      phase: "front",
      sessionId: "session-b",
      token: "token-a",
      error: null,
    });
  });
});

describe("study session field mapping", () => {
  it("pauses for a non-standard model and persists the confirmed mapping", async () => {
    const api = createApi();
    const original = parseSessionNextResponse(sessionNextFixture).result;
    vi.mocked(api.next).mockResolvedValue({
      ...original,
      card: {
        ...original.card,
        modelId: 99,
        modelName: "自制日语",
        fields: { Word: "猫", Meaning: "<b>猫；cat</b>" },
      },
    });
    const mappings: StudyMappingRepository = {
      load: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
    };
    const store = createStudySessionStore(api, () => crypto.randomUUID(), mappings);

    await store.getState().start(original.card.deckId, "Japanese");

    expect(store.getState()).toMatchObject({ phase: "mapping", word: null });

    await store.getState().applyMapping({
      schemaVersion: 1,
      fields: { expression: "Word", mainDefinition: "Meaning" },
    });

    expect(store.getState()).toMatchObject({
      phase: "front",
      word: { expressionHtml: "猫", mainDefinitionHtml: "<b>猫；cat</b>" },
    });
    expect(mappings.save).toHaveBeenCalledWith(
      expect.objectContaining({
        profileKey: "profile-a",
        modelId: 99,
        fieldNames: ["Word", "Meaning"],
      }),
    );
  });
});

describe("study session review flow", () => {
  it("reveals, locks duplicate answers, advances only after confirmation, and undoes", async () => {
    const api = createApi();
    const first = parseSessionNextResponse(sessionNextFixture).result;
    const second = {
      ...first,
      card: { ...first.card, cardId: first.card.cardId + 1 },
      remaining: { new: 9, learning: 1, review: 35 },
    };
    vi.mocked(api.next)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    vi.mocked(api.reveal).mockResolvedValue({
      cardId: first.card.cardId,
      intervals: {
        "1": { label: "<1分" },
        "2": { label: "<6分" },
        "3": { label: "<10分" },
        "4": { label: "5天" },
      },
    });
    let confirmAnswer: (() => void) | undefined;
    vi.mocked(api.answer).mockImplementation(
      () =>
        new Promise((resolve) => {
          confirmAnswer = () =>
            resolve({ answeredCardId: first.card.cardId, ease: 3 });
        }),
    );
    vi.mocked(api.undo).mockResolvedValue({
      restoredCardId: first.card.cardId,
      card: first.card,
      remaining: first.remaining,
    });
    const store = createStudySessionStore(api);
    await store.getState().start(first.card.deckId, "Japanese");

    await store.getState().reveal();

    expect(api.reveal).toHaveBeenCalledWith(
      expect.objectContaining({ expectedCardId: first.card.cardId }),
    );
    expect(store.getState()).toMatchObject({
      phase: "back",
      intervals: { "3": { label: "<10分" } },
    });

    const answer = store.getState().answer(3);
    const duplicateClick = store.getState().answer(3);
    expect(store.getState().phase).toBe("answering");
    expect(api.answer).toHaveBeenCalledTimes(1);
    confirmAnswer?.();
    await Promise.all([answer, duplicateClick]);

    expect(store.getState()).toMatchObject({
      phase: "front",
      card: { cardId: second.card.cardId },
      answeredCards: 1,
      answerHistory: [{ cardId: first.card.cardId, ease: 3 }],
      canUndo: true,
    });

    await store.getState().undo();

    expect(store.getState()).toMatchObject({
      phase: "front",
      card: { cardId: first.card.cardId },
      remaining: first.remaining,
      answeredCards: 0,
      answerHistory: [],
      canUndo: false,
    });
  });

  it("keeps the native finish report and starts sync after releasing the session", async () => {
    const api = createApi();
    vi.mocked(api.status).mockResolvedValue({
      profileKey: "profile-a",
      profileName: "Japanese",
      collectionState: "open",
      syncState: "idle",
      capabilities: [
        "session.start",
        "session.next",
        "session.reveal",
        "session.answer",
        "session.undo",
        "session.finish",
        "sync.start",
      ],
    });
    vi.mocked(api.finish).mockResolvedValue({
      sessionId: "session-a",
      answeredCards: 4,
      durationMs: 120000,
      averageMs: 30000,
      ratings: { "1": 1, "2": 0, "3": 2, "4": 1 },
      forgottenRate: 0.25,
      weakCardIds: [1782031602405],
      tomorrowDue: 9,
    });
    api.syncStart = vi.fn(async () => ({ state: "starting" as const }));
    const store = createStudySessionStore(api);
    await store.getState().start(1781523613318, "Japanese");

    await store.getState().finish();

    expect(api.syncStart).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token-a" }),
    );
    expect(store.getState()).toMatchObject({
      phase: "done",
      sessionId: null,
      syncState: "syncing",
      report: {
        answeredCards: 4,
        durationMs: 120000,
        tomorrowDue: 9,
      },
    });
  });

  it("reuses one sync request id when a transport retry is needed", async () => {
    vi.useFakeTimers();
    try {
      const api = createApi();
      vi.mocked(api.status).mockResolvedValue({
        profileKey: "profile-a",
        profileName: "Japanese",
        collectionState: "open",
        syncState: "idle",
        capabilities: [
          "session.start",
          "session.next",
          "session.reveal",
          "session.answer",
          "session.undo",
          "session.finish",
          "sync.start",
        ],
      });
      vi.mocked(api.finish).mockResolvedValue({
        sessionId: "session-a",
        answeredCards: 1,
      });
      api.syncStart = vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary transport failure"))
        .mockResolvedValue({ state: "starting" as const });
      const store = createStudySessionStore(api);
      await store.getState().start(1781523613318, "Japanese");

      const finishing = store.getState().finish();
      await vi.runAllTimersAsync();
      await finishing;

      const calls = vi.mocked(api.syncStart).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0].requestId).toBe(calls[1][0].requestId);
    } finally {
      vi.useRealTimers();
    }
  });

  it("monitors a started sync until the addon reports idle", async () => {
    vi.useFakeTimers();
    try {
      const api = createApi();
      vi.mocked(api.status).mockResolvedValue({
        profileKey: "profile-a",
        profileName: "Japanese",
        collectionState: "open",
        syncState: "idle",
        capabilities: [
          "session.start",
          "session.next",
          "session.reveal",
          "session.answer",
          "session.undo",
          "session.finish",
          "sync.start",
        ],
      });
      vi.mocked(api.finish).mockResolvedValue({
        sessionId: "session-a",
        answeredCards: 1,
      });
      api.syncStart = vi.fn(async () => ({ state: "starting" as const }));
      api.syncStatus = vi.fn(async () => ({ state: "idle" as const, error: null }));
      const store = createStudySessionStore(api);
      await store.getState().start(1781523613318, "Japanese");

      await store.getState().finish();
      expect(store.getState().syncState).toBe("syncing");
      await vi.runAllTimersAsync();

      expect(api.syncStatus).toHaveBeenCalledTimes(1);
      expect(store.getState().syncState).toBe("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reconnects to the existing scheduler session after a transport error", async () => {
    const api = createApi();
    const next = parseSessionNextResponse(sessionNextFixture).result;
    const store = createStudySessionStore(api);
    await store.getState().start(next.card.deckId, "Japanese");
    store.setState({ phase: "error", card: null, word: null, remaining: null });

    await store.getState().resume();

    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.next).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({
      phase: "front",
      sessionId: "session-a",
      card: { cardId: next.card.cardId },
      error: null,
    });
  });
});
