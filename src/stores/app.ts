/**
 * 应用级状态：视图切换 + 主题（技术方案 §1 视图切换 / §3.2 主题接入）
 * 桌面单窗口无路由库，currentView 状态驱动；主题默认 graphite + 暗。
 */
import { create } from "zustand";

export type View = "browse" | "editor" | "review" | "stats";

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

const VIEW_TITLES: Record<View, string> = {
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
  setView: (view: View) => void;
  setDirection: (direction: Direction) => void;
  toggleDark: () => void;
  toggleSidebar: () => void;
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
  view: "browse",
  direction: load<Direction>("ra.direction", "graphite"),
  dark: load<boolean>("ra.dark", true),
  sidebarCollapsed: load<boolean>("ra.sidebarCollapsed", false),

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
}));

/** 把主题状态同步到 <html>（data-direction + .dark） */
export function applyTheme(direction: Direction, dark: boolean): void {
  const root = document.documentElement;
  root.setAttribute("data-direction", direction);
  root.classList.toggle("dark", dark);
}
