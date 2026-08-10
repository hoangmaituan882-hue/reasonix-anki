import {
  parseRequestPermissionResponse,
  parseStatusResponse,
  parseSessionStartResponse,
  parseSessionNextResponse,
  parseSessionRevealResponse,
  parseSessionAnswerResponse,
  parseSessionUndoResponse,
  parseSessionFinishResponse,
  parseSyncStartResponse,
  parseSyncStatusResponse,
  type RequestPermissionResponse,
  type StatusResponse,
  type AddonRequest,
} from "./schemas";
import { reasonixCall } from "./transport";

function request(
  action: "status" | "requestPermission",
  requestId: string,
): AddonRequest {
  return {
    version: 1,
    action,
    requestId,
    params: {},
  };
}

type NativeEase = 1 | 2 | 3 | 4;

function authenticatedRequest(
  action: string,
  requestId: string,
  token: string,
  params: Record<string, unknown>,
): AddonRequest {
  return { version: 1, action, requestId, token, params };
}

function resultEnvelope(result: unknown): { result: unknown; error: null } {
  return { result, error: null };
}

export async function reasonixStatus(
  requestId: string,
): Promise<StatusResponse["result"]> {
  const response = parseStatusResponse(
    {
      result: await reasonixCall<unknown>(request("status", requestId)),
      error: null,
    },
  );
  return response.result;
}

export async function reasonixRequestPermission(
  requestId: string,
): Promise<RequestPermissionResponse["result"]> {
  const response = parseRequestPermissionResponse(
    {
      result: await reasonixCall<unknown>(
        request("requestPermission", requestId),
      ),
      error: null,
    },
  );
  return response.result;
}

export async function reasonixSessionStart(input: {
  requestId: string;
  token: string;
  deckId: number;
}): Promise<ReturnType<typeof parseSessionStartResponse>["result"]> {
  const response = parseSessionStartResponse(
    resultEnvelope(
      await reasonixCall<unknown>(
        authenticatedRequest("session.start", input.requestId, input.token, {
          deckId: input.deckId,
        }),
      ),
    ),
  );
  return response.result;
}

export async function reasonixSessionNext(input: {
  requestId: string;
  token: string;
  sessionId: string;
}): Promise<ReturnType<typeof parseSessionNextResponse>["result"]> {
  const response = parseSessionNextResponse(
    resultEnvelope(
      await reasonixCall<unknown>(
        authenticatedRequest("session.next", input.requestId, input.token, {
          sessionId: input.sessionId,
        }),
      ),
    ),
  );
  return response.result;
}

export async function reasonixSessionReveal(input: {
  requestId: string;
  token: string;
  sessionId: string;
  expectedCardId: number;
}): Promise<ReturnType<typeof parseSessionRevealResponse>["result"]> {
  const response = parseSessionRevealResponse(
    resultEnvelope(
      await reasonixCall<unknown>(
        authenticatedRequest("session.reveal", input.requestId, input.token, {
          sessionId: input.sessionId,
          expectedCardId: input.expectedCardId,
        }),
      ),
    ),
  );
  return response.result;
}

export async function reasonixSessionAnswer(input: {
  requestId: string;
  token: string;
  sessionId: string;
  expectedCardId: number;
  ease: NativeEase;
}): Promise<ReturnType<typeof parseSessionAnswerResponse>["result"]> {
  const response = parseSessionAnswerResponse(
    resultEnvelope(
      await reasonixCall<unknown>(
        authenticatedRequest("session.answer", input.requestId, input.token, {
          sessionId: input.sessionId,
          expectedCardId: input.expectedCardId,
          ease: input.ease,
        }),
      ),
    ),
  );
  return response.result;
}

export async function reasonixSessionUndo(input: {
  requestId: string;
  token: string;
  sessionId: string;
}): Promise<ReturnType<typeof parseSessionUndoResponse>["result"]> {
  const response = parseSessionUndoResponse(
    resultEnvelope(
      await reasonixCall<unknown>(
        authenticatedRequest("session.undo", input.requestId, input.token, {
          sessionId: input.sessionId,
        }),
      ),
    ),
  );
  return response.result;
}

export async function reasonixSessionFinish(input: {
  requestId: string;
  token: string;
  sessionId: string;
}): Promise<ReturnType<typeof parseSessionFinishResponse>["result"]> {
  const response = parseSessionFinishResponse(
    resultEnvelope(
      await reasonixCall<unknown>(
        authenticatedRequest("session.finish", input.requestId, input.token, {
          sessionId: input.sessionId,
        }),
      ),
    ),
  );
  return response.result;
}

export async function reasonixSyncStart(input: {
  requestId: string;
  token: string;
}): Promise<ReturnType<typeof parseSyncStartResponse>["result"]> {
  const response = parseSyncStartResponse(
    resultEnvelope(
      await reasonixCall<unknown>(
        authenticatedRequest("sync.start", input.requestId, input.token, {}),
      ),
    ),
  );
  return response.result;
}

export async function reasonixSyncStatus(input: {
  requestId: string;
  token: string;
}): Promise<ReturnType<typeof parseSyncStatusResponse>["result"]> {
  const response = parseSyncStatusResponse(
    resultEnvelope(
      await reasonixCall<unknown>(
        authenticatedRequest("sync.status", input.requestId, input.token, {}),
      ),
    ),
  );
  return response.result;
}
