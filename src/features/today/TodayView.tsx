import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Skeleton,
} from "@reasonix/ui";
import { useDeckTree } from "../../lib/anki/query";
import {
  reasonixRequestPermission,
  reasonixStatus,
  reasonixSyncStart,
} from "../../lib/reasonix-addon/client";
import { hasCapability } from "../../lib/reasonix-addon/capabilities";
import { withRetry } from "../../lib/reasonix-addon/retry";
import { useStudySessionStore } from "../../stores/studySession";
import { TodayDashboard } from "./TodayDashboard";
import { dueCount, type TodayDeckRow } from "./todayUtil";

// re-export，保持 TodayView 对外 API 兼容（测试从 ./TodayView 导入）
export { TodayDashboard } from "./TodayDashboard";
export { summarizeTodayDecks, type TodayDeckRow } from "./todayUtil";

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
      !hasCapability(status, "sync.start", "0.1.0") ||
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
      hasCapability(status, "session.start", "0.1.0"),
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
