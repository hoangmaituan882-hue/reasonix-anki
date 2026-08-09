import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { cn } from "@reasonix/ui";

/**
 * 自绘窗口控制按钮（无边框窗口 decorations:false 的配套）。
 * 仅 Tauri 形态渲染（App 里以 inTauri 门控）；浏览器调试模式无窗口可控制。
 */
export function WindowControls({ className }: { className?: string }) {
  const win = getCurrentWindow();

  const base =
    "flex h-8 w-11 items-center justify-center rounded-[var(--rx-r-s)] text-[var(--rx-fg-dim)] transition-colors duration-[var(--rx-dur-fast)] hover:bg-[var(--rx-sidebar-hover)] hover:text-[var(--rx-fg)]";

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="最小化"
        title="最小化"
        className={base}
        onClick={() => void win.minimize()}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="最大化或还原"
        title="最大化 / 还原"
        className={base}
        onClick={() => void win.toggleMaximize()}
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label="关闭"
        title="关闭"
        className={cn(base, "hover:bg-[var(--rx-danger)] hover:text-white")}
        onClick={() => void win.close()}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
