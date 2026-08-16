import {
  Award,
  BarChart3,
  Calendar,
  CalendarDays,
  Clock,
  Copy,
  Droplets,
  Flame,
  History,
  Layers,
  RefreshCw,
  Search,
  Trash2,
  Waves,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@reasonix/ui";
import { NumberTicker } from "../components/NumberTicker";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, memo, useRef, useState, type ReactNode } from "react";
import { toast, toastError } from "../components/ToasterLite";
import { anki } from "../lib/anki/actions";
import { useDeckTree } from "../lib/anki/query";
import {
  getDaily,
  getDailyDetail,
  getWatermark,
  localDate,
  rebuildDeck,
  syncDeck,
  type DailyDetailRow,
} from "../lib/db/stats";
import { inTauri } from "../lib/anki/transport";
import { useSettingsStore } from "../stores/settings";
import { useAppStore } from "../stores/app";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/ContextMenu";
import {
  HEATMAP_THEMES,
  FluidWaveWaterLines,
  type HeatmapThemeConfig,
  type HeatmapThemeId,
} from "./settings/heatmapPreview";

/** 全局或单牌组两种口径：全局走 getNumCardsReviewedByDay，单牌组走本地 SQLite */
type Scope = "global" | string; // string = deckName

const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function StatsView() {
  const decksQ = useDeckTree();
  const decks = decksQ.data?.decks ?? {};
  const stats = decksQ.data?.stats ?? {};
  const deckNames = Object.keys(decks);

  const [scope, setScope] = useState<Scope>("global");
  const [daily, setDaily] = useState<Map<string, number>>(new Map());
  const [watermark, setWatermark] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // 单牌组加载请求序号：快速切换 scope 时旧请求不覆盖新结果
  const loadSeq = useRef(0);

  const todayQ = useQuery({
    queryKey: ["stats", "today"],
    queryFn: () => anki.getNumCardsReviewedToday(),
    // 复习会话结束会刷新牌组数据，但本计数不在失效范围；挂载即重取保持新鲜（不继承全局 30s staleTime）
    staleTime: 0,
  });
  const globalQ = useQuery({
    queryKey: ["stats", "byDay"],
    queryFn: () => anki.getNumCardsReviewedByDay(),
    enabled: scope === "global",
    staleTime: 0,
  });

  const selectedDeckId = scope !== "global" ? decks[scope] : undefined;

  // 全局口径：直接用接口数据
  useEffect(() => {
    if (scope === "global" && globalQ.data) {
      setDaily(new Map(globalQ.data));
      setWatermark(null);
    }
  }, [scope, globalQ.data]);

  // 单牌组口径：先增量同步，再读本地聚合表
  const loadDeck = async (name: string, id: number, rebuild = false) => {
    const seq = ++loadSeq.current; // 递增请求序号：旧请求结果不再覆盖新 scope
    setBusy(true);
    try {
      if (rebuild) {
        await rebuildDeck(id, name);
        toast({ title: "已重建本地统计", description: name });
      } else {
        const { inserted } = await syncDeck(id, name);
        if (inserted > 0) {
          toast({ title: "已增量同步", description: `${name} · 新增 ${inserted} 条复习记录` });
        }
      }
      if (seq !== loadSeq.current) return; // 已被更新的请求取代
      const rows = await getDaily(id);
      if (seq !== loadSeq.current) return;
      setDaily(new Map(rows.map((r) => [r.date, r.reviews])));
      const wm = await getWatermark(id);
      if (seq !== loadSeq.current) return;
      setWatermark(wm);
    } catch (e) {
      toastError("统计加载失败", e);
    } finally {
      if (seq === loadSeq.current) setBusy(false);
    }
  };

  useEffect(() => {
    if (scope !== "global" && selectedDeckId != null) {
      void loadDeck(scope, selectedDeckId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selectedDeckId]);

  const totals = useMemo(() => {
    let cards = 0;
    let newLeft = 0;
    let due = 0;
    for (const id of Object.values(decks)) {
      const st = stats[String(id)];
      if (!st) continue;
      cards += st.total_in_deck;
      newLeft += st.new_count;
      due += st.new_count + st.learn_count + st.review_count;
    }
    return { cards, newLeft, due };
  }, [decks, stats]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      {/* 汇总卡 */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="今日已复习"
          value={todayQ.data ?? "—"}
          accent
        />
        <SummaryCard icon={<Layers className="h-4 w-4" />} label="总卡片" value={totals.cards} />
        <SummaryCard icon={<Layers className="h-4 w-4" />} label="今日到期" value={totals.due} />
        <SummaryCard icon={<Layers className="h-4 w-4" />} label="新卡剩余" value={totals.newLeft} />
      </div>

      {/* 热力图面板 */}
      <div className="rounded-[var(--rx-r-l)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger className="w-56" aria-label="统计范围">
                <SelectValue placeholder="选择范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">全局（所有牌组）</SelectItem>
                {deckNames.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {watermark != null && (
              <span className="text-2xs text-[var(--rx-fg-faint)]">
                同步至 {localDate(watermark)}
              </span>
            )}
          </div>

          {scope !== "global" && selectedDeckId != null && inTauri && (
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void loadDeck(scope, selectedDeckId)}
                className="rx-press"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                增量同步
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void loadDeck(scope, selectedDeckId, true)}
                className="rx-press"
              >
                <Trash2 className="h-3.5 w-3.5" />
                重建
              </Button>
            </div>
          )}
        </div>

        {scope === "global" && globalQ.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Heatmap daily={daily} scope={scope} />
        )}

        {scope !== "global" && !inTauri && (
          <p className="mt-2 text-xs text-[var(--rx-fg-faint)]">
            浏览器调试模式下无本地 SQLite，单牌组统计需在 Tauri 桌面模式查看。
          </p>
        )}
      </div>

      {/* 牌组汇总表 */}
      <div className="rounded-[var(--rx-r-l)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] p-1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-3">牌组</TableHead>
              <TableHead className="text-right">新卡余</TableHead>
              <TableHead className="text-right">学习中</TableHead>
              <TableHead className="text-right">到期复习</TableHead>
              <TableHead className="pr-3 text-right">总数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deckNames.map((name) => {
              const st = stats[String(decks[name])];
              if (!st) return null;
              return (
                <TableRow
                  key={name}
                  className="cursor-pointer"
                  onClick={() => setScope(name)}
                >
                  <TableCell className="max-w-56 truncate pl-3">{name}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="text-2xs font-normal">
                      {st.new_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">{st.learn_count}</TableCell>
                  <TableCell className="text-right text-xs">{st.review_count}</TableCell>
                  <TableCell className="pr-3 text-right text-xs text-[var(--rx-fg-faint)]">
                    {st.total_in_deck}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ---------------- 汇总卡 ---------------- */

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  const numericValue = typeof value === "number" ? value : Number(value);
  const isNumeric = Number.isFinite(numericValue);

  return (
    <div className="rounded-[var(--rx-r-m)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] p-3">
      <div className="flex items-center gap-1.5 text-2xs text-[var(--rx-fg-faint)]">
        <span style={accent ? { color: "var(--rx-accent)" } : undefined}>{icon}</span>
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={accent ? { color: "var(--rx-accent)" } : undefined}
      >
        {isNumeric ? (
          <NumberTicker value={numericValue} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}


/* ---------------- 记忆热力图（从 v1 完整接入：液态/经典双风格 + 主题色 + 日明细） ---------------- */

type TimeRange = 13 | 26 | 52; // 季度 (13周) / 半年 (26周) / 全年 (52周)

function DayStatsDetailDialog({
  open,
  onOpenChange,
  date,
  count,
  scope,
  selectedDeckId,
  onSearchInBrowse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  count: number;
  scope: Scope;
  selectedDeckId?: number;
  onSearchInBrowse: (query: string) => void;
}) {
  const [detail, setDetail] = useState<DailyDetailRow | null>(null);

  useEffect(() => {
    if (!open || !date) {
      setDetail(null);
      return;
    }
    let alive = true;
    getDailyDetail(date, scope !== "global" ? selectedDeckId : undefined)
      .then((res) => {
        if (alive) setDetail(res);
      })
      .catch(() => {
        if (alive) setDetail(null);
      });

    return () => {
      alive = false;
    };
  }, [open, date, scope, selectedDeckId]);

  if (!date) return null;

  const dateObj = new Date(date);
  const dayOfWeekStr = `周${WEEK_DAYS[(dateObj.getDay() + 6) % 7]}`;

  const totalReviews = detail?.reviews ?? count;
  const timeMs = detail?.time_ms ?? 0;
  const minutes = Math.round(timeMs / 60000);
  const seconds = Math.round((timeMs % 60000) / 1000);

  const again = detail?.again ?? 0;
  const hard = detail?.hard ?? 0;
  const good = detail?.good ?? 0;
  const easy = detail?.easy ?? 0;
  const sumRated = again + hard + good + easy;

  const againPct = sumRated > 0 ? Math.round((again / sumRated) * 100) : 0;
  const hardPct = sumRated > 0 ? Math.round((hard / sumRated) * 100) : 0;
  const goodPct = sumRated > 0 ? Math.round((good / sumRated) * 100) : 0;
  const easyPct = sumRated > 0 ? Math.round((easy / sumRated) * 100) : 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cellDate = new Date(date);
  cellDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((now.getTime() - cellDate.getTime()) / (1000 * 60 * 60 * 24));

  let searchQuery = "";
  if (diffDays === 0) {
    searchQuery = scope !== "global" ? `deck:"${scope}" rated:1` : `rated:1`;
  } else if (diffDays > 0) {
    searchQuery = scope !== "global"
      ? `deck:"${scope}" rated:${diffDays + 1} -rated:${diffDays}`
      : `rated:${diffDays + 1} -rated:${diffDays}`;
  } else {
    searchQuery = scope !== "global" ? `deck:"${scope}"` : "";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-body-nm font-bold">
            <Calendar className="h-5 w-5 text-[var(--rx-accent)]" />
            <span>{date} ({dayOfWeekStr}) 复习明细</span>
          </DialogTitle>
          <DialogDescription className="text-caption-xs text-[var(--rx-fg-faint)]">
            {scope === "global" ? "全局所有牌组复习指标汇总" : `牌组「${scope}」复习指标`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 核心数据卡片 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] p-3">
              <div className="text-micro-xxs text-[var(--rx-fg-faint)] font-bold">总复习卡片</div>
              <div className="mt-1 text-2xl font-black font-mono text-[var(--rx-fg)]">
                {totalReviews} <span className="text-caption-xs font-normal">张</span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] p-3">
              <div className="text-micro-xxs text-[var(--rx-fg-faint)] font-bold flex items-center gap-1">
                <Clock className="h-3 w-3" />
                复习总耗时
              </div>
              <div className="mt-1 text-2xl font-black font-mono text-[var(--rx-fg)]">
                {minutes > 0 ? (
                  <>
                    {minutes} <span className="text-caption-xs font-normal">分</span>
                  </>
                ) : (
                  <>
                    {seconds} <span className="text-caption-xs font-normal">秒</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 评分比例分布 */}
          <div className="rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] p-3.5 space-y-3">
            <div className="flex items-center justify-between text-caption-xs font-bold text-[var(--rx-fg)]">
              <span>评分按钮分布 (Ease Ratio)</span>
              {sumRated > 0 && (
                <span className="text-micro-xxs text-[var(--rx-fg-faint)]">共计 {sumRated} 次评分记录</span>
              )}
            </div>

            {sumRated > 0 ? (
              <div className="space-y-2.5">
                {/* Again */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-2xs font-mono font-medium">
                    <span className="flex items-center gap-1 text-rose-500 font-bold">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      忘记 (Again / 1)
                    </span>
                    <span className="text-[var(--rx-fg)] font-bold">
                      {again} 张 ({againPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--rx-bg-soft)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all duration-500"
                      style={{ width: `${againPct}%` }}
                    />
                  </div>
                </div>

                {/* Hard */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-2xs font-mono font-medium">
                    <span className="flex items-center gap-1 text-amber-500 font-bold">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      困难 (Hard / 2)
                    </span>
                    <span className="text-[var(--rx-fg)] font-bold">
                      {hard} 张 ({hardPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--rx-bg-soft)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${hardPct}%` }}
                    />
                  </div>
                </div>

                {/* Good */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-2xs font-mono font-medium">
                    <span className="flex items-center gap-1 text-emerald-500 font-bold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      良好 (Good / 3)
                    </span>
                    <span className="text-[var(--rx-fg)] font-bold">
                      {good} 张 ({goodPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--rx-bg-soft)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${goodPct}%` }}
                    />
                  </div>
                </div>

                {/* Easy */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-2xs font-mono font-medium">
                    <span className="flex items-center gap-1 text-blue-500 font-bold">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      简单 (Easy / 4)
                    </span>
                    <span className="text-[var(--rx-fg)] font-bold">
                      {easy} 张 ({easyPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--rx-bg-soft)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${easyPct}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-caption-xs text-[var(--rx-fg-faint)]">
                {totalReviews > 0
                  ? "单牌组详细评分比例已从 Anki 同步或可在右上角「增量同步」后完整显示"
                  : "该日暂无复习评分记录"}
              </div>
            )}
          </div>

          {/* Anki 检索语法提示 */}
          <div className="rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] p-2.5 flex items-center justify-between gap-2 text-2xs">
            <span className="font-mono text-[var(--rx-fg-faint)] truncate">
              {searchQuery}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-micro-xxs font-bold rx-press shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(searchQuery);
                toast({ title: "已复制检索语法", description: searchQuery });
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              复制
            </Button>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-caption-xs"
          >
            关闭
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onSearchInBrowse(searchQuery);
            }}
            className="text-caption-xs font-bold rx-press"
          >
            <Search className="h-3.5 w-3.5 mr-1" />
            在牌组浏览器中检索
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- 热力格单元组件（支持流体注水与经典方格） ---------------- */

const HeatmapCell = memo(function HeatmapCellInner({
  count,
  target,
  themeConfig,
  heatmapStyle,
  enableClassicWaveReveal,
  waveDelayMs,
  enableWave,
  waveSpeed,
  showDayNumber,
  dayNum,
  onHover,
  onLeave,
  weeks,
  isFuture,
  date,
  scope,
  onSearchCards,
  onViewDetails,
  onViewHistory,
}: {
  count: number;
  target: number;
  themeConfig: HeatmapThemeConfig;
  heatmapStyle: "fluid" | "classic";
  enableClassicWaveReveal: boolean;
  waveDelayMs: number;
  enableWave: boolean;
  waveSpeed: "slow" | "normal" | "fast";
  showDayNumber: boolean;
  dayNum: number;
  onHover: (info: { date: string; count: number; dayOfWeek: string; fillPercent: number }) => void;
  onLeave: () => void;
  weeks: TimeRange;
  isFuture?: boolean;
  date: string;
  scope: Scope;
  onSearchCards: (date: string) => void;
  onViewDetails: (date: string, count: number) => void;
  onViewHistory: (date: string) => void;
}) {
  // Hook 必须先于任何早退执行（Rules of Hooks）：isFuture 早退放在全部 hook 之后，
  // 否则同一实例 isFuture 翻转（跨午夜 + daily 更新）时 hook 数量变化会触发
  // "Rendered more hooks" 崩溃。isFuture 分支仅消耗少量无效 useMemo 计算，无副作用。
  const hasCount = count > 0;
  // 水位线百分比计算：至少 16% 保障微量刷卡可见，满目标 100% 溢满
  const fillPercent = hasCount
    ? Math.min(100, Math.max(16, Math.round((count / target) * 100)))
    : 0;
  const isFull = fillPercent >= 100;

  // 经典色阶索引 (0 ~ 4)
  const classicLevel = useMemo(() => {
    if (count === 0) return 0;
    const ratio = count / target;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.50) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }, [count, target]);

  // 波速秒数
  const speedSec = waveSpeed === "fast" ? "1.8s" : waveSpeed === "slow" ? "4.5s" : "3s";

  const searchQuery = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cellDate = new Date(date);
    cellDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((now.getTime() - cellDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return scope !== "global" ? `deck:"${scope}" rated:1` : `rated:1`;
    } else if (diffDays > 0) {
      return scope !== "global"
        ? `deck:"${scope}" rated:${diffDays + 1} -rated:${diffDays}`
        : `rated:${diffDays + 1} -rated:${diffDays}`;
    }
    return scope !== "global" ? `deck:"${scope}"` : "";
  }, [date, scope]);

  if (isFuture) {
    return (
      <div
        className={cn(
          "w-full aspect-square opacity-0 pointer-events-none",
          weeks === 13
            ? "rounded-md sm:rounded-lg"
            : weeks === 26
            ? "rounded-[3px] sm:rounded-md"
            : "rounded-[2px] sm:rounded-[3px]"
        )}
      />
    );
  }

  // 1. 经典普通纯色方格模式（GitHub / Anki 原生经典质感，支持 Wave Reveal 波浪式揭示动画）
  const classicCellNode = heatmapStyle === "classic" ? (
    <div
      onMouseEnter={() =>
        onHover({
          date,
          count,
          dayOfWeek: `周${WEEK_DAYS[(new Date(date).getDay() + 6) % 7]}`,
          fillPercent: Math.min(100, Math.round((count / target) * 100)),
        })
      }
      onMouseLeave={onLeave}
      className={cn(
        "w-full aspect-square cursor-pointer flex items-center justify-center select-none transition-all duration-150 hover:scale-115 hover:z-10 shadow-2xs",
        weeks === 13
          ? "rounded-md sm:rounded-lg"
          : weeks === 26
          ? "rounded-[3px] sm:rounded-md"
          : "rounded-[2px] sm:rounded-[3px]",
        count === 0 && "border border-[var(--rx-border-soft)] hover:border-[var(--rx-fg-faint)]",
        enableClassicWaveReveal && "rx-classic-cell-reveal"
      )}
      style={{
        backgroundColor: themeConfig.colors[classicLevel],
        animationDelay: enableClassicWaveReveal ? `${waveDelayMs}ms` : undefined,
      }}
    >
      {/* 方格日期数字 */}
      {(weeks === 13 || showDayNumber) && (
        <span
          className={cn(
            "relative z-10 text-[9px] sm:text-[10px] font-mono leading-none transition-colors",
            hasCount
              ? classicLevel >= 2
                ? "text-white font-bold drop-shadow-xs"
                : "text-[var(--rx-fg)] font-semibold"
              : "text-[var(--rx-fg-faint)] opacity-40 font-normal"
          )}
        >
          {dayNum}
        </span>
      )}
    </div>
  ) : (
    /* 2. 现代流体注水模式（动态水杯注水、双层水纹波浪与满水溢光） */
    <div
      onMouseEnter={() =>
        onHover({
          date,
          count,
          dayOfWeek: `周${WEEK_DAYS[(new Date(date).getDay() + 6) % 7]}`,
          fillPercent: Math.min(100, Math.round((count / target) * 100)),
        })
      }
      onMouseLeave={onLeave}
      className={cn(
        "rx-liquid-cell w-full aspect-square cursor-pointer flex items-center justify-center select-none shadow-2xs border border-[var(--rx-border-soft)]",
        weeks === 13
          ? "rounded-md sm:rounded-lg"
          : weeks === 26
          ? "rounded-[3px] sm:rounded-md"
          : "rounded-[2px] sm:rounded-[3px]",
        isFull && enableWave && "rx-liquid-full-active"
      )}
      style={
        {
          background: "var(--rx-bg-soft)",
          borderColor: hasCount ? "transparent" : "var(--rx-border-soft)",
          "--wave-glow": themeConfig.glow,
        } as React.CSSProperties
      }
    >
      {hasCount && (
        <div
          className="absolute inset-x-0 bottom-0 overflow-visible rx-liquid-body transition-all duration-300 pointer-events-none"
          style={{
            height: `${fillPercent}%`,
            background: enableWave
              ? themeConfig.liquidGrad
              : themeConfig.colors[classicLevel],
            boxShadow: isFull ? `0 0 8px ${themeConfig.glow}` : undefined,
          }}
        >
          {/* 两条起伏交错的动态流水波浪线 */}
          {enableWave && fillPercent < 100 && (
            <FluidWaveWaterLines
              waveColor={themeConfig.waveColor}
              waveBack={themeConfig.waveBack}
              speedSec={speedSec}
            />
          )}

          {/* 满水 100% 溢水流光闪耀 */}
          {enableWave && isFull && (
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-white/35 animate-pulse" />
          )}
        </div>
      )}

      {/* 方格日期数字（13周大格或用户开启数字时显示） */}
      {(weeks === 13 || showDayNumber) && (
        <span
          className={cn(
            "relative z-10 text-[9px] sm:text-[10px] font-mono leading-none transition-colors",
            hasCount
              ? fillPercent > 50
                ? "text-white font-bold drop-shadow-xs"
                : "text-[var(--rx-fg)] font-semibold"
              : "text-[var(--rx-fg-faint)] opacity-40 font-normal"
          )}
        >
          {dayNum}
        </span>
      )}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {classicCellNode}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuLabel className="font-mono text-2xs">
          📅 {date} ({`周${WEEK_DAYS[(new Date(date).getDay() + 6) % 7]}`}) · {count} 张复习
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => onViewHistory(date)}
          className="cursor-pointer font-medium"
        >
          <History className="mr-2 h-4 w-4 text-[var(--rx-accent)]" />
          查看当天学习轨迹
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onSearchCards(date)}
          className="cursor-pointer font-medium"
        >
          <Search className="mr-2 h-4 w-4 text-[var(--rx-accent)]" />
          检索这天复习的所有卡片
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onViewDetails(date, count)}
          className="cursor-pointer font-medium"
        >
          <BarChart3 className="mr-2 h-4 w-4 text-emerald-500" />
          查看该日复习明细指标
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            navigator.clipboard.writeText(date);
            toast({ title: `已复制日期：${date}` });
          }}
          className="cursor-pointer text-caption-xs text-[var(--rx-fg-faint)]"
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          复制日期 ({date})
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            navigator.clipboard.writeText(searchQuery);
            toast({ title: "已复制 Anki 检索语法", description: searchQuery });
          }}
          className="cursor-pointer text-caption-xs text-[var(--rx-fg-faint)]"
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          复制检索语法 ({searchQuery})
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

/* ---------------- 优化升级后的热力图主组件 ---------------- */

function Heatmap({
  daily,
  scope = "global",
  selectedDeckId,
}: {
  daily: Map<string, number>;
  scope?: Scope;
  selectedDeckId?: number;
}) {
  const [weeks, setWeeks] = useState<TimeRange>(26);
  const [revealKey, setRevealKey] = useState(0);
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const setView = useAppStore((s) => s.setView);
  const setBrowseQuery = useAppStore((s) => s.setBrowseQuery);
  const setHistoryDate = useAppStore((s) => s.setHistoryDate);

  const [detailDate, setDetailDate] = useState<{ date: string; count: number } | null>(null);

  const heatmapStyle = settings.heatmapStyle || "fluid";
  const enableClassicWaveReveal = settings.heatmapClassicWaveReveal ?? true;
  const themeId = settings.heatmapTheme || "emerald";
  const themeConfig = HEATMAP_THEMES[themeId] || HEATMAP_THEMES.emerald;
  const enableWave = settings.heatmapWaveEffect ?? true;
  const targetDaily = settings.heatmapTargetDaily || 30;
  const waveSpeed = settings.heatmapWaveSpeed || "normal";
  const showDayNumber = settings.heatmapShowDayNumber || false;

  // 当时间范围、主题色或风格改变时触发波浪揭示动画
  useEffect(() => {
    setRevealKey((k) => k + 1);
  }, [weeks, themeId, heatmapStyle]);

  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    dayOfWeek: string;
    fillPercent: number;
  } | null>(null);

  const handleSearchCards = useCallback(
    (date: string) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const cellDate = new Date(date);
      cellDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((now.getTime() - cellDate.getTime()) / (1000 * 60 * 60 * 24));

      let q = "";
      if (diffDays === 0) {
        q = scope !== "global" ? `deck:"${scope}" rated:1` : `rated:1`;
      } else if (diffDays > 0) {
        q = scope !== "global"
          ? `deck:"${scope}" rated:${diffDays + 1} -rated:${diffDays}`
          : `rated:${diffDays + 1} -rated:${diffDays}`;
      } else {
        q = scope !== "global" ? `deck:"${scope}"` : "";
      }

      setBrowseQuery(q);
      setView("browse");
      toast({
        title: `🔍 已跳转至牌组浏览器`,
        description: `检索语句: ${q}`,
      });
    },
    [scope, setBrowseQuery, setView],
  );

  const handleViewDetails = useCallback((date: string, count: number) => {
    setDetailDate({ date, count });
  }, []);

  // 热力格右键「查看当天学习轨迹」：注入日期 → 切学习轨迹视图
  const handleViewHistory = useCallback(
    (date: string) => {
      setHistoryDate(date);
      setView("history");
      toast({ title: "已打开学习轨迹", description: date });
    },
    [setHistoryDate, setView],
  );

  const handleCellHover = useCallback(
    (cell: { date: string; count: number; dayOfWeek: string; fillPercent: number }) => {
      setHoveredCell(cell);
    },
    [],
  );
  const handleCellLeave = useCallback(() => setHoveredCell(null), []);

  // 计算热力图网格、月份标记与连胜指标
  const { grid, max, monthHeaders, streakStats } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 对齐到周一起始，往前推 weeks 周
    const start = new Date(today);
    const day = (start.getDay() + 6) % 7; // 0=周一
    start.setDate(start.getDate() - day - (weeks - 1) * 7);

    const cols: { date: string; count: number; dayIndex: number; isFuture: boolean }[][] = [];
    let m = 0;
    let totalCards = 0;
    let activeDays = 0;
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;

    const todayKey = localDate(today.getTime());
    let todayReviews = 0;

    const cursor = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const col: { date: string; count: number; dayIndex: number; isFuture: boolean }[] = [];
      const colStartMonth = cursor.getMonth();

      if (colStartMonth !== lastMonth) {
        lastMonth = colStartMonth;
        const monthNames = [
          "1月", "2月", "3月", "4月", "5月", "6月",
          "7月", "8月", "9月", "10月", "11月", "12月"
        ];
        const minGap = weeks === 52 ? 3 : 2;
        const lastColIndex = months.length > 0 ? months[months.length - 1].colIndex : -99;
        if (w - lastColIndex >= minGap && weeks - w >= 2) {
          months.push({ label: monthNames[colStartMonth], colIndex: w });
        }
      }

      for (let d = 0; d < 7; d++) {
        const isFuture = cursor > today;
        const key = localDate(cursor.getTime());
        const count = isFuture ? 0 : (daily.get(key) ?? 0);
        if (!isFuture) {
          if (key === todayKey) todayReviews = count;
          if (count > m) m = count;
          if (count > 0) {
            totalCards += count;
            activeDays++;
          }
        }
        col.push({ date: key, count, dayIndex: d, isFuture });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }

    // 计算当前连续打卡天数 (Current Streak)
    let currentStreak = 0;
    const streakCheck = new Date(today);
    while (true) {
      const key = localDate(streakCheck.getTime());
      const c = daily.get(key) ?? 0;
      if (c > 0) {
        currentStreak++;
        streakCheck.setDate(streakCheck.getDate() - 1);
      } else {
        // 如果今天是0，但昨天打卡了，仍保留昨天的连胜
        if (streakCheck.getTime() === today.getTime()) {
          streakCheck.setDate(streakCheck.getDate() - 1);
          const yesterdayKey = localDate(streakCheck.getTime());
          if ((daily.get(yesterdayKey) ?? 0) > 0) {
            continue;
          }
        }
        break;
      }
    }

    // 计算最长连续打卡天数 (Longest Streak in period)
    let longestStreak = 0;
    let tempStreak = 0;
    const scan = new Date(start);
    while (scan <= today) {
      const key = localDate(scan.getTime());
      const c = daily.get(key) ?? 0;
      if (c > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
      scan.setDate(scan.getDate() + 1);
    }

    const totalDaysInRange = cols.reduce((acc, col) => acc + col.length, 0);
    const activeRate = totalDaysInRange > 0 ? Math.round((activeDays / totalDaysInRange) * 100) : 0;
    const dailyAvg = activeDays > 0 ? Math.round(totalCards / activeDays) : 0;

    return {
      grid: cols,
      max: m,
      monthHeaders: months,
      todayCount: todayReviews,
      streakStats: {
        currentStreak,
        longestStreak,
        totalCards,
        activeDays,
        activeRate,
        dailyAvg,
      },
    };
  }, [daily, weeks]);

  return (
    <div className="space-y-4">
      {/* 活跃度洞察徽章栏 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900/50 border border-slate-200/60 dark:border-neutral-800/60 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] text-[var(--rx-fg-faint)] font-medium">当前连胜</div>
            <div className="text-sm font-black font-mono text-orange-600 dark:text-orange-400">
              {streakStats.currentStreak} <span className="text-xs font-normal">天</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <Award className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] text-[var(--rx-fg-faint)] font-medium">期间最高连胜</div>
            <div className="text-sm font-black font-mono">
              {streakStats.longestStreak} <span className="text-xs font-normal">天</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] text-[var(--rx-fg-faint)] font-medium">活跃打卡天数</div>
            <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
              {streakStats.activeDays} <span className="text-xs font-normal">天 ({streakStats.activeRate}%)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] text-[var(--rx-fg-faint)] font-medium">活跃日均复习</div>
            <div className="text-sm font-black font-mono">
              {streakStats.dailyAvg} <span className="text-xs font-normal">张/天</span>
            </div>
          </div>
        </div>
      </div>

      {/* 控制栏：风格模式、时间范围、主题色盘与水波设置 */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--rx-bg-elev)] p-2.5 rounded-2xl border border-[var(--rx-border-soft)] shadow-xs">
        {/* 左侧：风格切换（流体注水 vs 经典方格）与时间范围 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 渲染风格切换 Segmented Switch */}
          <div className="flex items-center gap-0.5 bg-[var(--rx-bg-soft)] p-0.5 rounded-xl border border-[var(--rx-border-soft)]">
            <button
              onClick={() => {
                updateSetting("heatmapStyle", "fluid");
                toast({ title: "🌊 已切换至现代流体注水热力图" });
              }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all text-2xs",
                heatmapStyle === "fluid"
                  ? "bg-[var(--rx-bg-elev)] text-[var(--rx-accent)] shadow-xs"
                  : "text-[var(--rx-fg-faint)] hover:text-[var(--rx-fg)]"
              )}
            >
              <Waves className="h-3.5 w-3.5" />
              <span>流体注水</span>
            </button>
            <button
              onClick={() => {
                updateSetting("heatmapStyle", "classic");
                toast({ title: "🟩 已切换至经典纯色方格热力图" });
              }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all text-2xs",
                heatmapStyle === "classic"
                  ? "bg-[var(--rx-bg-elev)] text-[var(--rx-accent)] shadow-xs"
                  : "text-[var(--rx-fg-faint)] hover:text-[var(--rx-fg)]"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>经典方格</span>
            </button>
          </div>

          {/* 时间范围切换 */}
          <div className="flex items-center gap-1 bg-[var(--rx-bg-soft)] p-0.5 rounded-xl border border-[var(--rx-border-soft)]">
            <button
              onClick={() => setWeeks(13)}
              className={`px-2 py-1 rounded-lg font-bold transition-colors text-2xs ${
                weeks === 13
                  ? "bg-[var(--rx-bg-elev)] text-[var(--rx-fg)] shadow-xs"
                  : "text-[var(--rx-fg-faint)] hover:text-[var(--rx-fg)]"
              }`}
            >
              近3月
            </button>
            <button
              onClick={() => setWeeks(26)}
              className={`px-2 py-1 rounded-lg font-bold transition-colors text-2xs ${
                weeks === 26
                  ? "bg-[var(--rx-bg-elev)] text-[var(--rx-fg)] shadow-xs"
                  : "text-[var(--rx-fg-faint)] hover:text-[var(--rx-fg)]"
              }`}
            >
              近半年
            </button>
            <button
              onClick={() => setWeeks(52)}
              className={`px-2 py-1 rounded-lg font-bold transition-colors text-2xs ${
                weeks === 52
                  ? "bg-[var(--rx-bg-elev)] text-[var(--rx-fg)] shadow-xs"
                  : "text-[var(--rx-fg-faint)] hover:text-[var(--rx-fg)]"
              }`}
            >
              近1年
            </button>
          </div>
        </div>

        {/* 中间/右侧：主题色盘与每日目标调整 */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 主题色系切换（8 大主题） */}
          <div className="flex items-center gap-1.5 text-2xs text-[var(--rx-fg-faint)]">
            <span className="font-medium">主题:</span>
            <div className="flex items-center gap-1 bg-[var(--rx-bg-soft)] p-1 rounded-full border border-[var(--rx-border-soft)]">
              {(Object.keys(HEATMAP_THEMES) as HeatmapThemeId[]).map((tid) => {
                const item = HEATMAP_THEMES[tid];
                const active = themeId === tid;
                return (
                  <button
                    key={`palette_btn_${tid}`}
                    onClick={() => {
                      updateSetting("heatmapTheme", tid);
                      toast({ title: `已切换热力图主题: ${item.name} ${item.emoji}` });
                    }}
                    className={`h-4 w-4 rounded-full transition-all relative ${
                      active
                        ? "ring-2 ring-offset-1 ring-[var(--rx-fg)] scale-115 shadow-xs"
                        : "opacity-65 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{ background: item.previewColor }}
                    title={`${item.name} (${item.emoji})`}
                  />
                );
              })}
            </div>
            <span className="text-[11px] font-bold text-[var(--rx-fg)] ml-0.5">
              {themeConfig.name}
            </span>
          </div>

          {/* 满额目标基准快捷调整 */}
          <div className="flex items-center gap-1 bg-[var(--rx-bg-soft)] px-2 py-0.5 rounded-xl border border-[var(--rx-border-soft)] text-2xs">
            <Droplets className="h-3 w-3 text-[var(--rx-fg-faint)]" />
            <span className="text-[var(--rx-fg-faint)]">目标:</span>
            <select
              value={targetDaily}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateSetting("heatmapTargetDaily", val);
                toast({ title: `每日目标已设为 ${val} 张/天` });
              }}
              className="bg-transparent font-mono font-bold text-[var(--rx-fg)] outline-none cursor-pointer"
            >
              <option value={15}>15 张</option>
              <option value={20}>20 张</option>
              <option value={30}>30 张</option>
              <option value={50}>50 张</option>
              <option value={80}>80 张</option>
              <option value={100}>100 张</option>
            </select>
          </div>
        </div>
      </div>

      {/* GitHub 风格时间范围复习统计标题 */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 pt-1">
        <div className="flex items-baseline gap-1.5 text-[var(--rx-fg)] tracking-tight">
          <span className="font-bold font-mono text-[18px] sm:text-[20px] text-[var(--rx-fg)]">
            {streakStats.totalCards.toLocaleString()}
          </span>
          <span className="text-[14px] sm:text-[15px] font-normal text-[var(--rx-fg)]/80">
            {weeks === 52
              ? "reviews in the last year"
              : weeks === 26
              ? "reviews in the last 6 months"
              : "reviews in the last 3 months"}
          </span>
        </div>
      </div>

      {/* 热力图网格主区域（带月份与星期标记，全宽自适应铺满） */}
      <div className="w-full">
        {/* 月份标记行 - 结构与下方网格完全对齐 */}
        <div
          className={cn(
            "flex items-center w-full select-none mb-1.5",
            weeks === 13 ? "gap-1.5 sm:gap-2" : weeks === 26 ? "gap-1 sm:gap-1.5" : "gap-0.5 sm:gap-1"
          )}
        >
          {/* 星期列占位宽度，与下方星期列严格一致 */}
          <div
            className={cn(
              "shrink-0",
              weeks === 13 ? "w-6 sm:w-7" : weeks === 26 ? "w-5 sm:w-6" : "w-4 sm:w-5"
            )}
          />
          {/* 月份绝对定位容器，与下方 flex-1 的热力图网格精确重合 */}
          <div className="flex-1 relative h-4 text-[11px] sm:text-[12px] font-normal text-[var(--rx-fg)]/60 select-none">
            {monthHeaders.map((m, idx) => (
              <span
                key={`month_header_${m.label}_${idx}`}
                className="absolute transition-all leading-none whitespace-nowrap"
                style={{
                  left: `${(m.colIndex / weeks) * 100}%`,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "flex items-start w-full",
            weeks === 13 ? "gap-1.5 sm:gap-2" : weeks === 26 ? "gap-1 sm:gap-1.5" : "gap-0.5 sm:gap-1"
          )}
        >
          {/* 星期标记列（周一至周日） - 严格跟随右侧网格的真实几何高度 */}
          <div
            className={cn(
              "flex flex-col select-none shrink-0 self-stretch justify-between py-0",
              weeks === 13
                ? "w-6 sm:w-7 gap-1.5 sm:gap-2"
                : weeks === 26
                ? "w-5 sm:w-6 gap-1 sm:gap-1.5"
                : "w-4 sm:w-5 gap-0.5 sm:gap-1"
            )}
          >
            {WEEK_DAYS.map((_, idx) => (
              <div
                key={`day_label_${idx}`}
                className="flex-1 flex items-center justify-end pr-1 text-[9px] sm:text-[10px] font-normal text-[var(--rx-fg)]/60 leading-none"
              >
                {idx === 0 ? "一" : idx === 2 ? "三" : idx === 4 ? "五" : idx === 6 ? "日" : ""}
              </div>
            ))}
          </div>

          {/* 热力图列与方格 - 铺满全宽 flex-1，Wave Reveal 动效包裹 */}
          <div
            key={`heatmap_grid_wrap_${revealKey}`}
            className={cn(
              "flex-1 flex w-full",
              weeks === 13 ? "gap-1.5 sm:gap-2" : weeks === 26 ? "gap-1 sm:gap-1.5" : "gap-0.5 sm:gap-1"
            )}
          >
            {grid.map((col, i) => (
              <div
                key={`heatmap_col_${i}`}
                className={cn(
                  "flex-1 flex flex-col min-w-0",
                  weeks === 13 ? "gap-1.5 sm:gap-2" : weeks === 26 ? "gap-1 sm:gap-1.5" : "gap-0.5 sm:gap-1"
                )}
              >
                {col.map((cell, cIdx) => {
                  const count = cell.count;
                  const dateObj = new Date(cell.date);
                  const dayNum = dateObj.getDate();
                  const waveDelayMs = i * 12 + cIdx * 18;

                  return (
                    <HeatmapCell
                      key={`heatmap_cell_${cell.date}_${i}_${cIdx}`}
                      count={count}
                      target={targetDaily}
                      themeConfig={themeConfig}
                      heatmapStyle={heatmapStyle}
                      enableClassicWaveReveal={enableClassicWaveReveal}
                      waveDelayMs={waveDelayMs}
                      enableWave={enableWave}
                      waveSpeed={waveSpeed}
                      showDayNumber={showDayNumber}
                      dayNum={dayNum}
                      weeks={weeks}
                      isFuture={cell.isFuture}
                      date={cell.date}
                      scope={scope}
                      onSearchCards={handleSearchCards}
                      onViewDetails={handleViewDetails}
                      onViewHistory={handleViewHistory}
                      onHover={handleCellHover}
                      onLeave={handleCellLeave}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部悬浮提示与图例 */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-[var(--rx-border-soft)]/50">
        {/* 交互式实时悬浮信息 */}
        <div className="min-h-5 flex items-center gap-2">
          {hoveredCell ? (
            <div className="flex items-center gap-2 font-medium animate-in fade-in duration-150">
              <span className="font-mono font-bold text-[var(--rx-fg)]">
                📅 {hoveredCell.date} ({hoveredCell.dayOfWeek})
              </span>
              <span className="text-[var(--rx-fg-faint)]">·</span>
              <Badge
                variant={hoveredCell.count > 0 ? "default" : "secondary"}
                className="font-mono text-2xs font-bold"
              >
                {hoveredCell.count > 0 ? `${hoveredCell.count} 张卡片` : "无复习记录"}
              </Badge>
              {hoveredCell.count > 0 && (
                <span className="text-2xs text-[var(--rx-fg-faint)]">
                  ({hoveredCell.count >= targetDaily ? "已达标" : `进度 ${hoveredCell.fillPercent}%`})
                </span>
              )}
            </div>
          ) : (
            <div className="text-2xs text-[var(--rx-fg-faint)] flex items-center gap-3 font-mono font-medium">
              <span>
                <strong className="text-[var(--rx-fg)] font-bold">Active</strong> {streakStats.activeDays}d
              </span>
              <span className="text-[var(--rx-border-soft)]">·</span>
              <span>
                <strong className="text-[var(--rx-fg)] font-bold">Longest</strong> {streakStats.longestStreak}d
              </span>
              <span className="text-[var(--rx-border-soft)]">·</span>
              <span>
                <strong className="text-[var(--rx-fg)] font-bold">Current</strong> {streakStats.currentStreak}d
              </span>
            </div>
          )}
        </div>

        {/* 图例（色阶展示） */}
        <div className="flex items-center gap-1.5 text-2xs text-[var(--rx-fg-faint)] font-mono">
          <span>Less</span>
          {themeConfig.colors.map((c, i) => (
            <span
              key={`legend_color_${i}_${c}`}
              className="h-3 w-3 rounded-[3px] shadow-2xs relative overflow-hidden"
              style={{
                background: c,
                border: i === 0 ? "1px solid var(--rx-border-soft)" : "none",
              }}
            />
          ))}
          <span>More</span>
          {max > 0 && <span className="ml-2 font-bold text-[var(--rx-fg)]">单日最高 {max} 张</span>}
        </div>
      </div>

      {/* 单日指标详情弹窗 */}
      <DayStatsDetailDialog
        open={detailDate !== null}
        onOpenChange={(open) => {
          if (!open) setDetailDate(null);
        }}
        date={detailDate?.date ?? null}
        count={detailDate?.count ?? 0}
        scope={scope}
        selectedDeckId={selectedDeckId}
        onSearchInBrowse={(query) => {
          setBrowseQuery(query);
          setView("browse");
        }}
      />
    </div>
  );
}
