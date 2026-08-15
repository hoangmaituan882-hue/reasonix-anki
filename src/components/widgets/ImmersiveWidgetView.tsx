import { useState, useEffect } from "react";
import {
  X,
  Maximize2,
  Sparkles,
  RotateCcw,
  Play,
  Pause,
  Flame,
  Timer,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button, cn } from "@reasonix/ui";
import { DesktopWidgetInfo, DESKTOP_WIDGETS } from "./widgetsData";
import { GlassWeatherWidget } from "./GlassWeatherWidget";
import { MeetingReminderWidget } from "./MeetingReminderWidget";
import { GlassMusicWidget } from "./GlassMusicWidget";

interface ImmersiveWidgetViewProps {
  widget: DesktopWidgetInfo | null;
  onClose: () => void;
  onPinWidget?: (widgetId: string) => void;
  isPinned?: boolean;
}

export function ImmersiveWidgetView({
  widget,
  onClose,
  onPinWidget,
  isPinned = false,
}: ImmersiveWidgetViewProps) {
  // Demo states inside immersive mode
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (widget) {
      setActiveWidgetId(widget.id);
    }
  }, [widget]);

  const currentWidget =
    DESKTOP_WIDGETS.find((w) => w.id === activeWidgetId) || widget;

  // Widget interactive states
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroActive, setPomodoroActive] = useState(false);

  // Demo Flashcards
  const demoCards = [
    {
      word: "素晴らしい (すばらしい)",
      phonetic: "subarashii",
      definition: "【形容词】极好的，出色的；赞不绝口",
      example: "素晴らしい成果を修めることができました。",
    },
    {
      word: "一生懸命 (いっしょうけんめい)",
      phonetic: "isshoukenmei",
      definition: "【副词/形容动词】拼命地，努力地",
      example: "夢を叶えるために、一生懸命勉強しています。",
    },
    {
      word: "積み重ね (つみかさね)",
      phonetic: "tsumikasane",
      definition: "【名词】积累，日积月累；积淀",
      example: "毎日の積み重ねが大きな力となる。",
    },
  ];

  useEffect(() => {
    let timer: any = null;
    if (pomodoroActive && pomodoroTime > 0) {
      timer = setInterval(() => setPomodoroTime((p) => p - 1), 1000);
    } else if (pomodoroTime === 0) {
      setPomodoroActive(false);
    }
    return () => clearInterval(timer);
  }, [pomodoroActive, pomodoroTime]);

  if (!currentWidget) return null;

  const currentCard = demoCards[cardIndex % demoCards.length];

  const handleNextWidget = () => {
    const currentIndex = DESKTOP_WIDGETS.findIndex(
      (w) => w.id === currentWidget.id
    );
    const nextIndex = (currentIndex + 1) % DESKTOP_WIDGETS.length;
    setActiveWidgetId(DESKTOP_WIDGETS[nextIndex].id);
    setCardFlipped(false);
  };

  const handlePrevWidget = () => {
    const currentIndex = DESKTOP_WIDGETS.findIndex(
      (w) => w.id === currentWidget.id
    );
    const prevIndex =
      (currentIndex - 1 + DESKTOP_WIDGETS.length) % DESKTOP_WIDGETS.length;
    setActiveWidgetId(DESKTOP_WIDGETS[prevIndex].id);
    setCardFlipped(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative flex flex-col w-full max-w-3xl h-[80vh] max-h-[640px] bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] shadow-2xl overflow-hidden text-[var(--rx-fg)]"
        >
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--rx-accent)]/10 text-[var(--rx-accent)] border border-[var(--rx-accent)]/20">
                <Maximize2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-page-title text-[var(--rx-fg)] font-bold">
                    {currentWidget.name}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    沉浸体验模式
                  </span>
                </div>
                <p className="text-caption-text text-[var(--rx-fg-dim)] mt-0.5">
                  {currentWidget.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onPinWidget && (
                <Button
                  onClick={() => onPinWidget(currentWidget.id)}
                  className={cn(
                    "h-8 px-3 text-caption-text font-semibold flex items-center gap-1.5",
                    isPinned
                      ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25"
                      : "bg-[var(--rx-accent)] text-[var(--rx-accent-fg)] hover:opacity-90"
                  )}
                >
                  {isPinned ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {isPinned ? "已添加到工作台" : "常驻桌面"}
                </Button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-[var(--rx-sidebar-hover)] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] transition-colors active:scale-95 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Main Content Stage */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[var(--rx-bg-soft)]/30 overflow-y-auto">
            {/* Widget Mode -1: Gareth.T Glass Music Widget 1:1 */}
            {currentWidget.id === "widget-glass-music-gareth" && (
              <div className="flex flex-col items-center justify-center space-y-4 py-2">
                <GlassMusicWidget className="scale-105 sm:scale-120" />
                <div className="text-caption-text text-[var(--rx-fg-dim)] text-center max-w-sm mt-2">
                  支持点击黑白封面或右上角珊瑚粉波形即时播放/暂停，拖拽滑块微调时间，悬停唤出切歌与列表面板
                </div>
              </div>
            )}

            {/* Widget Mode 0: Meeting Reminder 1:1 Widget */}
            {currentWidget.id === "widget-meeting-reminder" && (
              <div className="flex flex-col items-center justify-center space-y-4 py-2">
                <MeetingReminderWidget className="scale-100 sm:scale-110" />
              </div>
            )}

            {/* Widget Mode 1: Quick Flashcard */}
            {currentWidget.id !== "widget-meeting-reminder" && currentWidget.previewType === "card" && (
              <div className="w-full max-w-md space-y-6 text-center">
                <div className="flex items-center justify-between text-caption-text text-[var(--rx-fg-dim)] font-mono px-2">
                  <span>卡片 {cardIndex + 1} / {demoCards.length}</span>
                  <span>点击下方视窗进行正背面翻转</span>
                </div>

                <div
                  onClick={() => setCardFlipped(!cardFlipped)}
                  className="relative p-8 min-h-[220px] flex flex-col items-center justify-center bg-[var(--rx-bg-elev)] border-2 border-[var(--rx-border-soft)] hover:border-[var(--rx-accent)]/80 rounded-2xl shadow-lg transition-all duration-300 cursor-pointer select-none group"
                >
                  <span className="absolute top-3 right-3 text-[10px] font-mono text-[var(--rx-fg-dim)] bg-[var(--rx-bg-soft)] px-2 py-0.5 rounded-full">
                    {cardFlipped ? "背面 (答案)" : "正面 (单词)"}
                  </span>

                  {!cardFlipped ? (
                    <div className="space-y-3">
                      <div className="text-3xl font-extrabold text-[var(--rx-accent)] tracking-wide">
                        {currentCard.word}
                      </div>
                      <div className="text-caption-text font-mono text-[var(--rx-fg-dim)]">
                        /{currentCard.phonetic}/
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-module-title font-bold text-amber-400">
                        {currentCard.definition}
                      </div>
                      <div className="text-body-text italic text-[var(--rx-fg-dim)] border-t border-[var(--rx-border-soft)] pt-3">
                        「{currentCard.example}」
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={() => {
                      setCardIndex((i) => (i - 1 + demoCards.length) % demoCards.length);
                      setCardFlipped(false);
                    }}
                    className="h-9 px-4 text-button-text bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)]"
                  >
                    上一个
                  </Button>
                  <Button
                    onClick={() => setCardFlipped(!cardFlipped)}
                    className="h-9 px-5 text-button-text font-bold bg-[var(--rx-accent)] text-[var(--rx-accent-fg)]"
                  >
                    翻转卡片
                  </Button>
                  <Button
                    onClick={() => {
                      setCardIndex((i) => (i + 1) % demoCards.length);
                      setCardFlipped(false);
                    }}
                    className="h-9 px-4 text-button-text bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)]"
                  >
                    下一个
                  </Button>
                </div>
              </div>
            )}

            {/* Widget Mode 2: Pomodoro */}
            {currentWidget.id !== "widget-meeting-reminder" && currentWidget.previewType === "timer" && (
              <div className="w-full max-w-md space-y-6 text-center">
                <div className="inline-flex p-4 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Timer className="h-12 w-12 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <div className="text-caption-text text-[var(--rx-fg-dim)] font-mono">
                    25分钟深度学习番茄钟
                  </div>
                  <div className="text-5xl font-mono font-black text-sky-400 tracking-wider">
                    {Math.floor(pomodoroTime / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{(pomodoroTime % 60).toString().padStart(2, "0")}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={() => setPomodoroActive(!pomodoroActive)}
                    className="h-10 px-8 text-button-text font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-md"
                  >
                    {pomodoroActive ? <Pause className="h-4 w-4 mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
                    {pomodoroActive ? "暂停专注" : "开始沉浸专注"}
                  </Button>
                  <Button
                    onClick={() => {
                      setPomodoroActive(false);
                      setPomodoroTime(25 * 60);
                    }}
                    className="h-10 px-4 text-button-text bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)]"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Widget Mode 3: Streak战报 */}
            {currentWidget.previewType === "streak" && (
              <div className="w-full max-w-md space-y-6 text-center">
                <div className="inline-flex p-5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30">
                  <Flame className="h-16 w-16 fill-rose-500 animate-bounce" />
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-extrabold text-rose-500">
                    连续打卡 14 天
                  </div>
                  <p className="text-body-text text-[var(--rx-fg-dim)]">
                    您已超越全站 96.8% 的学术学习者！
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-caption-text text-[var(--rx-fg-dim)]">连胜积分</span>
                    <div className="text-module-title font-mono font-bold text-amber-400">
                      💎 1,280
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-caption-text text-[var(--rx-fg-dim)]">联赛排名</span>
                    <div className="text-module-title font-bold text-purple-400">
                      珍珠联赛 #3
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Widget Mode 4: Forecast / 1:1 Glass Weather */}
            {currentWidget.previewType === "forecast" && (
              <div className="flex flex-col items-center justify-center space-y-4 py-2">
                <GlassWeatherWidget className="scale-95 sm:scale-100" />
              </div>
            )}

            {/* Fallback for others */}
            {["heatmap", "quote", "game"].includes(currentWidget.previewType) && (
              <div className="w-full max-w-md space-y-4 text-center">
                <div className="inline-flex p-4 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Sparkles className="h-10 w-10" />
                </div>
                <h3 className="text-module-title font-bold text-[var(--rx-fg)]">
                  {currentWidget.name} 沉浸模式
                </h3>
                <p className="text-body-text text-[var(--rx-fg-dim)] leading-relaxed">
                  {currentWidget.description}。已准备就绪，您可以随时锁定到桌面或进行自定义排列。
                </p>
              </div>
            )}
          </div>

          {/* Bottom Switch Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/50">
            <Button
              onClick={handlePrevWidget}
              className="h-8 px-3 text-caption-text bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)] hover:bg-[var(--rx-sidebar-hover)]"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一个小组件
            </Button>

            <span className="text-caption-text text-[var(--rx-fg-dim)] font-mono">
              组件库沉浸视角 ({DESKTOP_WIDGETS.findIndex((w) => w.id === currentWidget.id) + 1} / {DESKTOP_WIDGETS.length})
            </span>

            <Button
              onClick={handleNextWidget}
              className="h-8 px-3 text-caption-text bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)] hover:bg-[var(--rx-sidebar-hover)]"
            >
              下一个小组件
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
