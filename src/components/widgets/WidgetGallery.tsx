import { useState, useEffect } from "react";
import {
  X,
  Search,
  Sparkles,
  LayoutGrid,
  Brain,
  Check,
  Plus,
  Maximize2,
  Eye,
  Flame,
  Gamepad2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button, cn } from "@reasonix/ui";
import { Widget } from "./types";
import { REGISTERED_WIDGETS } from "./widgetRegistry";
import { WIDGET_CATEGORIES } from "./widgetsData";
import { ImmersiveWidgetView } from "./ImmersiveWidgetView";
import { GlassWeatherWidget } from "./GlassWeatherWidget";
import { MeetingReminderWidget } from "./MeetingReminderWidget";
import { GlassMusicWidget } from "./GlassMusicWidget";

export interface WidgetGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWidget?: (widget: Widget) => void;
  onPinWidget?: (widgetId: string) => void;
  pinnedWidgetIds?: string[];
}

export function WidgetGallery({
  isOpen,
  onClose,
  onSelectWidget,
  onPinWidget,
  pinnedWidgetIds: externalPinnedIds,
}: WidgetGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeImmersiveWidget, setActiveImmersiveWidget] = useState<Widget | null>(null);
  
  const [localPinnedIds, setLocalPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("ra.pinnedWidgets");
      return saved ? JSON.parse(saved) : ["widget-card-quick", "widget-streak"];
    } catch {
      return ["widget-card-quick", "widget-streak"];
    }
  });

  const pinnedWidgetIds = externalPinnedIds ?? localPinnedIds;

  // Mini preview interactive states
  const [cardFlipped, setCardFlipped] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft]);

  const togglePin = (id: string) => {
    const isPinned = pinnedWidgetIds.includes(id);
    const updated = isPinned ? pinnedWidgetIds.filter((item) => item !== id) : [...pinnedWidgetIds, id];
    setLocalPinnedIds(updated);
    try {
      localStorage.setItem("ra.pinnedWidgets", JSON.stringify(updated));
    } catch {}
    if (onPinWidget) {
      onPinWidget(id);
    }
  };

  const handleCardClick = (widget: Widget) => {
    // Trigger immersive display logic as requested
    setActiveImmersiveWidget(widget);
    if (onSelectWidget) {
      onSelectWidget(widget);
    }
  };

  const filteredWidgets = REGISTERED_WIDGETS.filter((w) => {
    const matchesCategory =
      selectedCategory === "all" || w.category === selectedCategory;
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative flex flex-col w-full max-w-5xl h-[88vh] max-h-[760px] bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] shadow-2xl overflow-hidden text-[var(--rx-fg)]"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xs">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-page-title text-[var(--rx-fg)] font-bold leading-tight">
                    桌面小组件画廊
                  </h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                    {REGISTERED_WIDGETS.length} 个已注册组件
                  </span>
                </div>
                <p className="text-caption-text text-[var(--rx-fg-dim)] mt-0.5">
                  点击任意卡片即可开启沉浸交互展示，自由锁定与组装您的桌面背词工作台
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[var(--rx-sidebar-hover)] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] transition-colors active:scale-95 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3 border-b border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)]">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {WIDGET_CATEGORIES.map((cat, cIdx) => {
                const count =
                  cat.id === "all"
                    ? REGISTERED_WIDGETS.length
                    : REGISTERED_WIDGETS.filter((w) => w.category === cat.id).length;

                return (
                  <button
                    key={`widget_cat_${cat.id}_${cIdx}`}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-caption-text font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer",
                      selectedCategory === cat.id
                        ? "bg-[var(--rx-accent)] text-[var(--rx-accent-fg)] shadow-xs"
                        : "bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] hover:bg-[var(--rx-sidebar-hover)]"
                    )}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                        selectedCategory === cat.id
                          ? "bg-black/20 text-white"
                          : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)]"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--rx-fg-dim)]" />
              <input
                type="text"
                placeholder="搜索组件名称或关键词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-caption-text bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] rounded-xl text-[var(--rx-fg)] focus:outline-none focus:border-[var(--rx-accent)] transition-colors"
              />
            </div>
          </div>

          {/* Grid Layout of Widget Cards */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWidgets.map((widget, wIdx) => {
              const isPinned = pinnedWidgetIds.includes(widget.id);

              return (
                <motion.div
                  key={`widget_gallery_card_${widget.id}_${wIdx}`}
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  onClick={() => handleCardClick(widget)}
                  className="flex flex-col justify-between p-4 bg-[var(--rx-bg-soft)]/60 border border-[var(--rx-border-soft)] hover:border-[var(--rx-accent)]/70 rounded-2xl transition-all shadow-xs hover:shadow-md cursor-pointer group relative overflow-hidden"
                >
                  {/* Top info */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] group-hover:border-[var(--rx-accent)]/40 transition-colors">
                          {typeof widget.icon === "function" ? (
                            <widget.icon className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Brain className="h-4 w-4 text-amber-500" />
                          )}
                        </div>

                        <span className="text-sub-title text-[var(--rx-fg)] font-bold line-clamp-1">
                          {widget.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {widget.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            {widget.badge}
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[var(--rx-fg-dim)]">
                          {widget.size}
                        </span>
                      </div>
                    </div>

                    <p className="text-caption-text text-[var(--rx-fg-dim)] line-clamp-2 leading-relaxed">
                      {widget.description}
                    </p>

                    {/* LIVE MINI PREVIEW CONTAINER */}
                    <div className="p-3 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-xl min-h-[110px] flex flex-col justify-center overflow-hidden relative group/preview">
                      {/* Hover Overlay Hint */}
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20 pointer-events-none">
                        <span className="text-xs font-bold text-white px-3 py-1.5 rounded-full bg-amber-500 flex items-center gap-1.5 shadow-lg">
                          <Maximize2 className="h-3.5 w-3.5" />
                          点击进入沉浸展示
                        </span>
                      </div>

                      {/* Preview: Glass Music Widget (1:1 Replica) */}
                      {widget.id === "widget-glass-music-gareth" && (
                        <div className="flex justify-center my-0.5 scale-[0.78] origin-center">
                          <GlassMusicWidget enableDrag={false} enableResize={false} className="max-w-[370px]" />
                        </div>
                      )}

                      {/* Preview: Meeting Reminder Widget */}
                      {widget.id === "widget-meeting-reminder" && (
                        <div className="flex justify-center my-0.5 scale-75 origin-center">
                          <MeetingReminderWidget enableDrag={false} enableResize={false} className="max-w-[200px]" />
                        </div>
                      )}

                      {/* Preview: Glass Weather Widget */}
                      {widget.id === "widget-glass-weather-3d" && (
                        <div className="flex justify-center my-0.5 scale-70 origin-center">
                          <GlassWeatherWidget enableDrag={false} enableResize={false} className="max-w-[240px]" />
                        </div>
                      )}

                      {/* Preview: Quick Card */}
                      {widget.id !== "widget-meeting-reminder" &&
                        widget.id !== "widget-glass-weather-3d" &&
                        widget.previewType === "card" && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardFlipped(!cardFlipped);
                            }}
                            className="select-none space-y-1 text-center py-1 cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-[10px] text-[var(--rx-fg-dim)] font-mono">
                              <span>N3 单词卡</span>
                              <span>{cardFlipped ? "背面释义" : "正面单词"}</span>
                            </div>
                            {!cardFlipped ? (
                              <div className="space-y-0.5">
                                <div className="text-sub-title font-bold text-[var(--rx-accent)]">
                                  素晴らしい
                                </div>
                                <div className="text-caption-text text-[var(--rx-fg-dim)]">
                                  すばらしい
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                                <div className="text-caption-text font-bold text-amber-500">
                                  极好的；出色的
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      {/* Preview: Pomodoro Timer */}
                      {widget.id !== "widget-meeting-reminder" &&
                        widget.previewType === "timer" && (
                          <div className="flex items-center justify-between px-1">
                            <div className="space-y-0.5">
                              <span className="text-[11px] text-[var(--rx-fg-dim)]">
                                沉浸专注
                              </span>
                              <div className="text-module-title font-mono font-bold text-sky-400">
                                {Math.floor(timeLeft / 60)
                                  .toString()
                                  .padStart(2, "0")}
                                :{(timeLeft % 60).toString().padStart(2, "0")}
                              </div>
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTimerRunning(!timerRunning);
                              }}
                              className="h-7 px-2.5 text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white"
                            >
                              {timerRunning ? "暂停" : "开始"}
                            </Button>
                          </div>
                        )}

                      {/* Preview: Streak战报 */}
                      {widget.previewType === "streak" && (
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                              <Flame className="h-5 w-5 fill-rose-500" />
                            </div>
                            <div>
                              <div className="text-caption-text font-bold text-rose-500">
                                14 天连续打卡
                              </div>
                              <div className="text-[10px] text-[var(--rx-fg-dim)]">
                                学霸爆发中 🔥
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono text-caption-text text-amber-500 font-bold">
                            💎 1,280
                          </div>
                        </div>
                      )}

                      {/* Preview: Forecast */}
                      {widget.id !== "widget-glass-weather-3d" &&
                        widget.previewType === "forecast" && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-caption-text">
                              <span className="text-[var(--rx-fg-dim)]">记忆留存</span>
                              <span className="font-bold text-emerald-500 font-mono">
                                92.5%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[var(--rx-bg-soft)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: "92.5%" }}
                              />
                            </div>
                            <div className="text-[10px] text-[var(--rx-fg-dim)] flex justify-between">
                              <span>黄金时段: 20:00</span>
                              <span>待复习: 45</span>
                            </div>
                          </div>
                        )}

                      {/* Preview: Heatmap */}
                      {widget.previewType === "heatmap" && (
                        <div className="space-y-1">
                          <div className="text-[10px] text-[var(--rx-fg-dim)] font-mono flex justify-between">
                            <span>活跃分布</span>
                            <span>428 卡</span>
                          </div>
                          <div className="grid grid-cols-12 gap-1">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <div
                                key={`heatmap_sample_cell_${i}`}
                                className={cn(
                                  "h-3 rounded-xs",
                                  i % 4 === 0
                                    ? "bg-amber-500"
                                    : i % 3 === 0
                                    ? "bg-amber-500/60"
                                    : i % 2 === 0
                                    ? "bg-amber-500/25"
                                    : "bg-[var(--rx-bg-soft)]"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preview: Quote */}
                      {widget.previewType === "quote" && (
                        <div className="space-y-0.5 text-center py-0.5">
                          <div className="text-caption-text font-bold text-indigo-400">
                            「継続は力なり」
                          </div>
                          <div className="text-[11px] text-[var(--rx-fg-dim)] line-clamp-1">
                            坚持就是力量 —— 日积月累。
                          </div>
                        </div>
                      )}

                      {/* Preview: Game */}
                      {widget.previewType === "game" && (
                        <div className="flex items-center justify-between px-1">
                          <div className="space-y-0.5">
                            <div className="text-caption-text font-bold text-amber-400">
                              街机碰一碰连连看
                            </div>
                            <div className="text-[10px] text-[var(--rx-fg-dim)]">
                              ADHD 极速对决
                            </div>
                          </div>
                          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                            <Gamepad2 className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Footer */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-3 mt-3 border-t border-[var(--rx-border-soft)] flex items-center justify-between"
                  >
                    <button
                      onClick={() => handleCardClick(widget)}
                      className="px-2.5 py-1.5 rounded-lg text-caption-text font-semibold flex items-center gap-1 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)] hover:border-[var(--rx-accent)]/50 text-[var(--rx-fg)] transition-all cursor-pointer"
                      title="触发沉浸展示"
                    >
                      <Eye className="h-3.5 w-3.5 text-amber-500" />
                      <span>沉浸展示</span>
                    </button>

                    <button
                      onClick={() => togglePin(widget.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-button-text font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                        isPinned
                          ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25"
                          : "bg-[var(--rx-accent)] text-[var(--rx-accent-fg)] hover:opacity-90 shadow-xs"
                      )}
                    >
                      {isPinned ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>已添加</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>常驻桌面</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3 border-t border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/40 flex items-center justify-between text-caption-text text-[var(--rx-fg-dim)]">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              点击组件卡片可直接触发 1:1 沉浸交互视图与动态数据配置
            </span>
            <Button
              onClick={onClose}
              className="h-8 px-4 text-button-text bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)] hover:bg-[var(--rx-sidebar-hover)]"
            >
              完成
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Immersive Active Mode Modal */}
      {activeImmersiveWidget && (
        <ImmersiveWidgetView
          widget={activeImmersiveWidget}
          onClose={() => setActiveImmersiveWidget(null)}
          onPinWidget={togglePin}
          isPinned={pinnedWidgetIds.includes(activeImmersiveWidget.id)}
        />
      )}
    </AnimatePresence>
  );
}
