import { Widget } from "./types";

export type DesktopWidgetInfo = Widget;

export const WIDGET_CATEGORIES = [
  { id: "all", label: "全部组件" },
  { id: "memory", label: "记忆强化" },
  { id: "time", label: "时间专注" },
  { id: "analytics", label: "学习分析" },
  { id: "fun", label: "趣味娱乐" },
] as const;

export { REGISTERED_WIDGETS as DESKTOP_WIDGETS } from "./widgetRegistry";

