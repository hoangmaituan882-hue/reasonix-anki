/**
 * 今日首页仪表盘 UI（props 驱动，从 TodayView.tsx 拆出）。
 * 数据编排仍在 TodayView；本组件只负责呈现。
 */
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
} from "@reasonix/ui";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Clock3,
  PlugZap,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { dueCount, summarizeTodayDecks, type TodayDeckRow } from "./todayUtil";

export interface TodayDashboardProps {
  decks: TodayDeckRow[];
  selectedDeckId: number | null;
  addonAvailable: boolean;
  syncState: "idle" | "syncing" | "error" | "unavailable";
  starting: boolean;
  error?: string | null;
  onSelect(deckId: number): void;
  onStart(deckId: number, deckName: string): void;
}

export function TodayDashboard({
  decks,
  selectedDeckId,
  addonAvailable,
  syncState,
  starting,
  error,
  onSelect,
  onStart,
}: TodayDashboardProps) {
  const selected = decks.find((deck) => deck.id === selectedDeckId) ?? null;
  const totals = summarizeTodayDecks(decks);
  const totalDue = totals.newCount + totals.learningCount + totals.reviewCount;
  const estimatedMinutes = Math.max(1, Math.ceil((totalDue * 9) / 60));
  const syncLabel = {
    idle: "调度就绪",
    syncing: "Anki 同步中",
    error: "同步状态异常",
    unavailable: "配套插件未连接",
  }[syncState];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-6 py-7 lg:px-9">
      <section className="py-2">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">今日学习</h2>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "w-fit gap-1.5 px-2.5 py-1",
              addonAvailable && "rx-accent-soft",
            )}
          >
            {syncState === "syncing" ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
            ) : (
              <PlugZap className="h-3.5 w-3.5" />
            )}
            {syncLabel}
          </Badge>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="今日概览">
        {[
          { label: "新词", value: totals.newCount, icon: Sparkles },
          { label: "学习中", value: totals.learningCount, icon: Brain },
          { label: "到期复习", value: totals.reviewCount, icon: BookOpen },
          { label: "预计用时", value: `${estimatedMinutes} 分`, icon: Clock3 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-2xs text-[var(--rx-fg-faint)]">{label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--rx-r-m)] rx-accent-soft">
                <Icon className="h-4 w-4 text-[var(--rx-accent)]" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!addonAvailable && (
        <Alert>
          <AlertDescription>
            Reasonix 配套插件未就绪。请保持 Anki 打开并确认插件已安装；精确学习入口不会降级到本地随机队列。可点右上角设置 → 「插件与同步」查看安装引导。
          </AlertDescription>
        </Alert>
      )}

      <section className="grid min-h-[22rem] gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">选择牌组</h3>
            <span className="text-2xs text-[var(--rx-fg-faint)]">{decks.length} 个牌组</span>
          </div>
          {decks.map((deck) => {
            const selectedRow = deck.id === selectedDeckId;
            return (
              <button
                key={deck.id}
                type="button"
                aria-label={`${deck.name}，新词 ${deck.newCount}，学习中 ${deck.learningCount}，到期复习 ${deck.reviewCount}`}
                aria-pressed={selectedRow}
                onClick={() => onSelect(deck.id)}
                className={cn(
                  "rx-press flex w-full items-center gap-4 rounded-[var(--rx-r-m)] border px-4 py-3 text-left transition-colors",
                  selectedRow
                    ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]"
                    : "border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] hover:border-[var(--rx-border)]",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--rx-r-m)]",
                    selectedRow ? "rx-accent-soft" : "bg-[var(--rx-bg-soft)]",
                  )}
                >
                  {selectedRow ? (
                    <Check className="h-4 w-4 text-[var(--rx-accent)]" />
                  ) : (
                    <BookOpen className="h-4 w-4 text-[var(--rx-fg-faint)]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{deck.name}</span>
                  <span className="mt-1 flex flex-wrap gap-2 text-2xs text-[var(--rx-fg-faint)]">
                    <span>新 {deck.newCount}</span>
                    <span>学 {deck.learningCount}</span>
                    <span>复 {deck.reviewCount}</span>
                    <span>共 {deck.totalCount}</span>
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--rx-fg-dim)]">
                  {dueCount(deck)}
                </span>
              </button>
            );
          })}
          {decks.length === 0 && (
            <div className="rounded-[var(--rx-r-m)] border border-dashed border-[var(--rx-border)] py-12 text-center text-sm text-[var(--rx-fg-faint)]">
              Anki 中暂无可显示的牌组
            </div>
          )}
        </div>

        <Card className="h-fit border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] lg:sticky lg:top-4">
          <CardContent className="space-y-5 p-5">
            <div>
              <div className="text-2xs font-medium text-[var(--rx-fg-faint)]">
                当前选择
              </div>
              <div className="mt-2 min-h-6 truncate text-base font-semibold">
                {selected?.name ?? "尚未选择牌组"}
              </div>
            </div>
            {selected ? (
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["新词", selected.newCount],
                  ["学习", selected.learningCount],
                  ["复习", selected.reviewCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[var(--rx-r-m)] bg-[var(--rx-bg-soft)] p-2 text-center">
                    <div className="text-base font-semibold tabular-nums">{value}</div>
                    <div className="text-2xs text-[var(--rx-fg-faint)]">{label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-[var(--rx-fg-faint)]">
                从左侧选择今天要学习的牌组。
              </p>
            )}
            <Button
              className="w-full rx-press"
              disabled={!selected || !addonAvailable || starting || dueCount(selected) === 0}
              aria-label="开始学习"
              onClick={() => selected && onStart(selected.id, selected.name)}
            >
              {starting ? <RotateCw className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ArrowRight className="h-4 w-4" />}
              {starting ? "正在连接 Anki" : "开始学习"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
