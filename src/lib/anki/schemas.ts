/**
 * AnkiConnect 响应 zod schemas（技术方案 §4）
 * 字段名已按 sr.ht 官方 README 示例逐条核对。
 */
import { z } from "zod";

/**
 * deckNamesAndIds 返回 Record<牌组名, deck_id>（对象映射，不是数组！
 * 实测核对：{"ceshi": 1781523613318, ...}）
 */
export type DeckMap = Record<string, number>;

/**
 * getDeckStats 值（外层 key 为 deck_id 字符串）
 * ⚠️ 口径（技术方案 §5.1）：new/learn/review_count 是"今日剩余额度"（受每日上限约束），
 *    total_in_deck 才是牌组总数。
 */
export const deckStatsSchema = z.object({
  deck_id: z.number(),
  name: z.string(),
  new_count: z.number(),
  learn_count: z.number(),
  review_count: z.number(),
  total_in_deck: z.number(),
});
export type DeckStats = z.infer<typeof deckStatsSchema>;

/** getDeckConfig — 只解析用到的字段（V1 调度与 FSRS 结构都能过） */
export const deckConfigSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  new: z.object({ perDay: z.number() }).optional(),
  rev: z.object({ perDay: z.number() }).optional(),
});
export type DeckConfig = z.infer<typeof deckConfigSchema>;

/**
 * cardsInfo 条目
 * ⚠️ fields 的字段值 key 是 `value`（不是 text），已按 README 示例核对
 * queue：-1 暂停 / -2 调度埋没 / -3 用户埋没 / 0 新卡 / 1 学习 / 2 复习 / 3 跨天学习
 * type：0 新 / 1 学习 / 2 复习；复习卡的 due 是相对今天的"天偏移"
 */
export const cardInfoSchema = z.object({
  cardId: z.number(),
  question: z.string(),
  answer: z.string(),
  deckName: z.string(),
  modelName: z.string(),
  fieldOrder: z.number().optional(),
  fields: z.record(z.string(), z.object({ value: z.string(), order: z.number() })),
  css: z.string().optional(),
  interval: z.number().optional(),
  note: z.number(),
  ord: z.number().optional(),
  type: z.number(),
  queue: z.number(),
  due: z.number(),
  reps: z.number().optional(),
  lapses: z.number().optional(),
  left: z.number().optional(),
  mod: z.number().optional(),
});
export type CardInfo = z.infer<typeof cardInfoSchema>;

/** notesInfo 条目 */
export const noteInfoSchema = z.object({
  noteId: z.number(),
  tags: z.array(z.string()),
  fields: z.record(z.string(), z.object({ order: z.number(), value: z.string() })),
  modelName: z.string(),
  cards: z.array(z.number()),
});
export type NoteInfo = z.infer<typeof noteInfoSchema>;
