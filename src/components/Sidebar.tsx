import {
  BarChart3,
  CalendarDays,
  GraduationCap,
  Library,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@reasonix/ui";
import { DIRECTIONS, useAppStore, type Direction, type View } from "../stores/app";

const NAV_ITEMS: { id: View; label: string; icon: typeof Library }[] = [
  { id: "today", label: "今日学习", icon: CalendarDays },
  { id: "browse", label: "牌组浏览", icon: Library },
  { id: "editor", label: "笔记编辑", icon: SquarePen },
  { id: "review", label: "复习", icon: GraduationCap },
  { id: "stats", label: "统计概览", icon: BarChart3 },
];

/**
 * 左侧栏：上下两张悬浮卡片布局（技术方案 §3.2 / §5）。
 *
 * 结构分层：容器保持 width 过渡（--rx-dur-slow + --rx-ease），内部以
 * --rx-bg-elev 抬升的两张悬浮卡承载信息——
 *   卡 1「品牌卡」：应用名 + 版本副标题（恒定图标列，文字淡出）；
 *   卡 2「功能卡」：导航 + 主题控制 + 收缩切换（flex-1 撑满剩余高度）。
 * 卡片间距 gap 与圆角 --rx-r-m 形成悬浮层级；收缩态降级为紧凑图标卡。
 * 动画纪律：prefers-reduced-motion 全部降级为无动画。
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
          "flex shrink-0 flex-col overflow-hidden border-r border-[var(--rx-border-soft)] bg-[var(--rx-sidebar)]",
          "transition-[width] duration-[var(--rx-dur-slow)] ease-[var(--rx-ease)] motion-reduce:transition-none",
          collapsed ? "w-14" : "w-52",
        )}
      >
        {/* 悬浮卡容器：上下两张卡，间距 gap 形成悬浮层级；内边距随宽度过渡 */}
        <div
          className={cn(
            "flex h-full flex-col gap-3 overflow-hidden",
            "transition-[padding] duration-[var(--rx-dur-slow)] ease-[var(--rx-ease)] motion-reduce:transition-none",
            collapsed ? "p-2" : "p-3",
          )}
        >
          {/* 卡 1：品牌卡 */}
          <div
            className={cn(
              "flex shrink-0 items-center rounded-[var(--rx-r-m)] bg-[var(--rx-bg-elev)]",
              collapsed ? "justify-center px-0 py-3" : "gap-2 px-3 py-3",
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

          {/* 卡 2：功能卡（导航 + 主题控制 + 收缩）；收缩态去内边距让按钮贴卡居中 */}
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col rounded-[var(--rx-r-m)] bg-[var(--rx-bg-elev)]",
              collapsed ? "p-0" : "p-2",
            )}
          >
            {/* 导航：图标列不动，文字淡出；收缩态 Tooltip 补语义 */}
            <nav
              className="flex-1 space-y-0.5 overflow-y-auto"
              aria-label="主导航"
            >
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const active = view === id;
                const button = (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setView(id)}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? label : undefined}
                    className={cn(
                      "rx-press flex items-center rounded-[var(--rx-r-m)] text-sm transition-colors",
                      collapsed
                        ? "h-8 w-8 justify-center"
                        : "w-full gap-2.5 px-3 py-2",
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

            {/* 主题控制：展开态完整控件，收缩态图标按钮 */}
            <div className="space-y-2 pt-2">
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
            <div className="pt-2">
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "sm"}
                className={cn(
                  "rx-press",
                  collapsed
                    ? "h-8 w-8 self-center"
                    : "w-full justify-start text-[var(--rx-fg-dim)]",
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
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
