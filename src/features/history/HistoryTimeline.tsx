/**
 * 学习轨迹时间线组件：垂直时间轴 + 四档评分色点 + 间隔变化 + 耗时。
 * 数据按 review_time 升序传入；空态由调用方处理。
 */
import { motion } from "motion/react";
import { Check, ChevronsDown, ChevronsUp, X } from "lucide-react";
import { cn } from "@reasonix/ui";
import {
  easeColor,
  easeLabel,
  formatDuration,
  formatIvl,
  formatTime,
  typeLabel,
  type TimelineEntry,
} from "./historyUtil";

const EASE_ICON: Record<number, typeof X> = { 1: X, 2: ChevronsDown, 3: Check, 4: ChevronsUp };

interface Props {
  entries: TimelineEntry[];
  /** 点击卡片摘要：跳浏览定位（cardId） */
  onCardClick?: (cardId: number) => void;
}

export function HistoryTimeline({ entries, onCardClick }: Props) {
  return (
    <div className="relative space-y-1">
      {entries.map((e, i) => {
        const Icon = EASE_ICON[e.ease] ?? Check;
        const color = easeColor(e.ease);
        const hasPrev = e.previousIvl != null;
        return (
          <motion.div
            key={`${e.reviewTime}-${e.cardId}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.6), duration: 0.25 }}
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

            {/* 内容卡 */}
            <div className="mb-2 flex-1 rounded-[var(--rx-r-s)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] px-3 py-2 transition-colors hover:border-[var(--rx-fg-faint)]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[var(--rx-fg-dim)]">
                  {formatTime(e.reviewTime)}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-bold"
                  style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                >
                  <Icon size={11} strokeWidth={3} />
                  {easeLabel(e.ease)}
                </span>
                <span className="rounded bg-[var(--rx-border-soft)] px-1.5 py-px text-[10px] text-[var(--rx-fg-dim)]">
                  {typeLabel(e.type)}
                </span>
                <span className="ml-auto text-[11px] text-[var(--rx-fg-dim)]">
                  {formatDuration(e.duration)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onCardClick?.(e.cardId)}
                className={cn(
                  "mt-1 block max-w-full truncate text-left text-[13px] text-[var(--rx-fg)]",
                  onCardClick && "hover:text-[var(--rx-accent)] hover:underline",
                )}
                title={`${e.deckName} · #${e.cardId}`}
              >
                {e.front}
              </button>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--rx-fg-dim)]">
                {hasPrev && (
                  <>
                    <span className="line-through opacity-70">{formatIvl(e.previousIvl!)}</span>
                    <span aria-hidden>→</span>
                  </>
                )}
                <span className={cn("font-semibold", hasPrev && "text-[var(--rx-fg)]")}>
                  {formatIvl(e.ivl)}
                </span>
                <span className="ml-auto max-w-[40%] truncate text-[10px] opacity-70">
                  {e.deckName}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
