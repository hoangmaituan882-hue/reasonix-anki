import { GraduationCap, Play, RotateCcw } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@reasonix/ui";
import { useMemo } from "react";
import { useDeckTree } from "../lib/anki/query";
import type { DeckStats } from "../lib/anki/schemas";
import { useReviewStore } from "../stores/review";
import { ReviewSession } from "./review/ReviewSession";

/**
 * M3 复习视图入口：
 * idle → 选牌组开场；question/answer → 复习会话；done → 完成页
 */
export function ReviewView() {
  const phase = useReviewStore((s) => s.phase);

  if (phase === "question" || phase === "answer") return <ReviewSession />;
  if (phase === "done") return <CompletionScreen />;
  return <SetupScreen />;
}

/* ---------------- 开场：选牌组 ---------------- */

function SetupScreen() {
  const decksQ = useDeckTree();
  const start = useReviewStore((s) => s.start);
  const starting = useReviewStore((s) => s.starting);
  const error = useReviewStore((s) => s.error);

  const rows = useMemo(() => {
    const decks = decksQ.data?.decks ?? {};
    const stats = decksQ.data?.stats ?? {};
    return Object.entries(decks)
      .map(([name, id]) => ({ name, st: stats[String(id)] }))
      .filter((r): r is { name: string; st: DeckStats } => r.st != null)
      .sort(
        (a, b) =>
          b.st.new_count + b.st.learn_count + b.st.review_count -
          (a.st.new_count + a.st.learn_count + a.st.review_count),
      );
  }, [decksQ.data]);

  if (decksQ.isPending) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6 rx-anim-modal">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <GraduationCap
            className="h-4.5 w-4.5"
            style={{ color: "var(--rx-accent)" }}
          />
          选择要复习的牌组
        </h2>
        <p className="mt-1 text-xs text-[var(--rx-fg-faint)]">
          队列为牌组内全部到期卡片（乱序，单次上限 300 张）· Space 显示答案 ·
          评分键 1–4 · B 今天不看（不改 Anki 调度）
        </p>
      </div>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        {rows.map(({ name, st }) => {
          const due = st.new_count + st.learn_count + st.review_count;
          return (
            <div
              key={name}
              className="flex items-center gap-3 rounded-[var(--rx-r-m)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] px-3 py-2.5 transition-colors hover:border-[var(--rx-border)]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-[var(--rx-fg-faint)]">
                  <span>共 {st.total_in_deck} 张</span>
                  {st.new_count > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-4 border-transparent px-1 text-2xs font-normal rx-accent-soft"
                      style={{ color: "var(--rx-accent)" }}
                    >
                      新 {st.new_count}
                    </Badge>
                  )}
                  {st.learn_count > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-2xs font-normal">
                      学 {st.learn_count}
                    </Badge>
                  )}
                  {st.review_count > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-2xs font-normal">
                      复 {st.review_count}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                className="rx-press"
                disabled={due === 0 || starting}
                onClick={() => void start(name)}
              >
                <Play className="h-3.5 w-3.5" />
                {due > 0 ? `开始（${due}）` : "无到期"}
              </Button>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--rx-fg-faint)]">
            没有可显示的牌组
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- 完成页 ---------------- */

function CompletionScreen() {
  const deck = useReviewStore((s) => s.deck);
  const answered = useReviewStore((s) => s.answered);
  const buriedSession = useReviewStore((s) => s.buriedSession);
  const exit = useReviewStore((s) => s.exit);
  const start = useReviewStore((s) => s.start);

  const byEase = [1, 2, 3, 4].map((ease) => ({
    ease,
    count: answered.filter((a) => a.ease === ease).length,
  }));
  const labels: Record<number, string> = { 1: "忘记", 2: "困难", 3: "良好", 4: "简单" };
  const colors: Record<number, string> = {
    1: "var(--rx-err)",
    2: "var(--rx-warn)",
    3: "var(--rx-ok)",
    4: "var(--rx-accent)",
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md rx-anim-modal">
        <CardHeader>
          <CardTitle>本次复习完成</CardTitle>
          <CardDescription>
            {deck} · 作答 {answered.length} 张
            {buriedSession.length > 0 ? ` · 今天不看 ${buriedSession.length} 张` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {byEase.map(({ ease, count }) => (
              <div
                key={ease}
                className="rounded-[var(--rx-r-m)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] p-2 text-center"
              >
                <div className="text-lg font-semibold" style={{ color: colors[ease] }}>
                  {count}
                </div>
                <div className="text-2xs text-[var(--rx-fg-faint)]">{labels[ease]}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rx-press" onClick={exit}>
              返回选择
            </Button>
            {deck && (
              <Button className="flex-1 rx-press" onClick={() => void start(deck)}>
                <RotateCcw className="h-4 w-4" />
                再来一轮
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
