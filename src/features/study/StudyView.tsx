import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Headphones,
  LogOut,
  Timer,
} from "lucide-react";
import {
  AnimatedCheckCircle2,
  AnimatedEye,
  AnimatedRotateCw,
  AnimatedUndo2,
  AnimatedVolume2,
} from "../../components/icons/animated";
import { Alert, AlertDescription, Badge, Button } from "@reasonix/ui";
import type { JapaneseWordRecord } from "../vocabulary/lapisAdapter";
import { MappingWizard } from "../vocabulary/MappingWizard";
import type { SessionRevealResponse } from "../../lib/reasonix-addon/schemas";
import { resolveMediaUrl } from "../../lib/media";
import {
  useStudySessionStore,
  type NativeEase,
  type StudyReport,
  type StudyPhase,
} from "../../stores/studySession";

const RATINGS: readonly {
  ease: NativeEase;
  label: string;
  key: string;
  color: string;
}[] = [
  { ease: 1, label: "忘记", key: "1", color: "var(--rx-err)" },
  { ease: 2, label: "困难", key: "2", color: "var(--rx-warn)" },
  { ease: 3, label: "良好", key: "3", color: "var(--rx-ok)" },
  { ease: 4, label: "简单", key: "4", color: "var(--rx-accent)" },
];

function FieldHtml({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function FrontPrompt({ word }: { word: JapaneseWordRecord }) {
  const [clickRevealed, setClickRevealed] = useState(false);
  if (word.cardKind === "audio") {
    return (
      <div className="flex flex-col items-center gap-4 text-[var(--rx-fg-dim)]">
        <span className="flex h-20 w-20 items-center justify-center rounded-full rx-accent-soft">
          <Headphones className="h-9 w-9 text-[var(--rx-accent)]" />
        </span>
        <span className="text-sm">听音辨义</span>
      </div>
    );
  }
  if (word.cardKind === "sentence") {
    return (
      <FieldHtml
        html={word.sentenceFuriganaHtml || word.sentenceHtml}
        className="max-w-3xl text-center text-2xl leading-loose"
      />
    );
  }
  if (word.cardKind === "click") {
    return (
      <button
        type="button"
        className="rx-press rounded-[var(--rx-r-l)] px-8 py-6 text-center"
        onClick={() => setClickRevealed(true)}
      >
        <FieldHtml html={word.expressionHtml} className="text-5xl font-semibold" />
        {clickRevealed && word.hintHtml && (
          <FieldHtml html={word.hintHtml} className="mt-4 text-base text-[var(--rx-fg-dim)]" />
        )}
      </button>
    );
  }
  return (
    <div className="space-y-5 text-center">
      <FieldHtml html={word.expressionHtml} className="text-5xl font-semibold" />
      {word.cardKind === "word_sentence" && word.hintHtml && (
        <FieldHtml html={word.hintHtml} className="text-base text-[var(--rx-fg-faint)]" />
      )}
    </div>
  );
}

function ReplayButton({ onReplay }: { onReplay: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(0);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="重播音频"
      title="重播音频"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        setClicked((c) => c + 1);
        onReplay();
      }}
    >
      <AnimatedVolume2 size={16} isHovered={hovered} trigger={clicked} />
    </Button>
  );
}

function UndoButton({ disabled, onUndo }: { disabled: boolean; onUndo: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(0);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="撤销上一张"
      title="撤销上一张"
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        setClicked((c) => c + 1);
        onUndo();
      }}
    >
      <AnimatedUndo2 size={16} isHovered={hovered} trigger={clicked} />
    </Button>
  );
}

