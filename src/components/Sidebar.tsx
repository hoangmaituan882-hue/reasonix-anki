import {
  BarChart3,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Library,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquarePen,
  Sun,
} from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@reasonix/ui";
import { DIRECTIONS, useAppStore, type Direction, type View } from "../stores/app";
import { useSettingsStore } from "../stores/settings";
import { openSettingsWindow } from "../lib/window";

const NAV_ITEMS: { id: View; label: string; icon: typeof Library }[] = [
  { id: "today", label: "今日学习", icon: CalendarDays },
  { id: "browse", label: "牌组浏览", icon: Library },
  { id: "editor", label: "笔记编辑", icon: SquarePen },
  { id: "review", label: "复习", icon: GraduationCap },
  { id: "stats", label: "统计概览", icon: BarChart3 },
  { id: "settings", label: "系统设置", icon: Settings },
];

/**
 * 悬浮面板式侧边栏（Floating Panel）。
 *
 * 整块侧边栏是一张悬浮圆角卡片：与窗口左/上/下边缘留 12px 间隙（m-3），
 * 圆角走 --rx-r-l，边框 --rx-border-soft，底色 --rx-sidebar 与画布
 * --rx-bg 形成层级；不再使用贴边 border-r 条状面板。
 *
 * 收缩动画纪律（沿用 v0.1 验证过的几何）：
 * - 宽度 w-52 ↔ w-14 走 --rx-dur-slow + --rx-ease 过渡；
 * - 展开/收缩两态图标列位置不变（按钮 px-3 恒定），文字只淡出（opacity
 *   走 --rx-dur-base）不位移；
 * - prefers-reduced-motion 全部降级为无动画。
 */
export function Sidebar() {
  const {
    view,
    setView,
    direction,
    setDirection,
    dark,
    toggleDark,
    sidebarCollapsed: collapsed,
    toggleSidebar,
  } = useAppStore();
  const openSettingsModal = useSettingsStore((s) => s.openSettingsModal);

  const cycleDirection = () => {
    const idx = DIRECTIONS.findIndex((d) => d.id === direction);
    setDirection(DIRECTIONS[(idx + 1) % DIRECTIONS.length].id);
  };

  const currentDirectionLabel =
    DIRECTIONS.find((d) => d.id === direction)?.label ?? direction;

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        className={cn(
          // 悬浮面板：四周 12px 间隙 + 大圆角 + 软边框，浮在画布上
          "m-3 flex shrink-0 flex-col overflow-hidden",
          "rounded-[var(--rx-r-l)] border border-[var(--rx-border-soft)] bg-[var(--rx-sidebar)]",
          "transition-[width] duration-[var(--rx-dur-slow)] ease-[var(--rx-ease)] motion-reduce:transition-none",
          collapsed ? "w-14" : "w-52",
        )}
      >
        {/* 品牌区：图标列与导航图标列对齐（展开态统一 20px = px-5），文字淡出 */}
        <div
          className={cn(
            "flex items-center gap-2 pt-4 pb-3",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--rx-r-m)] rx-grad"
            style={{ color: "var(--rx-accent-fg)" }}
            aria-hidden
          >
            <GraduationCap className="h-4 w-4" />
          </span>
          <div
            className={cn(
              "min-w-0 overflow-hidden leading-tight whitespace-nowrap",
              "transition-opacity duration-[var(--rx-dur-base)] motion-reduce:transition-none",
              collapsed && "opacity-0",
            )}
            aria-hidden={collapsed}
          >
            <div className="text-sm font-semibold">Reasonix Anki</div>
            <div className="text-2xs text-[var(--rx-fg-faint)]">
              日语学习工作台 · v0.2
            </div>
          </div>
        </div>

        <Separator className="bg-[var(--rx-border-soft)]" />

        {/* 导航：图标列不动，文字淡出；收缩态 Tooltip 补语义 */}
        <nav
          className="flex-1 space-y-0.5 overflow-y-auto p-2"
          aria-label="主导航"
        >
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            const button = (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === "settings") {
                    openSettingsModal();
                  } else {
                    setView(id);
                  }
                }}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                className={cn(
                  "rx-press flex w-full items-center rounded-[var(--rx-r-m)] px-3 py-2 text-sm transition-colors",
                  collapsed ? "gap-0" : "gap-2.5",
                  active
                    ? "font-medium rx-accent-soft"
                    : "text-[var(--rx-fg-dim)] hover:bg-[var(--rx-sidebar-hover)]",
                )}
                style={active ? { color: "var(--rx-accent)" } : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left transition-opacity duration-[var(--rx-dur-base)] motion-reduce:transition-none",
                    collapsed && "opacity-0",
                  )}
                  aria-hidden={collapsed}
                >
                  {label}
                </span>
              </button>
            );
            if (id === "settings" && !collapsed) {
              return (
                <div key={id} className="group/navitem relative flex w-full items-center">
                  {button}
                  {/* 系统设置项专属：独立窗口快捷图标 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openSettingsWindow();
                    }}
                    title="在独立窗口中打开设置"
                    className="absolute right-2 opacity-0 group-hover/navitem:opacity-100 hover:text-[var(--rx-accent)] text-[var(--rx-fg-faint)] p-1 rounded-md hover:bg-[var(--rx-bg-elev)] transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }
            return collapsed ? (
              <Tooltip key={id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            ) : (
              button
            );
          })}
        </nav>

        {/* 主题控制：展开态内容左边界对齐图标列（px-5）；收缩态图标按钮居中 */}
        <div
          className={cn(
            "space-y-2 border-t border-[var(--rx-border-soft)]",
            collapsed ? "p-2" : "px-5 py-3",
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rx-press"
                    onClick={cycleDirection}
                    aria-label={`主题方向：${currentDirectionLabel}，点击切换`}
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  主题方向：{currentDirectionLabel}（点击切换）
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rx-press"
                    onClick={toggleDark}
                    aria-label={dark ? "切换到浅色" : "切换到深色"}
                  >
                    {dark ? (
                      <Sun className="h-3.5 w-3.5" />
                    ) : (
                      <Moon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {dark ? "切换到浅色" : "切换到深色"}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-2xs font-medium text-[var(--rx-fg-faint)]">
                <Palette className="h-3 w-3" />
                主题方向
              </div>
              <Select
                value={direction}
                onValueChange={(value) => setDirection(value as Direction)}
              >
                <SelectTrigger className="w-full" aria-label="主题方向">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start rx-press"
                onClick={toggleDark}
              >
                {dark ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
                {dark ? "切换到浅色" : "切换到深色"}
              </Button>
            </>
          )}
        </div>

        {/* 收缩/展开 */}
        <div
          className={cn(
            "border-t border-[var(--rx-border-soft)]",
            collapsed ? "p-2" : "p-2",
          )}
        >
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn(
              "rx-press w-full",
              !collapsed && "justify-start text-[var(--rx-fg-dim)]",
            )}
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                收起侧边栏
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
