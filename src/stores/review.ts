/**
 * 复习会话状态机（技术方案 §5.3 / §2.3：会话层归 Zustand，不进 TanStack Query）
 * 拉队列 → 逐张出卡 → 评分提交 → 下一张；bury 为会话内行为（buriedToday），
 * 零调度副作用；setDueDate 不在本 store 出现。
 */
import { create } from "zustand";
import { anki } from "../lib/anki/actions";
import type { CardInfo } from "../lib/anki/schemas";
import { toast, toastError } from "../components/ToasterLite";

export type Ease = 1 | 2 | 3 | 4;
export type ReviewPhase = "idle" | "question" | "answer" | "done";

export interface AnsweredRecord {
  cardId: number;
  ease: Ease;
}

/** 单次会话队列上限（超长牌组截断并提示） */
export const MAX_QUEUE = 300;

interface ReviewState {
  deck: string | null;
  queue: CardInfo[];
  index: number;
  phase: ReviewPhase;
  answered: AnsweredRecord[];
  buriedSession: number[]; // 本次会话 bury 的 cardId（展示用）
  starting: boolean;
  /** answer 提交 in-flight：防键盘 repeat/连点对同一卡并发评分（revlog 损坏） */
  answering: boolean;
  error: string | null;

  start: (deck: string) => Promise<void>;
  reveal: () => void;
  answer: (ease: Ease) => Promise<void>;
  bury: () => void;
  exit: () => void;
}

/* ---------- buriedToday 持久化（按日期，跨应用重启保持"今天不看"） ---------- */

function todayKey(): string {
  return `ra.buried.${new Date().toISOString().slice(0, 10)}`;
}

function loadBuried(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(todayKey()) ?? "[]") as number[]);
  } catch {
    return new Set();
  }
}

function saveBuried(set: Set<number>): void {
  localStorage.setItem(todayKey(), JSON.stringify([...set]));
}

let buriedToday = loadBuried();

/**
 * 会话代际标识：每次 start/exit 递增。answer 在 await 前捕获当前代际，
 * 完成后对比——in-flight 期间会话退出/重启（即使同牌组、队列含同 cardId）
 * 则丢弃本地记账，防止旧评分污染新会话（跳过新会话队首卡 / 复活已退出会话）。
 */
let sessionEpoch = 0;

/* ---------- 工具 ---------- */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 推进到下一张未 bury 的卡；耗尽则进入 done */
function advance(s: Pick<ReviewState, "queue" | "index">): {
  index: number;
  phase: ReviewPhase;
} {
  let i = s.index + 1;
  while (i < s.queue.length && buriedToday.has(s.queue[i].cardId)) i++;
  if (i >= s.queue.length) return { index: i, phase: "done" };
  return { index: i, phase: "question" };
}

export const useReviewStore = create<ReviewState>()((set, get) => ({
  deck: null,
  queue: [],
  index: 0,
  phase: "idle",
  answered: [],
  buriedSession: [],
  starting: false,
  answering: false,
  error: null,

  start: async (deck) => {
    sessionEpoch += 1; // 新会话代际
    set({ starting: true, error: null, deck, answering: false });
    try {
      const ids = await anki.findCards(`deck:"${deck}" is:due`);
      if (ids.length === 0) {
        set({
          starting: false,
          phase: "idle",
          error: "该牌组当前没有到期卡片",
        });
        return;
      }
      if (ids.length > MAX_QUEUE) {
        toast({
          title: "队列较长",
          description: `到期 ${ids.length} 张，本次会话取前 ${MAX_QUEUE} 张`,
        });
      }
      const slice = ids.slice(0, MAX_QUEUE);
      const cards = await anki.cardsInfo(slice);
      const queue = shuffle(cards.filter((c) => !buriedToday.has(c.cardId)));
      set({
        queue,
        index: 0,
        answered: [],
        buriedSession: [],
        starting: false,
        phase: queue.length > 0 ? "question" : "done",
      });
    } catch (e) {
      set({
        starting: false,
        phase: "idle",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  reveal: () => {
    if (get().phase === "question") set({ phase: "answer" });
  },

  answer: async (ease) => {
    const { queue, index, phase, answering } = get();
    const card = queue[index];
    if (!card || phase !== "answer" || answering) return; // answering 防键盘 repeat/连点并发评分
    const epoch = sessionEpoch; // 捕获本会话代际
    set({ answering: true });
    try {
      await anki.answerCards([{ cardId: card.cardId, ease }]);
    } catch (e) {
      toastError("评分提交失败，请重试", e);
      set({ answering: false });
      return; // 停留在当前卡，允许重试
    }
    // in-flight 期间会话已退出/重启（epoch 不匹配）：只复位锁，丢弃本地记账
    if (epoch !== sessionEpoch) {
      if (get().answering) set({ answering: false });
      return;
    }
    set((s) => ({
      answering: false,
      answered: [...s.answered, { cardId: card.cardId, ease }],
      ...advance(s),
    }));
  },

  bury: () => {
    const { queue, index, phase, answering } = get();
    const card = queue[index];
    // answering 时禁止 bury：评分 in-flight（已提交 Anki）时本地 bury 会造成记账不一致
    if (!card || (phase !== "question" && phase !== "answer") || answering) return;
    // 会话内 bury：仅本地过滤，不触碰 Anki 调度数据（技术方案 §5.3 第 5 条）
    buriedToday.add(card.cardId);
    saveBuried(buriedToday);
    toast({
      title: "本次会话不再出现",
      description: "明天重新打开应用时会自然回到队列（未改动 Anki 调度）",
    });
    set((s) => ({
      buriedSession: [...s.buriedSession, card.cardId],
      ...advance(s),
    }));
  },

  exit: () => {
    sessionEpoch += 1; // 退出即作废 in-flight answer
    set({ phase: "idle", queue: [], index: 0, answered: [], deck: null, answering: false });
  },
}));

/** 当前卡（便捷选择器） */
export function selectCurrentCard(s: ReviewState): CardInfo | null {
  return s.queue[s.index] ?? null;
}