function RevealButton({
  busy,
  revealing,
  onReveal,
}: {
  busy: boolean;
  revealing: boolean;
  onReveal: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(0);
  return (
    <Button
      className="min-w-48 rx-press"
      onClick={() => {
        setClicked((c) => c + 1);
        onReveal();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={busy}
      aria-label="显示答案"
    >
      {revealing ? (
        <AnimatedRotateCw size={16} trigger className="animate-spin motion-reduce:animate-none" />
      ) : (
        <AnimatedEye size={16} isHovered={hovered} trigger={clicked} />
      )}
      显示答案
    </Button>
  );
}

export function StudyCardStage({
  word,
  phase,
  intervals,
  remaining,
  canUndo,
  onReveal,
  onAnswer,
  onUndo,
  onReplay,
  onFinish,
}: {
  word: JapaneseWordRecord;
  phase: StudyPhase;
  intervals: SessionRevealResponse["result"]["intervals"] | null;
  remaining: { new: number; learning: number; review: number };
  canUndo: boolean;
  onReveal(): void;
  onAnswer(ease: NativeEase): void;
  onUndo(): void;
  onReplay(): void;
  onFinish(): void;
}) {
  const backVisible = phase === "back" || phase === "answering";
  const busy = ["revealing", "answering", "undoing"].includes(phase);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--rx-bg)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--rx-border-soft)] px-5">
        <div className="flex items-center gap-2 text-xs text-[var(--rx-fg-faint)]">
          <Badge variant="outline">新 {remaining.new}</Badge>
          <Badge variant="outline">学 {remaining.learning}</Badge>
          <Badge variant="outline">复 {remaining.review}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <ReplayButton onReplay={onReplay} />
          <UndoButton disabled={!canUndo || busy} onUndo={onUndo} />
          <Button variant="ghost" size="sm" onClick={onFinish} disabled={busy}>
            <LogOut className="h-4 w-4" />
            结束
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center">
          {!backVisible ? (
            <div className="rx-anim-cardbody flex min-h-[22rem] items-center justify-center">
              <FrontPrompt key={word.cardId} word={word} />
            </div>
          ) : (
            <article className="rx-anim-cardbody mx-auto w-full max-w-3xl space-y-7">
              <section className="space-y-2 text-center">
                <FieldHtml html={word.expressionHtml} className="text-4xl font-semibold" />
                <FieldHtml
                  html={word.expressionFuriganaHtml}
                  className="text-xl text-[var(--rx-fg-dim)]"
                />
                {!word.expressionFuriganaHtml && (
                  <FieldHtml
                    html={word.expressionReadingHtml}
                    className="text-xl text-[var(--rx-fg-dim)]"
                  />
                )}
                {(word.pitchCategories || word.pitchPosition) && (
                  <div className="text-xs text-[var(--rx-fg-faint)]">
                    {[word.pitchCategories, word.pitchPosition].filter(Boolean).join(" · ")}
                  </div>
                )}
              </section>

              <section className="rounded-[var(--rx-r-l)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] p-5">
                <div className="mb-3 flex items-center gap-2 text-2xs font-medium text-[var(--rx-accent)]">
                  <BookOpen className="h-3.5 w-3.5" />
                  核心释义
                </div>
                <FieldHtml
                  html={word.mainDefinitionHtml || word.glossaryHtml}
                  className="leading-7 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                />
              </section>

              {(word.sentenceFuriganaHtml || word.sentenceHtml || word.pictureHtml) && (
                <section className="space-y-4 rounded-[var(--rx-r-l)] bg-[var(--rx-bg-soft)] p-5">
                  <FieldHtml
                    html={word.sentenceFuriganaHtml || word.sentenceHtml}
                    className="text-base leading-8"
                  />
                  <FieldHtml html={word.pictureHtml} className="[&_img]:max-h-56 [&_img]:rounded-[var(--rx-r-m)]" />
                </section>
              )}

              {word.glossaryHtml && word.glossaryHtml !== word.mainDefinitionHtml && (
                <details className="group rounded-[var(--rx-r-m)] border border-[var(--rx-border-soft)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-[var(--rx-fg-dim)]">
                    完整词典
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <FieldHtml html={word.glossaryHtml} className="border-t border-[var(--rx-border-soft)] px-4 py-4 leading-7" />
                </details>
              )}
            </article>
          )}
        </div>
      </main>

      <footer className="shrink-0 space-y-3 border-t border-[var(--rx-border-soft)] px-4 py-4">
        {!backVisible && (
          <div className="flex justify-center">
            <RevealButton
              busy={busy}
              revealing={phase === "revealing"}
              onReveal={onReveal}
            />
          </div>
        )}
        <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2">
          {RATINGS.map(({ ease, label, key, color }) => {
            const interval = intervals?.[String(ease) as "1" | "2" | "3" | "4"]?.label ?? "—";
            return (
              <Button
                key={ease}
                variant="outline"
                className="h-auto min-h-14 flex-col gap-0.5 rx-press"
                style={{ color }}
                aria-label={`${label} ${interval}`}
                disabled={!backVisible || busy || !intervals}
                onClick={() => onAnswer(ease)}
              >
                <span className="text-sm">{label}</span>
                <span className="text-2xs font-normal opacity-75">{interval}</span>
                <kbd className="sr-only">{key}</kbd>
              </Button>
            );
          })}
        </div>
      </footer>
    </div>
  );
}

