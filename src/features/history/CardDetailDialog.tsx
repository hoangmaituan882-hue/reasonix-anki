/**
 * 卡片详情弹窗：当天该卡完整复习链（Again → 重学 → Good…），
 * 含每次评分的间隔变化；「在浏览中查看」跳转浏览视图。
 */
import { Check, ChevronsDown, ChevronsUp, ExternalLink, X } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@reasonix/ui";
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
  /** 点击的卡片（取其摘要/牌组信息） */
  card: TimelineEntry;
  /** 当天该卡全部复习记录（时间升序） */
  chain: TimelineEntry[];
  onClose: () => void;
  onBrowse: (cardId: number) => void;
}

export function CardDetailDialog({ card, chain, onClose, onBrowse }: Props) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="min-w-0 flex-1 truncate">{card.front}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {card.deckName} · 卡片 #{card.cardId} · 当天复习 {chain.length} 次
          </DialogDescription>
        </DialogHeader>

        {/* 表现链：按时间顺序 */}
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {chain.map((e) => {
            const Icon = EASE_ICON[e.ease] ?? Check;
            const color = easeColor(e.ease);
            const hasPrev = e.previousIvl != null;
            return (
              <div
                key={`${e.reviewTime}-${e.cardId}`}
                className="flex items-center gap-2 rounded-[var(--rx-r-s)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] px-2.5 py-1.5"
              >
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
                <span className="ml-auto flex items-center gap-1 text-[11px] text-[var(--rx-fg-dim)]">
                  {hasPrev && (
                    <>
                      <span className="line-through opacity-70">
                        {formatIvl(e.previousIvl!)}
                      </span>
                      <span aria-hidden>→</span>
                    </>
                  )}
                  <span className="font-semibold text-[var(--rx-fg)]">{formatIvl(e.ivl)}</span>
                  <span className="opacity-70">· {formatDuration(e.duration)}</span>
                </span>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button size="sm" onClick={() => onBrowse(card.cardId)} className="rx-press">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            在浏览中查看
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
