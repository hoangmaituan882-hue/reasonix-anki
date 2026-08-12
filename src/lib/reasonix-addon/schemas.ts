import { z } from "zod";

export const cardKindSchema = z.enum([
  "vocabulary",
  "word_sentence",
  "click",
  "sentence",
  "audio",
  "unknown",
]);
export type CardKind = z.infer<typeof cardKindSchema>;

const remainingSchema = z.object({
  new: z.number().int().nonnegative(),
  learning: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
});

export const addonRequestSchema = z.object({
  version: z.literal(1),
  action: z.string().min(1),
  requestId: z.string().uuid(),
  token: z.string().min(1).optional(),
  params: z.unknown(),
});
export type AddonRequest = z.infer<typeof addonRequestSchema>;

export const statusRequestSchema = addonRequestSchema.extend({
  action: z.literal("status"),
  params: z.object({}).strict(),
});
export type StatusRequest = z.infer<typeof statusRequestSchema>;

const healthErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  at: z.number().nonnegative(),
});

const healthSyncSchema = z.object({
  state: z.enum(["idle", "starting", "syncing", "finished", "error"]),
  attempts: z.number().int().nonnegative(),
  requestedAt: z.number().nonnegative().nullable(),
  startedAt: z.number().nonnegative().nullable(),
  finishedAt: z.number().nonnegative().nullable(),
  error: z.string().nullable(),
});

const addonHealthSchema = z.object({
  serviceState: z.enum(["stopped", "starting", "listening", "error"]),
  threadAlive: z.boolean().nullable(),
  startedAt: z.number().nonnegative().nullable(),
  lastRequestAt: z.number().nonnegative().nullable(),
  lastHeartbeatAt: z.number().nonnegative().nullable(),
  requestCount: z.number().int().nonnegative(),
  failedRequestCount: z.number().int().nonnegative(),
  lastError: healthErrorSchema.nullable(),
  sync: healthSyncSchema,
});

export const requestPermissionRequestSchema = addonRequestSchema.extend({
  action: z.literal("requestPermission"),
  params: z.object({}).strict(),
});
export type RequestPermissionRequest = z.infer<
  typeof requestPermissionRequestSchema
>;

const authenticatedSessionRequestSchema = addonRequestSchema.extend({
  token: z.string().min(1),
});

export const sessionStartRequestSchema = authenticatedSessionRequestSchema.extend({
  action: z.literal("session.start"),
  token: z.string().min(1),
  params: z
    .object({
      deckId: z.number().int().positive(),
    })
    .strict(),
});
export type SessionStartRequest = z.infer<typeof sessionStartRequestSchema>;

export const sessionNextRequestSchema = authenticatedSessionRequestSchema.extend({
  action: z.literal("session.next"),
  params: z
    .object({
      sessionId: z.string().min(1),
    })
    .strict(),
});
export type SessionNextRequest = z.infer<typeof sessionNextRequestSchema>;

export const sessionRevealRequestSchema = authenticatedSessionRequestSchema.extend({
  action: z.literal("session.reveal"),
  params: z
    .object({
      sessionId: z.string().min(1),
      expectedCardId: z.number().int().positive(),
    })
    .strict(),
});
export type SessionRevealRequest = z.infer<typeof sessionRevealRequestSchema>;

const nativeEaseSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const sessionAnswerRequestSchema = authenticatedSessionRequestSchema.extend({
  action: z.literal("session.answer"),
  token: z.string().min(1),
  params: z
    .object({
      sessionId: z.string().min(1),
      expectedCardId: z.number().int().positive(),
      ease: nativeEaseSchema,
    })
    .strict(),
});
export type SessionAnswerRequest = z.infer<typeof sessionAnswerRequestSchema>;

export const sessionUndoRequestSchema = authenticatedSessionRequestSchema.extend({
  action: z.literal("session.undo"),
  params: z
    .object({
      sessionId: z.string().min(1),
    })
    .strict(),
});
export type SessionUndoRequest = z.infer<typeof sessionUndoRequestSchema>;

export const sessionFinishRequestSchema = authenticatedSessionRequestSchema.extend({
  action: z.literal("session.finish"),
  params: z
    .object({
      sessionId: z.string().min(1),
    })
    .strict(),
});
export type SessionFinishRequest = z.infer<typeof sessionFinishRequestSchema>;

