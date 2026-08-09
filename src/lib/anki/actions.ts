/**
 * 类型化 AnkiConnect action 客户端（技术方案 §4.2）
 * 每个 action 一个函数；读操作在 query.ts 里包 TanStack Query。
 */
import { z } from "zod";
import {
  cardInfoSchema,
  deckConfigSchema,
  deckStatsSchema,
  noteInfoSchema,
  type CardInfo,
  type DeckConfig,
  type DeckMap,
  type DeckStats,
  type NoteInfo,
} from "./schemas";
import { ankiCall } from "./transport";

export interface PermissionInfo {
  permission: string;
  requireKey?: boolean;
}

export const anki = {
  /* ---------- 连接 ---------- */
  version: () => ankiCall<number>("version"),
  requestPermission: () => ankiCall<PermissionInfo>("requestPermission"),
  sync: () => ankiCall<null>("sync"),

  /* ---------- 牌组 ---------- */
  /** Record<牌组名, deck_id>（实测：对象映射而非数组） */
  deckNamesAndIds: async (): Promise<DeckMap> =>
    z.record(z.string(), z.number()).parse(await ankiCall("deckNamesAndIds")),

  /** 返回 Record<deck_id(字符串), DeckStats>；counts 为今日剩余额度 */
  getDeckStats: async (decks: string[]): Promise<Record<string, DeckStats>> =>
    z
      .record(z.string(), deckStatsSchema)
      .parse(await ankiCall("getDeckStats", { decks })),

  /** 每日上限口径来源：new.perDay / rev.perDay */
  getDeckConfig: async (deck: string): Promise<DeckConfig> =>
    deckConfigSchema.parse(await ankiCall("getDeckConfig", { deck })),

  /* ---------- 检索 ---------- */
  findCards: (query: string) => ankiCall<number[]>("findCards", { query }),

  cardsInfo: async (cards: number[]): Promise<CardInfo[]> =>
    z.array(cardInfoSchema).parse(await ankiCall("cardsInfo", { cards })),

  notesInfo: async (notes: number[]): Promise<NoteInfo[]> =>
    z.array(noteInfoSchema).parse(await ankiCall("notesInfo", { notes })),

  /* ---------- 卡片/笔记操作 ---------- */
  suspend: (cards: number[]) => ankiCall<boolean[]>("suspend", { cards }),
  unsuspend: (cards: number[]) => ankiCall<boolean[]>("unsuspend", { cards }),
  /** ⚠️ 会把 new 卡转成 review 卡（官方文档明示），仅在用户明确确认后调用 */
  setDueDate: (cards: number[], days: string) =>
    ankiCall<null>("setDueDate", { cards, days }),
  forgetCards: (cards: number[]) => ankiCall<null>("forgetCards", { cards }),
  /** 复习评分（M3）：ease 1=Again … 4=Easy；返回各卡是否存在的布尔数组 */
  answerCards: (answers: { cardId: number; ease: number }[]) =>
    ankiCall<boolean[]>("answerCards", { answers }),
  /** 删除笔记及其全部卡片 */
  deleteNotes: (notes: number[]) => ankiCall<null>("deleteNotes", { notes }),

  /* ---------- 模型（M2 动态表单） ---------- */
  modelNames: () => ankiCall<string[]>("modelNames"),
  modelFieldNames: (modelName: string) =>
    ankiCall<string[]>("modelFieldNames", { modelName }),

  /* ---------- 笔记增改（M2） ---------- */
  /** 成功返回 noteId，失败返回 null；默认拒绝重复卡 */
  addNote: (note: NewNote) => ankiCall<number | null>("addNote", { note }),
  /** fields/tags 一次提交（合并 updateNoteFields + updateNoteTags） */
  updateNote: (note: { id: number; fields?: Record<string, string>; tags?: string[] }) =>
    ankiCall<null>("updateNote", { note }),

  /* ---------- 统计（M4） ---------- */
  /**
   * 牌组级复习日志：返回 startID（unix ms 水位线，不含）之后的记录。
   * 9 元组 [reviewTime, cardID, usn, buttonPressed, newInterval,
   *        previousInterval, newFactor, reviewDuration, reviewType]
   */
  cardReviews: (deck: string, startID: number) =>
    ankiCall<RevlogRow[]>("cardReviews", { deck, startID }),
  /** 今日已复习张数（按用户设置的日切时间） */
  getNumCardsReviewedToday: () => ankiCall<number>("getNumCardsReviewedToday"),
  /** 全局每日复习数 [日期, 张数][]（稀疏，仅含有复习的日子） */
  getNumCardsReviewedByDay: () => ankiCall<[string, number][]>("getNumCardsReviewedByDay"),

  /* ---------- 媒体 ---------- */
  /** data 为 base64；同名文件默认被覆盖 */
  storeMediaFile: (filename: string, data: string) =>
    ankiCall<string>("storeMediaFile", { filename, data }),
  /** 按文件名取媒体内容（base64）；媒体直读失败时的兜底通道 */
  retrieveMediaFile: (filename: string) =>
    ankiCall<string | null>("retrieveMediaFile", { filename }),
};

/** addNote 入参（签名已按 README 核对） */
export interface NewNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
}

/** cardReviews 返回的 9 元组（下标语义见方法注释） */
export type RevlogRow = [
  reviewTime: number,
  cardID: number,
  usn: number,
  buttonPressed: number,
  newInterval: number,
  previousInterval: number,
  newFactor: number,
  reviewDuration: number,
  reviewType: number,
];
