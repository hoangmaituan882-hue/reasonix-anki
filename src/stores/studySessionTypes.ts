/**
 * 学习会话的类型定义（从 studySession.ts 拆出，保持对外 API 兼容）。
 */
import type {
  JapaneseWordRecord,
  VocabularyFieldMapping,
} from "../features/vocabulary/lapisAdapter";
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
