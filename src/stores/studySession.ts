import { create } from "zustand";
import type {
  JapaneseWordRecord,
  VocabularyFieldMapping,
} from "../features/vocabulary/lapisAdapter";
import {
  detectStandardLapisMapping,
  toJapaneseWordRecord,
} from "../features/vocabulary/lapisAdapter";
import { vocabularyMappings } from "../lib/db/mappings";
import {
  reasonixRequestPermission,
  reasonixSessionAnswer,
  reasonixSessionFinish,
  reasonixSessionNext,
  reasonixSessionReveal,
  reasonixSessionStart,
  reasonixSessionUndo,
  reasonixSyncStart,
  reasonixSyncStatus,
  reasonixStatus,
} from "../lib/reasonix-addon/client";
import { withRetry } from "../lib/reasonix-addon/retry";
import type {
  SessionFinishResponse,
  SessionNextResponse,
  SessionRevealResponse,
  StudyCard,
} from "../lib/reasonix-addon/schemas";

export type NativeEase = 1 | 2 | 3 | 4;
export type StudyReport = SessionFinishResponse["result"];
export type StudyAnswerRecord = {
  cardId: number;
  ease: NativeEase;
  answeredAt: number;
};
export type StudyPhase =
  | "idle"
  | "starting"
  | "front"
  | "revealing"
  | "back"
  | "answering"
  | "undoing"
  | "mapping"
  | "done"
  | "error";

export interface StudySessionApi {
  status(requestId: string): Promise<{
    profileKey: string | null;
    profileName?: string | null;
    collectionState: "open" | "closed" | "temporarilyClosed";
    syncState: "idle" | "syncing" | "error";
    capabilities: string[];
  }>;
  requestPermission(requestId: string): Promise<
    | { permission: "granted"; token: string }
    | { permission: "denied" }
  >;
  start(input: {
    requestId: string;
    token: string;
    deckId: number;
  }): Promise<{ sessionId: string; profileKey: string }>;
  next(input: {
    requestId: string;
    token: string;
    sessionId: string;
  }): Promise<SessionNextResponse["result"]>;
  reveal(input: {
    requestId: string;
    token: string;
    sessionId: string;
    expectedCardId: number;
  }): Promise<SessionRevealResponse["result"]>;
  answer(input: {
    requestId: string;
    token: string;
    sessionId: string;
    expectedCardId: number;
    ease: NativeEase;
  }): Promise<{ answeredCardId: number; ease: NativeEase }>;
  undo(input: {
    requestId: string;
    token: string;
    sessionId: string;
  }): Promise<{
    restoredCardId: number;
    card: StudyCard;
    remaining: SessionNextResponse["result"]["remaining"];
  }>;
  finish(input: {
    requestId: string;
    token: string;
    sessionId: string;
  }): Promise<StudyReport>;
  syncStart?(input: { requestId: string; token: string }): Promise<{
    state: "starting" | "syncing" | "idle";
  }>;
  syncStatus?(input: { requestId: string; token: string }): Promise<{
    state: "idle" | "syncing" | "error";
    error: string | null;
  }>;
}

export interface StudyMappingRepository {
  load(input: {
    profileKey: string;
    modelId: number;
    fieldNames: readonly string[];
  }): Promise<VocabularyFieldMapping | null>;
  save(input: {
    profileKey: string;
    modelId: number;
    fieldNames: readonly string[];
    mapping: VocabularyFieldMapping;
  }): Promise<void>;
}

export interface StudySessionState {
  phase: StudyPhase;
  deckId: number | null;
  deckName: string | null;
  sessionId: string | null;
  profileKey: string | null;
  profileName: string | null;
  token: string | null;
  card: StudyCard | null;
  word: JapaneseWordRecord | null;
  remaining: SessionNextResponse["result"]["remaining"] | null;
  intervals: SessionRevealResponse["result"]["intervals"] | null;
  answeredCards: number;
  answerHistory: StudyAnswerRecord[];
  report: StudyReport | null;
  syncState: "idle" | "syncing" | "error";
  canUndo: boolean;
  error: string | null;
  start(deckId: number, deckName: string): Promise<void>;
  reveal(): Promise<void>;
  answer(ease: NativeEase): Promise<void>;
  undo(): Promise<void>;
  finish(): Promise<void>;
  resume(): Promise<void>;
  applyMapping(mapping: VocabularyFieldMapping): Promise<void>;
  reset(): void;
}

