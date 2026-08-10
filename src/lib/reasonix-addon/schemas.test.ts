import { describe, expect, it } from "vitest";
import errorResponse from "../../../protocol/fixtures/v1/error.response.json";
import sessionAnswerRequest from "../../../protocol/fixtures/v1/session-answer.request.json";
import sessionFinishRequest from "../../../protocol/fixtures/v1/session-finish.request.json";
import sessionNextResponse from "../../../protocol/fixtures/v1/session-next.response.json";
import sessionNextRequest from "../../../protocol/fixtures/v1/session-next.request.json";
import sessionRevealRequest from "../../../protocol/fixtures/v1/session-reveal.request.json";
import sessionRevealResponse from "../../../protocol/fixtures/v1/session-reveal.response.json";
import sessionStartRequest from "../../../protocol/fixtures/v1/session-start.request.json";
import sessionUndoRequest from "../../../protocol/fixtures/v1/session-undo.request.json";
import statusRequest from "../../../protocol/fixtures/v1/status.request.json";
import statusResponse from "../../../protocol/fixtures/v1/status.response.json";
import permissionRequest from "../../../protocol/fixtures/v1/request-permission.request.json";
import permissionResponse from "../../../protocol/fixtures/v1/request-permission.response.json";
import sessionStartResponse from "../../../protocol/fixtures/v1/session-start.response.json";
import sessionAnswerResponse from "../../../protocol/fixtures/v1/session-answer.response.json";
import sessionUndoResponse from "../../../protocol/fixtures/v1/session-undo.response.json";
import sessionFinishResponse from "../../../protocol/fixtures/v1/session-finish.response.json";
import syncStartRequest from "../../../protocol/fixtures/v1/sync-start.request.json";
import syncStartResponse from "../../../protocol/fixtures/v1/sync-start.response.json";
import syncStatusRequest from "../../../protocol/fixtures/v1/sync-status.request.json";
import syncStatusResponse from "../../../protocol/fixtures/v1/sync-status.response.json";
import {
  parseAddonErrorResponse,
  parseAddonRequest,
  parseSessionAnswerRequest,
  parseSessionFinishRequest,
  parseSessionNextRequest,
  parseSessionNextResponse,
  parseSessionRevealRequest,
  parseSessionRevealResponse,
  parseSessionStartRequest,
  parseSessionUndoRequest,
  parseStatusRequest,
  parseStatusResponse,
  parseRequestPermissionRequest,
  parseRequestPermissionResponse,
  parseSessionStartResponse,
  parseSessionAnswerResponse,
  parseSessionUndoResponse,
  parseSessionFinishResponse,
  parseSyncStartRequest,
  parseSyncStartResponse,
  parseSyncStatusRequest,
  parseSyncStatusResponse,
} from "./schemas";