export const syncStartRequestSchema = authenticatedSessionRequestSchema.extend({
  action: z.literal("sync.start"),
  params: z.object({}).strict(),
});
export type SyncStartRequest = z.infer<typeof syncStartRequestSchema>;

export const syncStatusRequestSchema = authenticatedSessionRequestSchema.extend({
  action: z.literal("sync.status"),
  params: z.object({}).strict(),
});
export type SyncStatusRequest = z.infer<typeof syncStatusRequestSchema>;

export const addonErrorResponseSchema = z.object({
  result: z.null(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type AddonErrorResponse = z.infer<typeof addonErrorResponseSchema>;

export const statusResponseSchema = z.object({
  result: z.object({
    addonVersion: z.string().min(1),
    protocolVersion: z.literal(1),
    ankiVersion: z.string(),
    profileKey: z.string().nullable(),
    profileName: z.string().nullable(),
    collectionState: z.enum(["open", "closed", "temporarilyClosed"]),
    syncState: z.enum(["idle", "syncing", "error"]),
    capabilities: z.array(z.string().min(1)),
    health: addonHealthSchema.optional(),
  }),
  error: z.null(),
});
export type StatusResponse = z.infer<typeof statusResponseSchema>;

const grantedPermissionResultSchema = z.object({
  permission: z.literal("granted"),
  token: z.string().min(1),
});

const deniedPermissionResultSchema = z.object({
  permission: z.literal("denied"),
  token: z.never().optional(),
});

export const requestPermissionResponseSchema = z.object({
  result: z.union([
    grantedPermissionResultSchema,
    deniedPermissionResultSchema,
  ]),
  error: z.null(),
});
export type RequestPermissionResponse = z.infer<
  typeof requestPermissionResponseSchema
>;

const studyCardSchema = z.object({
  cardId: z.number().int().positive(),
  noteId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  modelId: z.number().int().positive(),
  modelName: z.string(),
  templateOrd: z.number().int().nonnegative(),
  templateName: z.string(),
  queue: z.number().int(),
  type: z.number().int(),
  cardKind: cardKindSchema,
  fields: z.record(z.string(), z.string()),
  tags: z.array(z.string()),
  question: z.string(),
  answer: z.string(),
  media: z.array(z.string()),
});
export type StudyCard = z.infer<typeof studyCardSchema>;

export const sessionNextResponseSchema = z.object({
  result: z.object({
    sessionId: z.string().min(1),
    card: studyCardSchema,
    remaining: remainingSchema,
  }),
  error: z.null(),
});
export type SessionNextResponse = z.infer<typeof sessionNextResponseSchema>;

const intervalSchema = z.object({
  seconds: z.number().int().nonnegative().optional(),
  label: z.string().min(1),
});

export const sessionRevealResponseSchema = z.object({
  result: z.object({
    cardId: z.number().int().positive(),
    intervals: z.object({
      "1": intervalSchema,
      "2": intervalSchema,
      "3": intervalSchema,
      "4": intervalSchema,
    }),
  }),
  error: z.null(),
});
export type SessionRevealResponse = z.infer<typeof sessionRevealResponseSchema>;

export const sessionStartResponseSchema = z.object({
  result: z.object({
    sessionId: z.string().min(1),
    profileKey: z.string().min(1),
  }),
  error: z.null(),
});
export type SessionStartResponse = z.infer<typeof sessionStartResponseSchema>;

export const sessionAnswerResponseSchema = z.object({
  result: z.object({
    answeredCardId: z.number().int().positive(),
    ease: nativeEaseSchema,
  }),
  error: z.null(),
});
export type SessionAnswerResponse = z.infer<typeof sessionAnswerResponseSchema>;

export const sessionUndoResponseSchema = z.object({
  result: z.object({
    restoredCardId: z.number().int().positive(),
    card: studyCardSchema,
    remaining: remainingSchema,
  }),
  error: z.null(),
});
export type SessionUndoResponse = z.infer<typeof sessionUndoResponseSchema>;

export const sessionFinishResponseSchema = z.object({
  result: z.object({
    sessionId: z.string().min(1),
    answeredCards: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative().optional(),
    averageMs: z.number().int().nonnegative().optional(),
    ratings: z
      .object({
        "1": z.number().int().nonnegative(),
        "2": z.number().int().nonnegative(),
        "3": z.number().int().nonnegative(),
        "4": z.number().int().nonnegative(),
      })
      .optional(),
    forgottenRate: z.number().min(0).max(1).optional(),
    weakCardIds: z.array(z.number().int().positive()).optional(),
    tomorrowDue: z.number().int().nonnegative().nullable().optional(),
  }),
  error: z.null(),
});
export type SessionFinishResponse = z.infer<typeof sessionFinishResponseSchema>;

const syncStateSchema = z.enum(["starting", "syncing", "idle"]);
export const syncStartResponseSchema = z.object({
  result: z.object({ state: syncStateSchema }),
  error: z.null(),
});
export type SyncStartResponse = z.infer<typeof syncStartResponseSchema>;

export const syncStatusResponseSchema = z.object({
  result: z.object({
    state: z.enum(["idle", "syncing", "error"]),
    error: z.string().nullable(),
  }),
  error: z.null(),
});
export type SyncStatusResponse = z.infer<typeof syncStatusResponseSchema>;

export const decksTodayResponseSchema = z.object({
  result: z.object({
    deckId: z.number().int().positive(),
    new: z.number().int().nonnegative(),
    learning: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    tomorrowDue: z.number().int().nonnegative(),
  }),
  error: z.null(),
});
export type DecksTodayResponse = z.infer<typeof decksTodayResponseSchema>;

export function parseAddonRequest(value: unknown): AddonRequest {
  return addonRequestSchema.parse(value);
}

export function parseStatusRequest(value: unknown): StatusRequest {
  return statusRequestSchema.parse(value);
}

export function parseRequestPermissionRequest(
  value: unknown,
): RequestPermissionRequest {
  return requestPermissionRequestSchema.parse(value);
}

export function parseSessionAnswerRequest(value: unknown): SessionAnswerRequest {
  return sessionAnswerRequestSchema.parse(value);
}

export function parseSessionNextRequest(value: unknown): SessionNextRequest {
  return sessionNextRequestSchema.parse(value);
}

export function parseSessionRevealRequest(value: unknown): SessionRevealRequest {
  return sessionRevealRequestSchema.parse(value);
}

export function parseSessionUndoRequest(value: unknown): SessionUndoRequest {
  return sessionUndoRequestSchema.parse(value);
}

export function parseSessionFinishRequest(value: unknown): SessionFinishRequest {
  return sessionFinishRequestSchema.parse(value);
}

export function parseSyncStartRequest(value: unknown): SyncStartRequest {
  return syncStartRequestSchema.parse(value);
}

export function parseSyncStatusRequest(value: unknown): SyncStatusRequest {
  return syncStatusRequestSchema.parse(value);
}

export function parseSessionStartRequest(value: unknown): SessionStartRequest {
  return sessionStartRequestSchema.parse(value);
}

export function parseAddonErrorResponse(value: unknown): AddonErrorResponse {
  return addonErrorResponseSchema.parse(value);
}

export function parseStatusResponse(value: unknown): StatusResponse {
  return statusResponseSchema.parse(value);
}

export function parseRequestPermissionResponse(
  value: unknown,
): RequestPermissionResponse {
  return requestPermissionResponseSchema.parse(value);
}

export function parseSessionNextResponse(value: unknown): SessionNextResponse {
  return sessionNextResponseSchema.parse(value);
}

export function parseSessionRevealResponse(value: unknown): SessionRevealResponse {
  return sessionRevealResponseSchema.parse(value);
}

export function parseSessionStartResponse(value: unknown): SessionStartResponse {
  return sessionStartResponseSchema.parse(value);
}

export function parseSessionAnswerResponse(value: unknown): SessionAnswerResponse {
  return sessionAnswerResponseSchema.parse(value);
}

export function parseSessionUndoResponse(value: unknown): SessionUndoResponse {
  return sessionUndoResponseSchema.parse(value);
}

export function parseSessionFinishResponse(value: unknown): SessionFinishResponse {
  return sessionFinishResponseSchema.parse(value);
}

export function parseSyncStartResponse(value: unknown): SyncStartResponse {
  return syncStartResponseSchema.parse(value);
}

export function parseSyncStatusResponse(value: unknown): SyncStatusResponse {
  return syncStatusResponseSchema.parse(value);
}

export function parseDecksTodayResponse(value: unknown): DecksTodayResponse {
  return decksTodayResponseSchema.parse(value);
}
