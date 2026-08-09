import { CalendarDays, Layers, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
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
} from "@reasonix/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast, toastError } from "../components/ToasterLite";
import { anki } from "../lib/anki/actions";
import { useDeckTree } from "../lib/anki/query";
import {
  getDaily,
  getWatermark,
  localDate,
  rebuildDeck,
  syncDeck,
} from "../lib/db/stats";
import { inTauri } from "../lib/anki/transport";

/** 全局或单牌组两种口径：全局走 getNumCardsReviewedByDay，单牌组走本地 SQLite */
type Scope = "global" | string; // string = deckName

export function StatsView() {
  const decksQ = useDeckTree();
  const decks = decksQ.data?.decks ?? {};
  const stats = decksQ.data?.stats ?? {};
  const deckNames = Object.keys(decks);

  const [scope, setScope] = useState<Scope>("global");
  const [daily, setDaily] = useState<Map<string, number>>(new Map());
  const [watermark, setWatermark] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const todayQ = useQuery({
    queryKey: ["stats", "today"],
    queryFn: () => anki.getNumCardsReviewedToday(),
  });
  const globalQ = useQuery({
    queryKey: ["stats", "byDay"],
    queryFn: () => anki.getNumCardsReviewedByDay(),
    enabled: scope === "global",
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
      const rows = await getDaily(id);
      setDaily(new Map(rows.map((r) => [r.date, r.reviews])));
      setWatermark(await getWatermark(id));
    } catch (e) {
      toastError("统计加载失败", e);
    } finally {
      setBusy(false);
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
          <Heatmap daily={daily} />
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
  return (
    <div className="rounded-[var(--rx-r-m)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] p-3">
      <div className="flex items-center gap-1.5 text-2xs text-[var(--rx-fg-faint)]">
        <span style={accent ? { color: "var(--rx-accent)" } : undefined}>{icon}</span>
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold"
        style={accent ? { color: "var(--rx-accent)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

/* ---------------- 热力图（近 ~26 周） ---------------- */

const WEEKS = 26;

function Heatmap({ daily }: { daily: Map<string, number> }) {
  const { grid, max } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 对齐到周一起始，往前推 WEEKS 周
    const start = new Date(today);
    const day = (start.getDay() + 6) % 7; // 0=周一
    start.setDate(start.getDate() - day - (WEEKS - 1) * 7);

    const cols: { date: string; count: number }[][] = [];
    let m = 0;
    const cursor = new Date(start);
    for (let w = 0; w < WEEKS; w++) {
      const col: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        if (cursor > today) break;
        const key = localDate(cursor.getTime());
        const count = daily.get(key) ?? 0;
        if (count > m) m = count;
        col.push({ date: key, count });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }
    return { grid: cols, max: m };
  }, [daily]);

  const level = (count: number): number => {
    if (count === 0) return 0;
    if (max <= 1) return 1;
    return Math.min(4, 1 + Math.floor(((count - 1) / max) * 4));
  };

  const COLORS = [
    "var(--rx-bg-soft)",
    "color-mix(in srgb, var(--rx-accent) 25%, transparent)",
    "color-mix(in srgb, var(--rx-accent) 45%, transparent)",
    "color-mix(in srgb, var(--rx-accent) 70%, transparent)",
    "var(--rx-accent)",
  ];

  return (
    <div>
      <div className="flex gap-1">
        {grid.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date} · ${cell.count} 张`}
                className="h-3 w-3 rounded-[2px]"
                style={{ background: COLORS[level(cell.count)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-2xs text-[var(--rx-fg-faint)]">
        <span>少</span>
        {COLORS.map((c, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />
        ))}
        <span>多</span>
        {max > 0 && <span className="ml-2">峰值 {max} 张/天</span>}
      </div>
    </div>
  );
}
