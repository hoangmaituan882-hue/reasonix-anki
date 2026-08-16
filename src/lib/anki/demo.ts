/**
 * 演示模式（无需 Anki）：内置 mock 数据让所有视图可浏览。
 * 用途：AI Studio 等云端环境 / Anki 未启动时查看完整 UI。
 * 原理：transport.ankiCall 在演示模式拦截所有 action 返回 mock；
 * 视图层无感（查询/统计/复习/时间线均有演示数据）。
 * 限制：配套插件（reasonix-addon :8766）与 SQLite 统计不 mock——
 * 沉浸式学习在演示模式不可用（启动时提示），单牌组统计/学习轨迹走演示数据。
 */
import type { CardInfo, DeckStats, NoteInfo } from "./schemas";

let demoMode = false;

// 持久化：刷新/重启后保持（AI Studio 云端场景）；localStorage 不可用时退会话级
const DEMO_KEY = "ra.demoMode";
function loadDemo(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}
demoMode = loadDemo();

export function setDemoMode(on: boolean): void {
  demoMode = on;
  try {
    localStorage.setItem(DEMO_KEY, on ? "1" : "0");
  } catch {
    // 隐私模式等场景忽略持久化
  }
}

export function isDemoMode(): boolean {
  return demoMode;
}

/* ---------------- 演示数据 ---------------- */

export const DEMO_DECKS: Record<string, number> = {
  系统默认: 0,
  "演示牌组::日语入门": 1,
  "演示牌组::N5 词汇": 2,
};

const DEMO_CARD_IDS = [1001, 1002, 1003, 1004, 1005, 1006];

const DEMO_CARDS: CardInfo[] = [
  { cardId: 1001, note: 9001, deckName: "演示牌组::日语入门", modelName: "演示日语卡", ord: 0, type: 2, queue: 2, due: 1, reps: 3, lapses: 0, interval: 4, question: "人間", answer: "にんげん<br>人类；人。<br>例：人間は社会の中で生きている。", css: "", fields: { 正面: { order: 0, value: "人間" }, 背面: { order: 1, value: "にんげん" } } },
  { cardId: 1002, note: 9002, deckName: "演示牌组::日语入门", modelName: "演示日语卡", ord: 0, type: 2, queue: 2, due: 1, reps: 2, lapses: 1, interval: 2, question: "先生", answer: "せんせい<br>老师<br>例：田中先生は優しい。", css: "", fields: { 正面: { order: 0, value: "先生" }, 背面: { order: 1, value: "せんせい" } } },
  { cardId: 1003, note: 9003, deckName: "演示牌组::N5 词汇", modelName: "演示日语卡", ord: 0, type: 1, queue: 1, due: 0, reps: 1, lapses: 0, interval: 0, question: "学校", answer: "がっこう<br>学校<br>例：毎日学校へ行く。", css: "", fields: { 正面: { order: 0, value: "学校" }, 背面: { order: 1, value: "がっこう" } } },
  { cardId: 1004, note: 9004, deckName: "演示牌组::N5 词汇", modelName: "演示日语卡", ord: 0, type: 0, queue: 0, due: 1, reps: 0, lapses: 0, interval: 0, question: "本", answer: "ほん<br>书<br>例：これは日本語の本です。", css: "", fields: { 正面: { order: 0, value: "本" }, 背面: { order: 1, value: "ほん" } } },
  { cardId: 1005, note: 9005, deckName: "演示牌组::N5 词汇", modelName: "演示日语卡", ord: 0, type: 2, queue: 2, due: 2, reps: 5, lapses: 0, interval: 8, question: "時間", answer: "じかん<br>时间<br>例：時間がない。", css: "", fields: { 正面: { order: 0, value: "時間" }, 背面: { order: 1, value: "じかん" } } },
  { cardId: 1006, note: 9006, deckName: "演示牌组::N5 词汇", modelName: "演示日语卡", ord: 0, type: 2, queue: 2, due: 3, reps: 4, lapses: 1, interval: 5, question: "友達", answer: "ともだち<br>朋友<br>例：友達と遊ぶ。", css: "", fields: { 正面: { order: 0, value: "友達" }, 背面: { order: 1, value: "ともだち" } } },
];

