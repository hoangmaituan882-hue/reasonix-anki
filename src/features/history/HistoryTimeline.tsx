/**
 * 学习轨迹时间线组件：
 * - 按学习会话分组（相邻记录 >20 分钟切分，会话标题含起止时间/张数/正确率）
 * - 每条：四档评分色点 + 间隔变化 + 耗时 + 失败高亮（Again/重学红条）
 */
import { useMemo } from "react";
import { motion } from "motion/react";
import { Check, ChevronsDown, ChevronsUp, X } from "lucide-react";
import { cn } from "@reasonix/ui";
import {
  cardChain,
  easeColor,
  easeLabel,
  formatDuration,
  formatIvl,
  formatTime,
  groupIntoSessions,
  summarizeDay,
  typeLabel,
  type TimelineEntry,
} from "./historyUtil";

const EASE_ICON: Record<number, typeof X> = { 1: X, 2: ChevronsDown, 3: Check, 4: ChevronsUp };

interface Props {
  entries: TimelineEntry[];
  /** 点击卡片摘要：打开卡片详情弹窗（cardId） */
  onCardClick?: (cardId: number) => void;
}

/** 单条时间线条目 */
function Entry({
  entry,
  index,
  onCardClick,
}: {
  entry: TimelineEntry;
  index: number;
  onCardClick?: (cardId: number) => void;
}) {
  const Icon = EASE_ICON[entry.ease] ?? Check;
  const color = easeColor(entry.ease);
  const hasPrev = entry.previousIvl != null;
  const failed = entry.ease === 1 || entry.type === 2; // Again 或重学 → 薄弱点
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.6), duration: 0.25 }}
      className="relative flex gap-3 pl-6"
    >
      {/* 时间轴：色点 + 竖线 */}
      <div className="absolute left-1.5 top-0 bottom-0 w-px bg-[var(--rx-border-soft)]" />
      <div
        className="absolute left-0 top-3.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2"
        style={{ borderColor: color, background: "var(--rx-bg)" }}
      >
        <div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      </div>

      {/* 内容卡：失败高亮 = 左侧红条 */}
      <div
        className={cn(
          "mb-1.5 flex-1 rounded-r-[var(--rx-r-s)] border border-l-2 border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] px-3 py-2 transition-colors hover:border-[var(--rx-fg-faint)]",
          failed && "border-l-[var(--rx-err)]",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[var(--rx-fg-dim)]">
            {formatTime(entry.reviewTime)}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-bold"
            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            <Icon size={11} strokeWidth={3} />
            {easeLabel(entry.ease)}
          </span>
          <span className="rounded bg-[var(--rx-border-soft)] px-1.5 py-px text-[10px] text-[var(--rx-fg-dim)]">
            {typeLabel(entry.type)}
          </span>
          {failed && (
            <span className="rounded bg-[var(--rx-err)]/15 px-1.5 py-px text-[10px] font-bold text-[var(--rx-err)]">
              需重学
            </span>
          )}
          <span className="ml-auto text-[11px] text-[var(--rx-fg-dim)]">
            {formatDuration(entry.duration)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onCardClick?.(entry.cardId)}
          className={cn(
            "mt-1 block max-w-full truncate text-left text-[13px] text-[var(--rx-fg)]",
            onCardClick && "hover:text-[var(--rx-accent)] hover:underline",
          )}
          title={`${entry.deckName} · #${entry.cardId}`}
        >
          {entry.front}
        </button>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--rx-fg-dim)]">
          {hasPrev && (
            <>
              <span className="line-through opacity-70">{formatIvl(entry.previousIvl!)}</span>
              <span aria-hidden>→</span>
            </>
          )}
          <span className={cn("font-semibold", hasPrev && "text-[var(--rx-fg)]")}>
            {formatIvl(entry.ivl)}
          </span>
          <span className="ml-auto max-w-[40%] truncate text-[10px] opacity-70">
            {entry.deckName}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function HistoryTimeline({ entries, onCardClick }: Props) {
  const sessions = useMemo(() => groupIntoSessions(entries), [entries]);

  return (
    <div className="space-y-4">
      {sessions.map((s, si) => {
        const sum = summarizeDay(s.entries);
        const rate = sum.total > 0 ? Math.round(sum.correctRate * 100) : 0;
        return (
          <section key={s.startTime}>
            {/* 会话标题 */}
            <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--rx-fg-dim)]">
              <span className="font-bold text-[var(--rx-fg)]">会话 {si + 1}</span>
              <span className="font-mono">
                {formatTime(s.startTime)}–{formatTime(s.endTime)}
              </span>
              <span>· {s.entries.length} 次复习</span>
              <span className={cn(rate >= 60 ? "text-[var(--rx-ok)]" : "text-[var(--rx-warn)]")}>
                · 正确率 {rate}%
              </span>
              <div className="h-px flex-1 bg-[var(--rx-border-soft)]" />
            </div>
            {s.entries.map((e, i) => (
              <Entry key={`${e.reviewTime}-${e.cardId}`} entry={e} index={i} onCardClick={onCardClick} />
            ))}
          </section>
        );
      })}
      {sessions.length === 0 && (
        <p className="py-4 text-center text-xs text-[var(--rx-fg-dim)]">暂无记录</p>
      )}
    </div>
  );
}

// re-export：卡片详情弹窗用
export { cardChain };
