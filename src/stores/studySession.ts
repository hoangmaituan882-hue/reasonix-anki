import { create } from "zustand";
import type {
  JapaneseWordRecord,
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
import { hasCapability } from "../lib/reasonix-addon/capabilities";
import type {
  StudyCard,
} from "../lib/reasonix-addon/schemas";
import type {
  StudySessionApi,
  StudyMappingRepository,
  StudySessionState,
  StudyReport,
} from "./studySessionTypes";
import {
  REQUIRED_CAPABILITIES,
  errorMessage,
  hasErrorCode,
} from "./studySessionUtils";

// re-export 类型与工具，保持 studySession.ts 对外 API 不变
export type {
  NativeEase,
  StudyReport,
  StudyAnswerRecord,
  StudyPhase,
  StudySessionApi,
  StudyMappingRepository,
  StudySessionState,
} from "./studySessionTypes";
export { REQUIRED_CAPABILITIES, errorMessage, hasErrorCode } from "./studySessionUtils";

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
          throw new Error("Anki 尚未就绪（未打开牌组库），请检查 Anki 窗口状态");
        }
        if (status.syncState !== "idle") {
          throw new Error("Anki 正在同步，请等待同步完成后开始学习");
        }
        set({ profileName: status.profileName ?? null, syncState: "idle" });
        const missing = REQUIRED_CAPABILITIES.filter(
          (capability) => !hasCapability(status, capability, "0.1.0"),
        );
        if (missing.length > 0) {
          throw new Error(
            "Reasonix 配套插件版本过旧，缺少必要能力，请在设置中重新安装",
          );
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
          throw new Error("学习期间 Anki 配置已切换，请重新开始");
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
          throw new Error("Anki 状态不允许恢复，请返回今日首页重新开始");
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
