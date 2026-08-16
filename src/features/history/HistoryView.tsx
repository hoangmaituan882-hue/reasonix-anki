/**
 * 学习轨迹视图：按日查看复习时间线 + 日期范围聚合（7/30 天）。
 * - 单日：筛选（评分/类型/牌组）+ 汇总卡（含昨天对比）+ 会话分组时间线
 * - 范围：每日聚合列表（次数/四档迷你条/正确率），点击某天回单日
 * 数据源：Tauri = SQLite revlog（绝对日期）；浏览器 = cardReviews 按日过滤
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ChevronLeft, ChevronRight, Clock3, Inbox } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@reasonix/ui";
import { anki } from "../../lib/anki/actions";
import { useDeckTree } from "../../lib/anki/query";
import { getDayTimeline, type TimelineRow } from "../../lib/db/stats";
import { inTauri } from "../../lib/anki/transport";
import { isDemoMode } from "../../lib/anki/demo";
import { useAppStore } from "../../stores/app";
import { frontText } from "../browse/browseUtil";
import { HistoryTimeline, cardChain } from "./HistoryTimeline";
import { CardDetailDialog } from "./CardDetailDialog";
import {
  aggregateRange,
  compareDays,
  easeColor,
  filterEntries,
  shiftDate,
  summarizeDay,
  todayString,
  type DailyAgg,
  type DaySummary,
  type TimelineEntry,
  type TimelineFilters,
} from "./historyUtil";

const BARS = [
  { key: "again" as const, label: "Again", ease: 1 },
  { key: "hard" as const, label: "Hard", ease: 2 },
  { key: "good" as const, label: "Good", ease: 3 },
  { key: "easy" as const, label: "Easy", ease: 4 },
];

const EASE_FILTERS: { label: string; ease?: number }[] = [
  { label: "全部" },
  { label: "Again", ease: 1 },
  { label: "Hard", ease: 2 },
  { label: "Good", ease: 3 },
  { label: "Easy", ease: 4 },
];

const TYPE_FILTERS: { label: string; type?: number }[] = [
  { label: "全部类型" },
  { label: "学习", type: 0 },
  { label: "复习", type: 1 },
  { label: "重学", type: 2 },
];

type RangeMode = "day" | "7d" | "30d";

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  return `${m} 分${s % 60 ? ` ${s % 60} 秒` : ""}`;
}

function ratePctOf(sum: DaySummary): number {
  return sum.total > 0 ? Math.round(sum.correctRate * 100) : 0;
}

export function HistoryView() {
  const injectedDate = useAppStore((s) => s.historyDate);
  const [date, setDate] = useState(() => injectedDate ?? todayString());
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const setBrowseQuery = useAppStore((s) => s.setBrowseQuery);
  const setView = useAppStore((s) => s.setView);
  const decksQ = useDeckTree();

  // 筛选状态
  const [filters, setFilters] = useState<TimelineFilters>({});

  // 外部注入（热力图跳转）后跟随
  const [consumedInjection, setConsumedInjection] = useState(false);
  useEffect(() => {
    if (injectedDate && !consumedInjection) {
      setDate(injectedDate);
      setConsumedInjection(true);
    }
  }, [injectedDate, consumedInjection]);

  /** 拉取单日时间线（Tauri SQLite / 浏览器 cardReviews 双通道） */
  const fetchDay = async (day: string): Promise<TimelineEntry[]> => {
    if (inTauri && !isDemoMode()) {
      return await enrich(await getDayTimeline(day));
    }
    const dayStart = Date.parse(`${day}T00:00:00`);
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
        // 单牌组失败跳过
      }
    }
    rows.sort((a, b) => a.reviewTime - b.reviewTime);
    return await enrich(rows);
  };

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

  // 单日时间线（staleTime 0：评分后回到轨迹自动刷新）
  const timelineQ = useQuery({
    queryKey: ["history", "timeline", date],
    staleTime: 0,
    enabled: rangeMode === "day",
    queryFn: () => fetchDay(date),
  });

  // 昨天（跨日对比，仅单日无筛选时显示）
  const prevDate = shiftDate(date, -1);
  const prevDayQ = useQuery({
    queryKey: ["history", "timeline", prevDate],
    staleTime: 0,
    enabled: rangeMode === "day" && Object.keys(filters).length === 0,
    queryFn: () => fetchDay(prevDate),
  });

  // 范围聚合（7/30 天）
  const rangeDays = rangeMode === "7d" ? 7 : 30;
  const rangeQ = useQuery({
    queryKey: ["history", "range", rangeMode],
    staleTime: 0,
    enabled: rangeMode !== "day",
    queryFn: async (): Promise<DailyAgg[]> => {
      const dates = Array.from({ length: rangeDays }, (_, i) => shiftDate(todayString(), -i));
      // 串行拉取：AnkiConnect 单线程桥对并发 cardReviews 会超时（实测 Promise.all 500）
      const byDate = new Map<string, TimelineEntry[]>();
      for (const d of dates) {
        byDate.set(d, await fetchDay(d));
      }
      return aggregateRange(byDate, dates);
    },
  });

  // 筛选后数据（仅单日）
  const filteredEntries = useMemo(
    () => filterEntries(timelineQ.data ?? [], filters),
    [timelineQ.data, filters],
  );
  const summary = useMemo(() => summarizeDay(filteredEntries), [filteredEntries]);

  // 卡片详情弹窗
  const [detailCardId, setDetailCardId] = useState<number | null>(null);
  const detailCard =
    detailCardId != null
      ? (filteredEntries.find((e) => e.cardId === detailCardId) ?? null)
      : null;
  const detailChain = useMemo(
    () => (detailCardId != null ? cardChain(filteredEntries, detailCardId) : []),
    [filteredEntries, detailCardId],
  );

  const jumpToCard = (cardId: number) => {
    setDetailCardId(null);
    setBrowseQuery(`cid:${cardId}`);
    setView("browse");
  };

  // 昨天对比
  const comparison =
    rangeMode === "day" && Object.keys(filters).length === 0 && prevDayQ.data
      ? compareDays(summary, summarizeDay(prevDayQ.data))
      : null;

  // 范围汇总
  const rangeSummary = useMemo(() => {
    if (!rangeQ.data || rangeQ.data.length === 0) return null;
    return rangeQ.data.reduce(
      (acc, d) => {
        acc.total += d.summary.total;
        acc.timeMs += d.summary.timeMs;
        acc.again += d.summary.again;
        acc.hard += d.summary.hard;
        acc.good += d.summary.good;
        acc.easy += d.summary.easy;
        return acc;
      },
      { total: 0, timeMs: 0, again: 0, hard: 0, good: 0, easy: 0 },
    );
  }, [rangeQ.data]);

  const fmtDelta = (n: number, suffix: string) =>
    n === 0 ? `±0${suffix}` : n > 0 ? `+${n}${suffix}` : `${n}${suffix}`;

  const ratePct = ratePctOf(summary);
  const rateTone =
    ratePct >= 60 ? "var(--rx-ok)" : ratePct >= 40 ? "var(--rx-warn)" : "var(--rx-err)";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {/* 范围切换 + 日期选择 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-[var(--rx-border)] p-0.5">
          {(
            [
              ["day", "今天"],
              ["7d", "近 7 天"],
              ["30d", "近 30 天"],
            ] as [RangeMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRangeMode(mode)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                rangeMode === mode
                  ? "bg-[var(--rx-accent)] font-bold text-white"
                  : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {rangeMode === "day" && (
          <>
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
          </>
        )}
      </div>

      {rangeMode === "day" ? (
        <>
          {/* 筛选行 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-[var(--rx-border)] p-0.5">
              {EASE_FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, ease: f.ease }))}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                    filters.ease === f.ease
                      ? "bg-[var(--rx-accent)] font-bold text-white"
                      : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-[var(--rx-border)] p-0.5">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, type: f.type }))}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                    filters.type === f.type
                      ? "bg-[var(--rx-accent)] font-bold text-white"
                      : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              value={filters.deckId ?? ""}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  deckId: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              className="h-7 rounded-lg border border-[var(--rx-border)] bg-[var(--rx-bg-soft)] px-2 text-[11px] text-[var(--rx-fg)] outline-none"
            >
              <option value="">全部牌组</option>
              {Object.entries(decksQ.data?.decks ?? {}).map(([name, id]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
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
                {comparison && (
                  <span className="rounded bg-[var(--rx-border-soft)] px-1.5 py-0.5 text-[11px]">
                    对比昨天：
                    <b className={cn(comparison.countDelta > 0 && "text-[var(--rx-ok)]", comparison.countDelta < 0 && "text-[var(--rx-err)]")}>
                      {fmtDelta(comparison.countDelta, " 次")}
                    </b>
                    {comparison.rateDelta != null && (
                      <>
                        {" · 正确率 "}
                        <b className={cn(comparison.rateDelta > 0 && "text-[var(--rx-ok)]", comparison.rateDelta < 0 && "text-[var(--rx-err)]")}>
                          {fmtDelta(comparison.rateDelta, "%")}
                        </b>
                      </>
                    )}
                    {" · "}
                    {fmtDelta(comparison.timeDeltaMs >= 0 ? Math.round(comparison.timeDeltaMs / 60000) : -Math.round(-comparison.timeDeltaMs / 60000), " 分")}
                  </span>
                )}
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
                  <span
                    key={b.key}
                    className="inline-flex items-center gap-1.5 text-[var(--rx-fg-dim)]"
                  >
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
          ) : filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-[var(--rx-fg-dim)]">
                <Inbox className="h-8 w-8 opacity-50" />
                <p className="text-sm">{timelineQ.data?.length ? "没有符合筛选的记录" : "这天没有复习记录"}</p>
                <p className="text-xs opacity-70">
                  {timelineQ.data?.length
                    ? "调整筛选条件试试"
                    : "在复习/学习会话中评分后，记录会出现在这里"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <HistoryTimeline
              entries={filteredEntries}
              onCardClick={(cardId) => setDetailCardId(cardId)}
            />
          )}
        </>
      ) : (
        /* 范围聚合视图 */
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarRange className="h-4 w-4 text-[var(--rx-accent)]" />
              近 {rangeDays} 天学习概况
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rangeQ.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-[var(--rx-border-soft)]/60" />
                ))}
              </div>
            ) : rangeQ.data && rangeQ.data.length > 0 ? (
              <>
                {rangeSummary && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--rx-fg-dim)]">
                    <span>
                      共 <b className="text-sm text-[var(--rx-fg)]">{rangeSummary.total}</b> 次
                    </span>
                    <span>总耗时 {fmtTime(rangeSummary.timeMs)}</span>
                    <span>
                      Again {rangeSummary.again} · Hard {rangeSummary.hard} · Good{" "}
                      {rangeSummary.good} · Easy {rangeSummary.easy}
                    </span>
                  </div>
                )}
                <div className="divide-y divide-[var(--rx-border-soft)]">
                  {rangeQ.data.map((d) => {
                    const r = ratePctOf(d.summary);
                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => {
                          setDate(d.date);
                          setRangeMode("day");
                        }}
                        className="flex w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-[var(--rx-bg-soft)]"
                      >
                        <span className="w-24 shrink-0 text-xs text-[var(--rx-fg)]">{d.date}</span>
                        <span className="shrink-0 text-xs text-[var(--rx-fg-dim)]">
                          {d.summary.total} 次
                        </span>
                        <span className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--rx-border-soft)]">
                          {BARS.map((b) => {
                            const n = d.summary[b.key];
                            if (n === 0) return null;
                            return (
                              <span
                                key={b.key}
                                style={{
                                  width: `${(n / Math.max(1, d.summary.total)) * 100}%`,
                                  background: easeColor(b.ease),
                                }}
                              />
                            );
                          })}
                        </span>
                        <span
                          className="w-12 shrink-0 text-right text-xs font-bold"
                          style={{ color: r >= 60 ? "var(--rx-ok)" : r >= 40 ? "var(--rx-warn)" : "var(--rx-err)" }}
                        >
                          {r}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-xs text-[var(--rx-fg-dim)]">
                近 {rangeDays} 天没有复习记录
              </p>
            )}
          </CardContent>
        </Card>
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
