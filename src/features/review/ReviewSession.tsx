import { Eye, Flag, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button, Progress } from "@reasonix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "../../lib/anki/query";
import {
  selectCurrentCard,
  useReviewStore,
  type Ease,
} from "../../stores/review";
import { CardRenderer } from "./CardRenderer";

const EASE_BUTTONS: { ease: Ease; label: string; key: string; color: string }[] = [
  { ease: 1, label: "忘记", key: "1", color: "var(--rx-err)" },
  { ease: 2, label: "困难", key: "2", color: "var(--rx-warn)" },
  { ease: 3, label: "良好", key: "3", color: "var(--rx-ok)" },
  { ease: 4, label: "简单", key: "4", color: "var(--rx-accent)" },
];

/** 进行中的复习会话（技术方案 §5.3：键盘流 + 即时提交） */
export function ReviewSession() {
  const qc = useQueryClient();
  const phase = useReviewStore((s) => s.phase);
  const deck = useReviewStore((s) => s.deck);
  const queue = useReviewStore((s) => s.queue);
  const answered = useReviewStore((s) => s.answered);
  const buriedSession = useReviewStore((s) => s.buriedSession);
  const reveal = useReviewStore((s) => s.reveal);
  const answer = useReviewStore((s) => s.answer);
  const bury = useReviewStore((s) => s.bury);
  const exit = useReviewStore((s) => s.exit);
  const card = useReviewStore(selectCurrentCard);

  // 脚本模式（用户显式信任，等同 Anki 原生行为）——JS 驱动的重模板需要
  const [allowScripts, setAllowScripts] = useState(
    () => localStorage.getItem("ra.reviewScripts") === "1",
  );
  const toggleScripts = () => {
    setAllowScripts((v) => {
      const next = !v;
      localStorage.setItem("ra.reviewScripts", next ? "1" : "0");
      return next;
    });
  };

  // 键盘流：Space 显示答案 · 1–4 评分 · B 会话内 bury
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      const currentPhase = useReviewStore.getState().phase;
      if (currentPhase === "question" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (currentPhase === "answer") {
        if (["1", "2", "3", "4"].includes(e.key)) {
          e.preventDefault();
          void answer(Number(e.key) as Ease);
        } else if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          bury();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reveal, answer, bury]);

  // 脚本模式：卡片 iframe 转发的按键（焦点在卡片内时）
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const key = (e.data as { __reasonixKey?: string } | null)?.__reasonixKey;
      if (!key) return;
      const currentPhase = useReviewStore.getState().phase;
      if (currentPhase === "question" && (key === " " || key === "Enter")) {
        reveal();
      } else if (currentPhase === "answer") {
        if (["1", "2", "3", "4"].includes(key)) void answer(Number(key) as Ease);
        else if (key.toLowerCase() === "b") bury();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [reveal, answer, bury]);

  // 会话结束后刷新查询层（牌组 stats 等）
  useEffect(() => {
    if (phase === "done") {
      qc.invalidateQueries({ queryKey: queryKeys.decks });
      qc.invalidateQueries({ queryKey: queryKeys.cardsPrefix });
    }
  }, [phase, qc]);

  if (!card) return null;

  const done = answered.length + buriedSession.length;
  const progress = queue.length > 0 ? (done / queue.length) * 100 : 0;
  const fieldValues = Object.values(card.fields)
    .sort((a, b) => a.order - b.order)
    .map((f) => f.value);

  return (
    <div className="flex h-full flex-col">
      {/* 会话头 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--rx-border-soft)] px-4 py-2.5">
        <span className="min-w-0 truncate text-sm font-medium">{deck}</span>
        <Progress value={progress} className="max-w-64 flex-1" />
        <span className="mono shrink-0 text-xs text-[var(--rx-fg-faint)]">
          {done}/{queue.length}
        </span>
        <Button
          variant={allowScripts ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs rx-press"
          onClick={toggleScripts}
          title="脚本模式：允许执行卡片模板脚本（JS 驱动的背词卡需要）"
        >
          {allowScripts ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" />
          )}
          脚本{allowScripts ? "开" : "关"}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rx-press" onClick={exit}>
          <LogOut className="h-3.5 w-3.5" />
          退出
        </Button>
      </div>

      {/* 卡片区域（iframe 沙箱渲染） */}
      <div className="min-h-0 flex-1 p-4">
        <div className="h-full overflow-hidden rounded-[var(--rx-r-l)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg)] rx-anim-cardbody">
          <CardRenderer
            key={`${card.cardId}:${phase}`}
            html={phase === "answer" ? card.answer : card.question}
            css={card.css}
            fieldValues={fieldValues}
            allowScripts={allowScripts}
            title={phase === "answer" ? "答案" : "问题"}
          />
        </div>
      </div>

      {/* 操作区 */}
      <div className="shrink-0 border-t border-[var(--rx-border-soft)] px-4 py-3">
        {phase === "question" ? (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="lg"
              className="min-w-52 rx-press"
              onClick={reveal}
              autoFocus
            >
              <Eye className="h-4 w-4" />
              显示答案
              <kbd className="ml-2 rounded bg-black/15 px-1.5 text-2xs">Space</kbd>
            </Button>
            <Button variant="outline" className="rx-press" onClick={bury}>
              <Flag className="h-4 w-4" />
              今天不看
              <kbd className="ml-2 rounded bg-black/10 px-1.5 text-2xs">B</kbd>
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            {EASE_BUTTONS.map(({ ease, label, key, color }) => (
              <Button
                key={ease}
                variant="outline"
                size="lg"
                className="min-w-24 rx-press"
                style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
                onClick={() => void answer(ease)}
              >
                {label}
                <kbd className="ml-1.5 rounded bg-black/10 px-1.5 text-2xs">{key}</kbd>
              </Button>
            ))}
            <Button variant="ghost" className="rx-press" onClick={bury}>
              <Flag className="h-4 w-4" />
              今天不看
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