function soundFilename(value: string): string | null {
  return value.match(/\[sound:([^\]]+)]/i)?.[1] ?? null;
}

function formatDuration(milliseconds: number | undefined): string {
  if (milliseconds === undefined) return "--";
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

export function StudyReportSummary({
  report,
  answeredCards,
  syncState,
  onReset,
}: {
  report: StudyReport | null;
  answeredCards: number;
  syncState: "idle" | "syncing" | "error";
  onReset(): void;
}) {
  const ratings = report?.ratings ?? { "1": 0, "2": 0, "3": 0, "4": 0 };
  const syncCopy = {
    idle: "本轮结果已写入 Anki",
    syncing: "正在与 Anki 自动同步",
    error: "学习结果已保存，自动同步暂未完成",
  }[syncState];

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-[var(--rx-r-l)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] rx-anim-modal">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--rx-border-soft)] px-6 py-5">
        <div>
          <div className="text-xl font-semibold">本轮学习完成</div>
          <p className="mt-1 text-sm text-[var(--rx-fg-dim)]">Anki 调度结果已成为本轮报告的唯一依据</p>
        </div>
        <AnimatedCheckCircle2 size={24} trigger className="shrink-0 text-[var(--rx-ok)]" />
      </header>
      <div className="grid grid-cols-2 border-b border-[var(--rx-border-soft)] sm:grid-cols-4">
        {[
          ["完成", String(report?.answeredCards ?? answeredCards)],
          ["总耗时", formatDuration(report?.durationMs)],
          ["平均", formatDuration(report?.averageMs)],
          ["明日到期", report?.tomorrowDue == null ? "--" : String(report.tomorrowDue)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 px-4 py-4 text-center">
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-2xs text-[var(--rx-fg-faint)]">{label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-5 px-6 py-5">
        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--rx-fg-dim)]">
            <Timer className="h-4 w-4" />
            四档分布
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["忘记", "困难", "良好", "简单"].map((label, index) => (
              <div key={label} className="rounded-[var(--rx-r-m)] bg-[var(--rx-bg-soft)] px-2 py-3 text-center">
                <div className="font-semibold tabular-nums">{ratings[String(index + 1) as "1" | "2" | "3" | "4"]}</div>
                <div className="mt-1 text-2xs text-[var(--rx-fg-faint)]">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-[var(--rx-fg-faint)]">
            忘记率 {report?.forgottenRate === undefined ? "--" : `${Math.round(report.forgottenRate * 100)}%`}
          </div>
        </section>
        {(report?.weakCardIds?.length ?? 0) > 0 && (
          <section className="border-t border-[var(--rx-border-soft)] pt-4">
            <div className="text-xs font-medium text-[var(--rx-fg-dim)]">薄弱卡片</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {report?.weakCardIds?.map((cardId) => (
                <Badge key={cardId} variant="outline">#{cardId}</Badge>
              ))}
            </div>
          </section>
        )}
        <div className="flex items-center justify-between gap-4 border-t border-[var(--rx-border-soft)] pt-4">
          <span className="text-xs text-[var(--rx-fg-faint)]">{syncCopy}</span>
          <Button onClick={onReset}>返回今日学习</Button>
        </div>
      </div>
    </div>
  );
}

export function StudyView() {
  const phase = useStudySessionStore((state) => state.phase);
  const word = useStudySessionStore((state) => state.word);
  const card = useStudySessionStore((state) => state.card);
  const remaining = useStudySessionStore((state) => state.remaining);
  const intervals = useStudySessionStore((state) => state.intervals);
  const canUndo = useStudySessionStore((state) => state.canUndo);
  const answeredCards = useStudySessionStore((state) => state.answeredCards);
  const report = useStudySessionStore((state) => state.report);
  const syncState = useStudySessionStore((state) => state.syncState);
  const sessionId = useStudySessionStore((state) => state.sessionId);
  const error = useStudySessionStore((state) => state.error);
  const reveal = useStudySessionStore((state) => state.reveal);
  const answer = useStudySessionStore((state) => state.answer);
  const undo = useStudySessionStore((state) => state.undo);
  const finish = useStudySessionStore((state) => state.finish);
  const resume = useStudySessionStore((state) => state.resume);
  const applyMapping = useStudySessionStore((state) => state.applyMapping);
  const reset = useStudySessionStore((state) => state.reset);

  const replay = useCallback(async () => {
    if (!word) return;
    const marker =
      word.cardKind === "sentence" || word.cardKind === "audio"
        ? word.sentenceAudio || word.expressionAudio
        : word.expressionAudio || word.sentenceAudio;
    const filename = soundFilename(marker);
    if (!filename) return;
    const url = await resolveMediaUrl(filename);
    if (url) await new Audio(url).play().catch(() => undefined);
  }, [word]);

  useEffect(() => {
    if (phase === "front") void replay();
  }, [phase, word?.cardId, replay]);

  // 媒体预取：新卡到达时预热其媒体文件（media.ts LRU 缓存），
  // 渲染/翻面时 resolveMediaUrl 立即命中，消除等待。失败静默不阻塞。
  useEffect(() => {
    if (!card?.media?.length) return;
    let disposed = false;
    void Promise.all(
      card.media.map((filename) =>
        resolveMediaUrl(filename).catch(() => null),
      ),
    ).then(() => {
      if (disposed) return;
      // 预热完成（结果由 media LRU 持有，此处无需额外处理）
    });
    return () => {
      disposed = true;
    };
  }, [card?.cardId, card?.media]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const current = useStudySessionStore.getState();
      if (current.phase === "front" && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        void current.reveal();
      } else if (current.phase === "back" && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        void current.answer(Number(event.key) as NativeEase);
      } else if (event.ctrlKey && event.key.toLocaleLowerCase() === "z") {
        event.preventDefault();
        void current.undo();
      } else if (event.key.toLocaleLowerCase() === "r") {
        event.preventDefault();
        void replay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [replay]);

  if (phase === "done") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <StudyReportSummary
          report={report}
          answeredCards={answeredCards}
          syncState={syncState}
          onReset={reset}
        />
      </div>
    );
  }

  if (phase === "mapping" && card) {
    return (
      <MappingWizard
        card={card}
        error={error}
        onConfirm={(mapping) => void applyMapping(mapping)}
      />
    );
  }

  if (!word || !remaining) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="space-y-4 text-center text-sm text-[var(--rx-fg-dim)]">
          <p>{error ?? "正在准备原生学习会话…"}</p>
          {phase === "error" && sessionId && (
            <Button onClick={() => void resume()}>
              <AnimatedRotateCw size={16} trigger />
              重新连接并恢复
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {error && (
        <Alert className="absolute left-1/2 top-16 z-10 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 shadow-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <StudyCardStage
        word={word}
        phase={phase}
        intervals={intervals}
        remaining={remaining}
        canUndo={canUndo}
        onReveal={() => void reveal()}
        onAnswer={(ease) => void answer(ease)}
        onUndo={() => void undo()}
        onReplay={() => void replay()}
        onFinish={() => void finish()}
      />
    </div>
  );
}
