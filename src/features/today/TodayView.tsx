import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
  cn,
} from "@reasonix/ui";
import { useDeckTree } from "../../lib/anki/query";
import {
  reasonixRequestPermission,
  reasonixStatus,
  reasonixSyncStart,
} from "../../lib/reasonix-addon/client";
import { withRetry } from "../../lib/reasonix-addon/retry";
import { useStudySessionStore } from "../../stores/studySession";

export interface TodayDeckRow {
  id: number;
  name: string;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  totalCount: number;
}

interface TodayDashboardProps {
  decks: TodayDeckRow[];
  selectedDeckId: number | null;
  addonAvailable: boolean;
  syncState: "idle" | "syncing" | "error" | "unavailable";
  starting: boolean;
  error?: string | null;
  onSelect(deckId: number): void;
  onStart(deckId: number, deckName: string): void;
}

function dueCount(deck: TodayDeckRow): number {
  return deck.newCount + deck.learningCount + deck.reviewCount;
}

export function summarizeTodayDecks(decks: readonly TodayDeckRow[]): {
  newCount: number;
  learningCount: number;
  reviewCount: number;
} {
  return decks
    .filter((deck) => !deck.name.includes("::"))
    .reduce(
      (sum, deck) => ({
        newCount: sum.newCount + deck.newCount,
        learningCount: sum.learningCount + deck.learningCount,
        reviewCount: sum.reviewCount + deck.reviewCount,
      }),
      { newCount: 0, learningCount: 0, reviewCount: 0 },
    );
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
            Reasonix 配套插件未就绪。请保持 Anki 打开并确认插件已安装；精确学习入口不会降级到本地随机队列。
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

export function TodayView() {
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const autoSyncProfile = useRef<{
    profileKey: string;
    attempts: number;
    inFlight: boolean;
    completed: boolean;
  } | null>(null);
  const phase = useStudySessionStore((state) => state.phase);
  const error = useStudySessionStore((state) => state.error);
  const start = useStudySessionStore((state) => state.start);
  const statusQuery = useQuery({
    queryKey: ["reasonix-addon", "status"],
    queryFn: () => reasonixStatus(crypto.randomUUID()),
    retry: false,
    refetchInterval: 3_000,
  });
  const decksQuery = useDeckTree(statusQuery.data?.profileKey ?? null);
  const status = statusQuery.data;
  const capabilitiesKey = status?.capabilities.join("|") ?? "";
  const healthSyncState = status?.health?.sync.state;

  useEffect(() => {
    const current = autoSyncProfile.current;
    if (
      !status ||
      phase !== "idle" ||
      status.profileName === "Reasonix QA" ||
      status.collectionState !== "open" ||
      !["idle", "error"].includes(status.syncState) ||
      !status.profileKey ||
      !status.capabilities.includes("sync.start") ||
      (current?.profileKey === status.profileKey &&
        (current.inFlight || current.completed || current.attempts >= 4))
    ) {
      return;
    }

    if (
      current?.profileKey === status.profileKey &&
      current.attempts > 0 &&
      status.syncState === "idle" &&
      (healthSyncState === "finished" || healthSyncState === undefined)
    ) {
      current.completed = true;
      return;
    }

    const state =
      current?.profileKey === status.profileKey
        ? current
        : {
            profileKey: status.profileKey,
            attempts: 0,
            inFlight: false,
            completed: false,
          };
    state.attempts += 1;
    state.inFlight = true;
    autoSyncProfile.current = state;
    const syncRequestId = crypto.randomUUID();
    let cancelled = false;
    void (async () => {
      try {
        const result = await withRetry(
          async () => {
            const permission = await reasonixRequestPermission(
              crypto.randomUUID(),
            );
            if (permission.permission !== "granted") return "denied" as const;
            await reasonixSyncStart({
              requestId: syncRequestId,
              token: permission.token,
            });
            return "started" as const;
          },
          { maxAttempts: 4 },
        );
        if (cancelled) return;
        if (result === "denied") state.completed = true;
      } catch {
        state.completed = true;
        // Immediate failures have exhausted the bounded helper budget; a
        // delayed hook timeout is handled by the status-error branch above.
      } finally {
        state.inFlight = false;
        if (!cancelled) {
          await statusQuery.refetch();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    phase,
    status?.profileKey,
    status?.profileName,
    status?.collectionState,
    status?.syncState,
    healthSyncState,
    capabilitiesKey,
    statusQuery.refetch,
  ]);

  const decks = useMemo<TodayDeckRow[]>(() => {
    const deckMap = decksQuery.data?.decks ?? {};
    const stats = decksQuery.data?.stats ?? {};
    return Object.entries(deckMap)
      .map(([name, id]) => {
        const deckStats = stats[String(id)];
        if (!deckStats) return null;
        return {
          id,
          name,
          newCount: deckStats.new_count,
          learningCount: deckStats.learn_count,
          reviewCount: deckStats.review_count,
          totalCount: deckStats.total_in_deck,
        };
      })
      .filter((deck): deck is TodayDeckRow => deck !== null)
      .sort((left, right) => dueCount(right) - dueCount(left));
  }, [decksQuery.data]);

  if (decksQuery.isPending && !statusQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-7">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const addonAvailable = Boolean(
    status &&
      status.collectionState === "open" &&
      status.syncState === "idle" &&
      status.capabilities.includes("session.start"),
  );
  const syncState = statusQuery.isError
    ? "unavailable"
    : (status?.syncState ?? "unavailable");

  return (
    <TodayDashboard
      decks={decks}
      selectedDeckId={selectedDeckId}
      addonAvailable={addonAvailable}
      syncState={syncState}
      starting={phase === "starting"}
      error={error}
      onSelect={setSelectedDeckId}
      onStart={(deckId, deckName) => void start(deckId, deckName)}
    />
  );
}