const REQUIRED_CAPABILITIES = [
  "session.start",
  "session.next",
  "session.reveal",
  "session.answer",
  "session.undo",
  "session.finish",
] as const;

const defaultApi: StudySessionApi = {
  status: reasonixStatus,
  requestPermission: reasonixRequestPermission,
  start: reasonixSessionStart,
  next: reasonixSessionNext,
  reveal: reasonixSessionReveal,
  answer: reasonixSessionAnswer,
  undo: reasonixSessionUndo,
  finish: reasonixSessionFinish,
  syncStart: reasonixSyncStart,
  syncStatus: reasonixSyncStatus,
};

const defaultMappings: StudyMappingRepository = {
  async load(input) {
    return (await vocabularyMappings()).load(input);
  },
  async save(input) {
    await (await vocabularyMappings()).save(input);
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === code,
  );
}

export function createStudySessionStore(
  api: StudySessionApi = defaultApi,
  requestId: () => string = () => crypto.randomUUID(),
  mappings: StudyMappingRepository = defaultMappings,
) {
  const resolveWord = async (
    card: StudyCard,
    profileKey: string,
  ): Promise<JapaneseWordRecord | null> => {
    const standard = detectStandardLapisMapping(Object.keys(card.fields));
    if (standard) return toJapaneseWordRecord(card, standard);
    const saved = await mappings.load({
      profileKey,
      modelId: card.modelId,
      fieldNames: Object.keys(card.fields),
    });
    return saved ? toJapaneseWordRecord(card, saved) : null;
  };

  return create<StudySessionState>()((set, get) => {
    const completeSession = async (
      token: string,
      sessionId: string,
    ): Promise<StudyReport> => {
      const monitorSync = async (): Promise<void> => {
        const syncStatus = api.syncStatus;
        if (!syncStatus) return;
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1000));
          if (get().phase !== "done" || get().token !== token) return;
          try {
            const status = await syncStatus({
              requestId: requestId(),
              token,
            });
            if (status.state === "idle") {
              set({ syncState: "idle" });
              return;
            }
            if (status.state === "error") {
              set({ syncState: "error" });
              return;
            }
          } catch {
            if (attempt === 29) set({ syncState: "error" });
          }
        }
        if (get().phase === "done" && get().token === token) {
          set({ syncState: "error" });
        }
      };

      const report = await api.finish({
        requestId: requestId(),
        token,
        sessionId,
      });
      set((state) => ({
        phase: "done",
        sessionId: null,
        card: null,
        word: null,
        remaining: { new: 0, learning: 0, review: 0 },
        intervals: null,
        answeredCards: report.answeredCards,
        report,
        canUndo: false,
        syncState: "idle",
        error: null,
        answerHistory: state.answerHistory,
      }));
      if (get().profileName !== "Reasonix QA" && api.syncStart) {
        set({ syncState: "syncing" });
        try {
          const syncStart = api.syncStart;
          const syncRequestId = requestId();
          const syncResult = await withRetry(() =>
            syncStart({ requestId: syncRequestId, token }),
          );
          if (get().phase !== "done" || get().token !== token) {
            return report;
          }
          if (syncResult.state === "idle") {
            set({ syncState: "idle" });
          } else {
            void monitorSync();
          }
        } catch {
          if (get().phase === "done" && get().token === token) {
            set({ syncState: "error" });
          }
        }
      }
      return report;
    };

    return ({
    phase: "idle",
    deckId: null,
    deckName: null,
    sessionId: null,
    profileKey: null,
    profileName: null,
    token: null,
    card: null,
    word: null,
    remaining: null,
    intervals: null,
    answeredCards: 0,
    answerHistory: [],
    report: null,
    syncState: "idle",
    canUndo: false,
    error: null,
    start: async (deckId, deckName) => {
      if (get().phase === "starting") return;
      set({
        phase: "starting",
        deckId,
        deckName,
        sessionId: null,
        profileKey: null,
        profileName: null,
        card: null,
        word: null,
        remaining: null,
        intervals: null,
        answeredCards: 0,
        answerHistory: [],
        report: null,
        syncState: "idle",
        canUndo: false,
        error: null,
      });
      let started: { token: string; sessionId: string } | null = null;
      try {
        const status = await api.status(requestId());
        if (!status.profileKey || status.collectionState !== "open") {
          throw new Error("Anki 当前没有可用的 collection");
        }
        if (status.syncState !== "idle") {
          throw new Error("Anki 正在同步，请等待同步完成后开始学习");
        }
        set({ profileName: status.profileName ?? null, syncState: "idle" });
        const missing = REQUIRED_CAPABILITIES.filter(
          (capability) => !status.capabilities.includes(capability),
        );
        if (missing.length > 0) {
          throw new Error(`Reasonix 插件缺少能力：${missing.join(", ")}`);
        }

        const requestToken = async (): Promise<string> => {
          const permission = await api.requestPermission(requestId());
          if (permission.permission !== "granted") {
            throw new Error("Anki 未授予 Reasonix 学习会话权限");
          }
          return permission.token;
        };

        let token = get().token ?? (await requestToken());
        let session;
        try {
          session = await api.start({ requestId: requestId(), token, deckId });
        } catch (error) {
          if (!hasErrorCode(error, "UNAUTHORIZED")) throw error;
          set({ token: null });
          token = await requestToken();
          session = await api.start({ requestId: requestId(), token, deckId });
        }
        started = { token, sessionId: session.sessionId };
        if (session.profileKey !== status.profileKey) {
          throw new Error("启动学习时 Anki Profile 已发生变化");
        }
        const next = await api.next({
          requestId: requestId(),
          token,
          sessionId: session.sessionId,
        });
        const word = await resolveWord(next.card, session.profileKey);
        set({
          phase: word ? "front" : "mapping",
          token,
          sessionId: session.sessionId,
          profileKey: session.profileKey,
          card: next.card,
          word,
          remaining: next.remaining,
          intervals: null,
          error: null,
        });
      } catch (error) {
        if (!started) {
          set({ phase: "error", error: errorMessage(error) });
          return;
        }
        try {
          await completeSession(started.token, started.sessionId);
          if (hasErrorCode(error, "SESSION_COMPLETE")) {
            set({
              token: started.token,
            });
          } else {
            set({
              phase: "error",
              token: started.token,
              sessionId: null,
              error: errorMessage(error),
            });
          }
        } catch (finishError) {
          set({
            phase: "error",
            token: started.token,
            sessionId: started.sessionId,
            error: `学习会话初始化失败，且未能释放会话：${errorMessage(finishError)}`,
          });
        }
      }
    },
    reveal: async () => {
      const { phase, card, token, sessionId } = get();
      if (phase !== "front" || !card || !token || !sessionId) return;
      set({ phase: "revealing", error: null });
      try {
        const result = await api.reveal({
          requestId: requestId(),
          token,
          sessionId,
          expectedCardId: card.cardId,
        });
        set({ phase: "back", intervals: result.intervals, error: null });
      } catch (error) {
        set({ phase: "front", error: errorMessage(error) });
      }
    },
    answer: async (ease) => {
      const { phase, card, token, sessionId } = get();
      if (phase !== "back" || !card || !token || !sessionId) return;
      set({ phase: "answering", error: null });
      let confirmed = false;
      try {
        await api.answer({
          requestId: requestId(),
          token,
          sessionId,
          expectedCardId: card.cardId,
          ease,
        });
        confirmed = true;
        set((state) => ({
          answeredCards: state.answeredCards + 1,
          answerHistory: [
            ...state.answerHistory,
            { cardId: card.cardId, ease, answeredAt: Date.now() },
          ],
        }));
        try {
          const next = await api.next({
            requestId: requestId(),
            token,
            sessionId,
          });
          const profileKey = get().profileKey;
          if (!profileKey) throw new Error("学习会话缺少 Profile 标识");
          const word = await resolveWord(next.card, profileKey);
          set({
            phase: word ? "front" : "mapping",
            card: next.card,
            word,
            remaining: next.remaining,
            intervals: null,
            canUndo: true,
            error: null,
          });
        } catch (error) {
          if (!hasErrorCode(error, "SESSION_COMPLETE")) throw error;
          await completeSession(token, sessionId);
        }
      } catch (error) {
        set((state) => ({
          phase: confirmed ? "error" : "back",
          answeredCards: state.answeredCards,
          canUndo: confirmed || state.canUndo,
          error: errorMessage(error),
        }));
      }
    },
    undo: async () => {
      const { phase, canUndo, token, sessionId } = get();
      if (
        !canUndo ||
        !token ||
        !sessionId ||
        (phase !== "front" && phase !== "back" && phase !== "error")
      ) {
        return;
      }
      const returnPhase = phase === "back" ? "back" : "front";
      set({ phase: "undoing", error: null });
      try {
        const restored = await api.undo({
          requestId: requestId(),
          token,
          sessionId,
        });
        const profileKey = get().profileKey;
        if (!profileKey) throw new Error("学习会话缺少 Profile 标识");
        const word = await resolveWord(restored.card, profileKey);
        set((state) => ({
          phase: word ? "front" : "mapping",
          card: restored.card,
          word,
          remaining: restored.remaining,
          intervals: null,
          answeredCards: Math.max(0, state.answeredCards - 1),
          answerHistory: state.answerHistory.slice(0, -1),
          canUndo: false,
          error: null,
        }));
      } catch (error) {
        set({ phase: returnPhase, error: errorMessage(error) });
      }
    },
    finish: async () => {
      const { token, sessionId } = get();
      if (!token || !sessionId) return;
      try {
        await completeSession(token, sessionId);
      } catch (error) {
        set({ phase: "error", error: errorMessage(error) });
      }
    },
    resume: async () => {
      const { token, sessionId, profileKey } = get();
      if (!token || !sessionId || !profileKey) return;
      set({ phase: "starting", error: null });
      try {
        const status = await api.status(requestId());
        if (
          status.collectionState !== "open" ||
          status.syncState !== "idle" ||
          status.profileKey !== profileKey
        ) {
          throw new Error("Anki 当前状态不允许恢复学习会话");
        }
        const next = await api.next({
          requestId: requestId(),
          token,
          sessionId,
        });
        const word = await resolveWord(next.card, profileKey);
        set({
          phase: word ? "front" : "mapping",
          card: next.card,
          word,
          remaining: next.remaining,
          intervals: null,
          error: null,
          profileName: status.profileName ?? null,
        });
      } catch (error) {
        set({ phase: "error", error: errorMessage(error) });
      }
    },
    applyMapping: async (mapping) => {
      const { phase, card, profileKey } = get();
      if (phase !== "mapping" || !card || !profileKey) return;
      const word = toJapaneseWordRecord(card, mapping);
      if (!word) {
        set({ error: "映射必须包含词条，以及主释义或完整词典" });
        return;
      }
      try {
        await mappings.save({
          profileKey,
          modelId: card.modelId,
          fieldNames: Object.keys(card.fields),
          mapping,
        });
        set({ phase: "front", word, error: null });
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    },
    reset: () =>
      set({
        phase: "idle",
        deckId: null,
        deckName: null,
        sessionId: null,
        profileKey: null,
        profileName: null,
        card: null,
        word: null,
        remaining: null,
        intervals: null,
        answeredCards: 0,
        answerHistory: [],
        report: null,
        syncState: "idle",
        canUndo: false,
        error: null,
      }),
    });
  });
}

export const useStudySessionStore = createStudySessionStore();
