/**
 * 学习轨迹视图：类型与纯函数（可测）。
 * 数据源 = SQLite revlog（绝对时间戳按日过滤，跨天零漂移），
 * 卡片摘要由 cardsInfo 批量补充。
 */

/** 时间线单条（revlog 行 + 卡片摘要 + 牌组名） */
export interface TimelineEntry {
  reviewTime: number;
  cardId: number;
  deckId: number;
  /** 评分按钮 1=Again 2=Hard 3=Good 4=Easy（0/其他 = 手动） */
  ease: number;
  /** 新间隔（天；0=10 分钟内） */
  ivl: number;
  /** 前间隔（天；旧库数据为 null） */
  previousIvl: number | null;
  /** 耗时（秒） */
  duration: number;
  /** 0=学习 1=复习 2=重学 */
  type: number;
  /** 正面摘要（order 最小字段纯文本，截断） */
  front: string;
  deckName: string;
}

/** 当日汇总（四档分布 + 耗时 + 类型构成） */
export interface DaySummary {
  total: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  timeMs: number;
  learn: number;
  review: number;
  relearn: number;
}

/** 四档元数据（颜色令牌 + 标签 + lucide 图标名） */
export const EASE_META: Record<
  number,
  { label: string; color: string; icon: "X" | "ChevronsDown" | "Check" | "ChevronsUp" }
> = {
  1: { label: "Again", color: "var(--rx-err)", icon: "X" },
  2: { label: "Hard", color: "var(--rx-warn)", icon: "ChevronsDown" },
  3: { label: "Good", color: "var(--rx-ok)", icon: "Check" },
  4: { label: "Easy", color: "var(--rx-accent)", icon: "ChevronsUp" },
};

export function easeLabel(ease: number): string {
  return EASE_META[ease]?.label ?? "手动";
}

export function easeColor(ease: number): string {
  return EASE_META[ease]?.color ?? "var(--rx-fg-dim)";
}

/** 间隔格式化：0 = 10 分钟内；<1 天 = 小时；否则 N 天 */
export function formatIvl(ivl: number): string {
  if (ivl <= 0) return "10 分钟内";
  if (ivl < 1) return `${Math.round(ivl * 24)} 小时`;
  return `${ivl} 天`;
}

/** review_time（毫秒）→ 本地 HH:mm */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 耗时秒 → "8 秒" / "1 分 2 秒" */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} 秒`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分`;
}

/** 复习类型标签 */
export function typeLabel(type: number): string {
  if (type === 0) return "学习";
  if (type === 1) return "复习";
  if (type === 2) return "重学";
  return "其他";
}

export function emptySummary(): DaySummary {
  return {
    total: 0,
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    timeMs: 0,
    learn: 0,
    review: 0,
    relearn: 0,
  };
}

/** 汇总当天时间线（纯函数） */
export function summarizeDay(entries: TimelineEntry[]): DaySummary {
  const s = emptySummary();
  for (const e of entries) {
    s.total++;
    if (e.ease === 1) s.again++;
    else if (e.ease === 2) s.hard++;
    else if (e.ease === 3) s.good++;
    else if (e.ease === 4) s.easy++;
    s.timeMs += e.duration * 1000;
    if (e.type === 0) s.learn++;
    else if (e.type === 1) s.review++;
    else if (e.type === 2) s.relearn++;
  }
  return s;
}

/** 本地 YYYY-MM-DD（今日默认值） */
export function todayString(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 日期偏移（用于选择器上一/下一天） */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
