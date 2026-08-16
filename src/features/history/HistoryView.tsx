/**
 * 学习轨迹视图：按日查看复习时间线（SQLite revlog 绝对日期，跨天零漂移）。
 * 热力图/日明细「检索这天」→ 跳入本视图并定位日期。
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock3, Inbox } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@reasonix/ui";
import { anki } from "../../lib/anki/actions";
import { useDeckTree } from "../../lib/anki/query";
import { getDayTimeline, type TimelineRow } from "../../lib/db/stats";
import { inTauri } from "../../lib/anki/transport";
import { useAppStore } from "../../stores/app";
import { frontText } from "../browse/browseUtil";
import { HistoryTimeline, cardChain } from "./HistoryTimeline";
import { CardDetailDialog } from "./CardDetailDialog";
import {
  easeColor,
  shiftDate,
  summarizeDay,
  todayString,
  type TimelineEntry,
} from "./historyUtil";

const BARS = [
  { key: "again" as const, label: "Again", ease: 1 },
  { key: "hard" as const, label: "Hard", ease: 2 },
  { key: "good" as const, label: "Good", ease: 3 },
  { key: "easy" as const, label: "Easy", ease: 4 },
];

export function HistoryView() {
  const injectedDate = useAppStore((s) => s.historyDate);
  const [date, setDate] = useState(() => injectedDate ?? todayString());
  const setBrowseQuery = useAppStore((s) => s.setBrowseQuery);
  const setView = useAppStore((s) => s.setView);
  const decksQ = useDeckTree();

  // 外部注入（热力图跳转）后跟随；用户手动切日期则注入已失效不再覆盖
  const [consumedInjection, setConsumedInjection] = useState(false);
  useEffect(() => {
    if (injectedDate && !consumedInjection) {
      setDate(injectedDate);
      setConsumedInjection(true);
    }
  }, [injectedDate, consumedInjection]);

  const timelineQ = useQuery({
    queryKey: ["history", "timeline", date],
    // staleTime 0：进入视图即重取（评分/复习后回到轨迹自动刷新最新记录）
    staleTime: 0,
    queryFn: async (): Promise<TimelineEntry[]> => {
      // Tauri 模式：SQLite revlog（绝对日期，跨天零漂移）
      if (inTauri) {
        const rows: TimelineRow[] = await getDayTimeline(date);
        return await enrich(rows);
      }
      // 浏览器调试模式降级：遍历牌组 cardReviews(deck, 当天零点) 按日过滤
      const dayStart = Date.parse(`${date}T00:00:00`);
      const dayEnd = dayStart + 24 * 3600 * 1000;
      const decks = await anki.deckNamesAndIds();
      const rows: TimelineRow[] = [];
      for (const [name, id] of Object.entries(decks)) {
        try {
          for (const r of await anki.cardReviews(name, dayStart)) {
            const [ts, cardId, , ease, ivl, prevIvl, , duration, type] = r;
            if (ts >= dayStart && ts < dayEnd) {
              rows.push({
                reviewTime: ts,
                cardId,
                deckId: id,
                ease: ease ?? 0,
                ivl: ivl ?? 0,
                previousIvl: prevIvl ?? null,
                duration: duration ?? 0,
                type: type ?? 0,
              });
            }
          }
        } catch {
          // 单牌组失败跳过（牌组可能被删）
        }
      }
      rows.sort((a, b) => a.reviewTime - b.reviewTime);
      return await enrich(rows);
    },
  });

  const enrich = async (rows: TimelineRow[]): Promise<TimelineEntry[]> => {
    const ids = [...new Set(rows.map((r) => r.cardId))];
    const cards = ids.length ? await anki.cardsInfo(ids) : [];
    const cardMap = new Map(cards.map((c) => [c.cardId, c]));
    const deckNames = new Map(
      Object.entries(decksQ.data?.decks ?? {}).map(([name, id]) => [id, name]),
    );
    return rows.map((r) => ({
      ...r,
      front: cardMap.has(r.cardId) ? frontText(cardMap.get(r.cardId)!) : "（已删除卡片）",
      deckName: deckNames.get(r.deckId) ?? `牌组 #${r.deckId}`,
    }));
  };

  const summary = useMemo(() => summarizeDay(timelineQ.data ?? []), [timelineQ.data]);

  // 卡片详情弹窗状态：点击卡片 → 打开当天表现链
  const [detailCardId, setDetailCardId] = useState<number | null>(null);
  const detailCard = detailCardId != null
    ? (timelineQ.data ?? []).find((e) => e.cardId === detailCardId) ?? null
    : null;
  const detailChain = useMemo(
    () => (detailCardId != null ? cardChain(timelineQ.data ?? [], detailCardId) : []),
    [timelineQ.data, detailCardId],
  );

  const jumpToCard = (cardId: number) => {
    setDetailCardId(null);
    setBrowseQuery(`cid:${cardId}`);
    setView("browse");
  };

  const fmtTime = (ms: number) => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} 秒`;
    const m = Math.floor(s / 60);
    return `${m} 分${s % 60 ? ` ${s % 60} 秒` : ""}`;
  };

  const ratePct = summary.total > 0 ? Math.round(summary.correctRate * 100) : 0;
  const rateTone =
    ratePct >= 60 ? "var(--rx-ok)" : ratePct >= 40 ? "var(--rx-warn)" : "var(--rx-err)";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {/* 日期选择 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDate((d) => shiftDate(d, -1))}
          aria-label="前一天"
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <input
          type="date"
          value={date}
          max={todayString()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-8 rounded-md border border-[var(--rx-border)] bg-[var(--rx-bg-soft)] px-2 text-sm text-[var(--rx-fg)] outline-none focus:border-[var(--rx-accent)]"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDate((d) => shiftDate(d, 1))}
          disabled={date >= todayString()}
          aria-label="后一天"
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDate(todayString())}
          className="ml-1 text-xs"
        >
          今天
        </Button>
      </div>

      {/* 汇总卡 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock3 className="h-4 w-4 text-[var(--rx-accent)]" />
            {date} · 复习记录
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--rx-fg-dim)]">
            <span>
              共 <b className="text-sm text-[var(--rx-fg)]">{summary.total}</b> 次
            </span>
            <span>总耗时 {fmtTime(summary.timeMs)}</span>
            <span>
              学习 {summary.learn} · 复习 {summary.review} · 重学 {summary.relearn}
            </span>
          </div>
          {/* 质量指标 */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--rx-fg-dim)]">
            <span>
              正确率{" "}
              <b className="text-sm" style={{ color: rateTone }}>
                {ratePct}%
              </b>
            </span>
            {summary.avgIvlGain != null && (
              <span>
                平均间隔涨幅{" "}
                <b className="text-sm text-[var(--rx-fg)]">
                  ×{summary.avgIvlGain.toFixed(1)}
                </b>
              </span>
            )}
            <span>平均耗时 {fmtTime(summary.avgDuration * 1000)}</span>
          </div>
          {/* 四档占比条 */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--rx-border-soft)]">
            {BARS.map((b) => {
              const n = summary[b.key];
              if (n === 0) return null;
              return (
                <div
                  key={b.key}
                  className="h-full transition-all"
                  style={{
                    width: `${(n / Math.max(1, summary.total)) * 100}%`,
                    background: easeColor(b.ease),
                  }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {BARS.map((b) => (
              <span key={b.key} className="inline-flex items-center gap-1.5 text-[var(--rx-fg-dim)]">
                <span className="h-2 w-2 rounded-sm" style={{ background: easeColor(b.ease) }} />
                {b.label} {summary[b.key]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 时间线 */}
      {timelineQ.isPending ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--rx-r-s)] bg-[var(--rx-border-soft)]/60"
            />
          ))}
        </div>
      ) : (timelineQ.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-[var(--rx-fg-dim)]">
            <Inbox className="h-8 w-8 opacity-50" />
            <p className="text-sm">这天没有复习记录</p>
            <p className="text-xs opacity-70">在复习/学习会话中评分后，记录会出现在这里</p>
          </CardContent>
        </Card>
      ) : (
        <HistoryTimeline
          entries={timelineQ.data!}
          onCardClick={(cardId) => setDetailCardId(cardId)}
        />
      )}

      {/* 卡片详情弹窗（当天表现链） */}
      {detailCard && detailChain.length > 0 && (
        <CardDetailDialog
          card={detailCard}
          chain={detailChain}
          onClose={() => setDetailCardId(null)}
          onBrowse={jumpToCard}
        />
      )}
    </div>
  );
}