describe("Reasonix addon protocol v1 golden fixtures", () => {
  it("accepts a versioned session.start request", () => {
    const request = parseSessionStartRequest(sessionStartRequest);

    expect(request.action).toBe("session.start");
    expect(request.params).toEqual({
      deckId: 1781523613318,
    });
    expect(() =>
      parseSessionStartRequest({
        ...sessionStartRequest,
        params: { deckId: 1781523613318, mode: "mixed" },
      }),
    ).toThrow();
  });

  it("accepts unauthenticated status and permission negotiation fixtures", () => {
    expect(parseStatusRequest(statusRequest).action).toBe("status");
    expect(parseRequestPermissionRequest(permissionRequest).action).toBe(
      "requestPermission",
    );
    expect(parseStatusResponse(statusResponse).result.collectionState).toBe("open");
    expect(parseRequestPermissionResponse(permissionResponse).result.permission).toBe(
      "granted",
    );
  });

  it("accepts additive runtime health monitoring in status", () => {
    const parsed = parseStatusResponse({
      ...statusResponse,
      result: {
        ...statusResponse.result,
        health: {
          serviceState: "listening",
          threadAlive: true,
          startedAt: 1,
          lastRequestAt: 2,
          lastHeartbeatAt: 2,
          requestCount: 8,
          failedRequestCount: 1,
          lastError: null,
          sync: {
            state: "finished",
            attempts: 1,
            requestedAt: 3,
            startedAt: 4,
            finishedAt: 5,
            error: null,
          },
        },
      },
    });

    expect(parsed.result.health?.serviceState).toBe("listening");
    expect(parsed.result.health?.sync.state).toBe("finished");
  });

  it("accepts a Lapis session.next response", () => {
    const response = parseSessionNextResponse(sessionNextResponse);

    expect(response.result.card.cardKind).toBe("vocabulary");
    expect(response.result.card.fields.Expression).toBe("人間");
    expect(response.result.remaining).toEqual({
      new: 10,
      learning: 2,
      review: 35,
    });
  });

  it("accepts all session command success responses", () => {
    expect(parseSessionStartResponse(sessionStartResponse).result.sessionId).toBe(
      "study-session-1",
    );
    expect(parseSessionAnswerResponse(sessionAnswerResponse).result.ease).toBe(3);
    expect(parseSessionUndoResponse(sessionUndoResponse).result.restoredCardId).toBe(
      1782031602405,
    );
    expect(parseSessionFinishResponse(sessionFinishResponse).result.answeredCards).toBe(
      12,
    );
    expect(parseSessionFinishResponse(sessionFinishResponse).result.ratings?.["3"]).toBe(6);
    expect(parseSessionFinishResponse(sessionFinishResponse).result.tomorrowDue).toBe(8);
  });

  it("accepts authenticated sync lifecycle fixtures", () => {
    expect(parseSyncStartRequest(syncStartRequest).action).toBe("sync.start");
    expect(parseSyncStatusRequest(syncStatusRequest).action).toBe("sync.status");
    expect(parseSyncStartResponse(syncStartResponse).result.state).toBe("starting");
    expect(parseSyncStatusResponse(syncStatusResponse).result.state).toBe("syncing");
  });

  it("requires a token and exact params for next, reveal, undo, and finish", () => {
    expect(parseSessionNextRequest(sessionNextRequest).params.sessionId).toBe(
      "study-session-1",
    );
    expect(
      parseSessionRevealRequest(sessionRevealRequest).params.expectedCardId,
    ).toBe(1782031602405);
    expect(parseSessionUndoRequest(sessionUndoRequest).action).toBe("session.undo");
    expect(parseSessionFinishRequest(sessionFinishRequest).action).toBe(
      "session.finish",
    );

    for (const request of [
      sessionNextRequest,
      sessionRevealRequest,
      sessionUndoRequest,
      sessionFinishRequest,
    ]) {
      const { token: _token, ...withoutToken } = request;
      expect(() => parseAddonRequest(withoutToken)).not.toThrow();
      const parser =
        request.action === "session.next"
          ? parseSessionNextRequest
          : request.action === "session.reveal"
            ? parseSessionRevealRequest
            : request.action === "session.undo"
              ? parseSessionUndoRequest
              : parseSessionFinishRequest;
      expect(() => parser(withoutToken)).toThrow();
      expect(() =>
        parser({ ...request, params: { ...request.params, unexpected: true } }),
      ).toThrow();
    }
  });

  it("accepts four native scheduler intervals", () => {
    const response = parseSessionRevealResponse(sessionRevealResponse);

    expect(Object.keys(response.result.intervals)).toEqual(["1", "2", "3", "4"]);
    expect(response.result.intervals["3"].seconds).toBe(345600);
  });

  it("treats scheduler labels as authoritative and seconds as optional", () => {
    const response = parseSessionRevealResponse({
      ...sessionRevealResponse,
      result: {
        ...sessionRevealResponse.result,
        intervals: Object.fromEntries(
          Object.entries(sessionRevealResponse.result.intervals).map(([ease, interval]) => [
            ease,
            { label: interval.label },
          ]),
        ),
      },
    });

    expect(response.result.intervals["1"].label).toBe("1 分钟");
    expect(response.result.intervals["1"].seconds).toBeUndefined();
  });

  it("rejects unsupported protocol versions", () => {
    expect(() =>
      parseAddonRequest({
        ...sessionStartRequest,
        version: 2,
      }),
    ).toThrow();
  });

  it("requires expectedCardId and a native Anki ease for session.answer", () => {
    const request = parseSessionAnswerRequest(sessionAnswerRequest);

    expect(request.params.expectedCardId).toBe(1782031602405);
    expect(request.params.ease).toBe(3);
    expect(() =>
      parseSessionAnswerRequest({
        ...sessionAnswerRequest,
        params: { sessionId: "study-session-1", ease: 3 },
      }),
    ).toThrow();
    expect(() =>
      parseSessionAnswerRequest({
        ...sessionAnswerRequest,
        params: {
          sessionId: "study-session-1",
          expectedCardId: 1782031602405,
          ease: 5,
        },
      }),
    ).toThrow();
  });

  it("parses a structured protocol error", () => {
    const response = parseAddonErrorResponse(errorResponse);

    expect(response.error.code).toBe("CARD_MISMATCH");
    expect(response.error.retryable).toBe(false);
  });
});
