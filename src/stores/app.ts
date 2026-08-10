/**
 * 应用级状态：视图切换 + 主题（技术方案 §1 视图切换 / §3.2 主题接入）
 * 桌面单窗口无路由库，currentView 状态驱动；主题默认 graphite + 暗。
 */
import { create } from "zustand";

export type View = "today" | "browse" | "editor" | "review" | "stats";

export type Direction =
  | "graphite"
  | "aurora"
  | "slate"
  | "carbon"
  | "nocturne"
  | "amber";

export const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: "graphite", label: "石墨" },
  { id: "aurora", label: "极光" },
  { id: "slate", label: "石板" },
  { id: "carbon", label: "碳" },
  { id: "nocturne", label: "夜曲" },
  { id: "amber", label: "琥珀" },
];

/** 设置抽屉的骨架布局变体：分栏式 / 标签式 / 卡片式 */
export type SettingsDesign = "columns" | "tabs" | "cards";

export const SETTINGS_DESIGNS: { id: SettingsDesign; label: string }[] = [
  { id: "columns", label: "分栏式" },
  { id: "tabs", label: "标签式" },
  { id: "cards", label: "卡片式" },
];

const VIEW_TITLES: Record<View, string> = {
  today: "今日学习",
  browse: "牌组浏览器",
  editor: "笔记编辑",
  review: "复习",
  stats: "统计概览",
};

export function viewTitle(view: View): string {
  return VIEW_TITLES[view];
}

interface AppState {
  view: View;
  direction: Direction;
  dark: boolean;
  sidebarCollapsed: boolean;
  /** 窗口四角圆角开关（Win10 无边框透明窗口 + CSS 圆角；关闭即直角观感） */
  roundedCorners: boolean;
  /** 设置抽屉使用的骨架布局变体 */
  settingsDesign: SettingsDesign;
  setView: (view: View) => void;
  setDirection: (direction: Direction) => void;
  toggleDark: () => void;
  toggleSidebar: () => void;
  setRoundedCorners: (enabled: boolean) => void;
  setSettingsDesign: (design: SettingsDesign) => void;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const useAppStore = create<AppState>()((set, get) => ({
  view: "today",
  direction: load<Direction>("ra.direction", "graphite"),
  dark: load<boolean>("ra.dark", true),
  sidebarCollapsed: load<boolean>("ra.sidebarCollapsed", false),
  roundedCorners: load<boolean>("ra.roundedCorners", true),
  settingsDesign: load<SettingsDesign>("ra.settingsDesign", "columns"),

  setView: (view) => set({ view }),

  setDirection: (direction) => {
    localStorage.setItem("ra.direction", JSON.stringify(direction));
    set({ direction });
  },

  toggleDark: () => {
    const dark = !get().dark;
    localStorage.setItem("ra.dark", JSON.stringify(dark));
    set({ dark });
  },

  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed;
    localStorage.setItem("ra.sidebarCollapsed", JSON.stringify(sidebarCollapsed));
    set({ sidebarCollapsed });
  },

  setRoundedCorners: (roundedCorners) => {
    localStorage.setItem("ra.roundedCorners", JSON.stringify(roundedCorners));
    set({ roundedCorners });
  },

  setSettingsDesign: (settingsDesign) => {
    localStorage.setItem("ra.settingsDesign", JSON.stringify(settingsDesign));
    set({ settingsDesign });
  },
}));

/** 把主题状态同步到 <html>（data-direction + .dark） */
export function applyTheme(direction: Direction, dark: boolean): void {
  const root = document.documentElement;
  root.setAttribute("data-direction", direction);
  root.classList.toggle("dark", dark);
}
