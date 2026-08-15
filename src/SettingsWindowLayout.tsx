/**
 * SettingsWindowLayout.tsx - 系统设置独立窗口专属外壳（包含独立无边框标题栏、拖拽手势与关闭逻辑）
 */
import { useEffect, useState } from "react";
import {
  Minus,
  Square,
  X,
  Sliders,
} from "lucide-react";
import { Button } from "@reasonix/ui";
import { SettingsView } from "./features/SettingsView";
import { inTauri } from "./lib/anki/transport";
import { applyTheme, useAppStore } from "./stores/app";
import { ToasterLite } from "./components/ToasterLite";

export function SettingsWindowLayout() {
  const { direction, dark } = useAppStore();
  const [isMaximized, setIsMaximized] = useState(false);

  // 独立窗口同步挂载主题
  useEffect(() => {
    applyTheme(direction, dark);
  }, [direction, dark]);

  // 同步 Tauri 窗口属性
  useEffect(() => {
    if (!inTauri) return;

    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        setIsMaximized(await appWindow.isMaximized());
        unlisten = await appWindow.onResized(async () => {
          setIsMaximized(await appWindow.isMaximized());
        });
      } catch (err) {
        console.warn("Failed to listen window resized:", err);
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  const handleMinimize = async () => {
    if (inTauri) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    }
  };

  const handleToggleMaximize = async () => {
    if (inTauri) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
      setIsMaximized(await getCurrentWindow().isMaximized());
    }
  };

  const handleClose = async () => {
    if (inTauri) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } else {
      window.close();
    }
  };

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden select-none bg-[var(--rx-bg)] text-[var(--rx-fg)] rounded-2xl border border-[var(--rx-border-soft)] shadow-2xl transition-colors duration-200"
      data-direction={direction}
    >
      {/* 独立窗口无边框顶部拖拽栏 */}
      <header
        data-tauri-drag-region
        className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] px-4 cursor-default select-none"
      >
        {/* 标题 */}
        <div data-tauri-drag-region className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--rx-accent)] text-[var(--rx-accent-fg)] shadow-xs">
            <Sliders className="h-3.5 w-3.5" />
          </div>
          <span className="text-body-sm font-bold tracking-tight">
            Reasonix Anki · 系统设置
          </span>
          <span className="rounded-full bg-[var(--rx-bg-soft)] px-2 py-0.5 text-micro-xxs font-mono text-[var(--rx-fg-faint)]">
            独立窗口
          </span>
        </div>

        {/* 窗口控制按钮（最小化、最大化、关闭） */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMinimize}
            className="h-7 w-7 text-[var(--rx-fg-dim)] hover:bg-[var(--rx-sidebar-hover)] hover:text-[var(--rx-fg)] rounded-lg"
            title="最小化"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleMaximize}
            className="h-7 w-7 text-[var(--rx-fg-dim)] hover:bg-[var(--rx-sidebar-hover)] hover:text-[var(--rx-fg)] rounded-lg"
            title={isMaximized ? "向下还原" : "最大化"}
          >
            <Square className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-7 w-7 text-[var(--rx-fg-dim)] hover:bg-rose-500 hover:text-white rounded-lg transition-colors"
            title="关闭窗口"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* 设置内容主体（带独立滚动） */}
      <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--rx-bg)]">
        <SettingsView standalone={true} />
      </main>

      {/* 全局通知 */}
      <ToasterLite />
    </div>
  );
}