const DEMO_STATS: Record<string, DeckStats> = {
  "0": { deck_id: 0, name: "系统默认", new_count: 0, learn_count: 0, review_count: 0, total_in_deck: 0 },
  "1": { deck_id: 1, name: "演示牌组::日语入门", new_count: 5, learn_count: 2, review_count: 8, total_in_deck: 15 },
  "2": { deck_id: 2, name: "演示牌组::N5 词汇", new_count: 12, learn_count: 3, review_count: 20, total_in_deck: 42 },
};

/** 近 26 周每日复习数（热力图演示数据；今天固定 12） */
function demoReviewedByDay(): [string, number][] {
  const out: [string, number][] = [];
  const now = new Date();
  for (let i = 25 * 7; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    if (i === 0) out.push([date, 12]);
    else if (Math.random() < 0.4) out.push([date, Math.floor(Math.random() * 15)]);
  }
  return out;
}

/** cardReviews 演示数据：仅「演示牌组::N5 词汇」返回（避免降级路径遍历牌组时重复） */
function demoCardReviews(_deckName: string, startID: number): number[][] {
  if (_deckName !== "演示牌组::N5 词汇") return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = today.getTime();
  if (startID > base) return []; // 增量语义：startID 之后的记录；今天零点(=base)仍返回今天数据
  const easePool = [1, 2, 3, 3, 3, 4];
  return DEMO_CARD_IDS.slice(0, 6).map((cardId, i) => [
    base + i * 3 * 60 * 1000, // reviewTime（今天）
    cardId,
    0, // usn
    easePool[i % easePool.length], // buttonPressed
    [0, 1, 3, 4, 10, 27][i], // newInterval
    1, // previousInterval
    2500, // newFactor
    8 + i, // reviewDuration
    i % 3, // reviewType
  ]);
}

const DEMO_RESPONSES: Record<string, (params: Record<string, unknown>) => unknown> = {
  version: () => 6,
  requestPermission: () => ({ permission: "granted", requireApiKey: false, version: 6 }),
  sync: () => null,
  deckNamesAndIds: () => DEMO_DECKS,
  getDeckStats: (p) => {
    const decks = (p.decks as string[]) ?? Object.keys(DEMO_DECKS);
    return Object.fromEntries(
      decks
        .map((name) => {
          const id = DEMO_DECKS[name];
          return id != null ? [String(id), DEMO_STATS[String(id)]] : null;
        })
        .filter(Boolean) as [string, DeckStats][],
    );
  },
  getDeckConfig: () => ({ name: "演示牌组", new: { perDay: 20 }, rev: { perDay: 200 } }),
  findCards: () => DEMO_CARD_IDS,
  cardsInfo: (p) => {
    const cards = (p.cards as number[]) ?? [];
    return cards.map((id) => DEMO_CARDS.find((c) => c.cardId === id)).filter(Boolean);
  },
  notesInfo: (p) => {
    const notes = (p.notes as number[]) ?? [];
    return notes
      .map((id) => {
        const card = DEMO_CARDS.find((c) => c.note === id);
        return card
          ? ({
              noteId: id,
              modelName: card.modelName,
              tags: ["demo"],
              fields: { 正面: { order: 0, value: card.fields["正面"].value }, 背面: { order: 1, value: card.fields["背面"].value } },
              cards: [card.cardId],
            } satisfies NoteInfo)
          : null;
      })
      .filter(Boolean);
  },
  suspend: (p) => (p.cards as number[]).map(() => true),
  unsuspend: (p) => (p.cards as number[]).map(() => true),
  setDueDate: () => null,
  forgetCards: () => null,
  answerCards: (p) => (p.answers as unknown[]).map(() => true),
  addNote: () => 9100,
  updateNote: () => null,
  deleteNotes: () => null,
  modelNames: () => ["Basic", "演示日语卡"],
  modelFieldNames: () => ["正面", "背面"],
  getNumCardsReviewedToday: () => 12,
  getNumCardsReviewedByDay: () => demoReviewedByDay(),
  cardReviews: (p) => demoCardReviews(String(p.deck ?? ""), Number(p.startID ?? 0)),
  storeMediaFile: (p) => String(p.filename ?? "demo.png"),
  retrieveMediaFile: () => null,
  getMediaDirPath: () => "",
};

export function demoCall<T>(action: string, params: Record<string, unknown>): T {
  const fn = DEMO_RESPONSES[action];
  if (!fn) {
    throw new Error(`演示模式暂不支持该操作：${action}`);
  }
  return fn(params) as T;
}
