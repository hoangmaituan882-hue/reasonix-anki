/**
 * window.ts - 跨平台多窗口管理（Tauri 2 桌面环境 + 浏览器环境适配）
 */
import { inTauri } from "./anki/transport";

/**
 * 打开独立的系统设置窗口
 */
export async function openSettingsWindow(): Promise<void> {
  if (inTauri) {
    try {
      // 动态导入 Tauri WebviewWindow API
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

      // 检查 settings 窗口是否已存在
      const existing = await WebviewWindow.getByLabel("settings");
      if (existing) {
        await existing.show();
        await existing.unminimize();
        await existing.setFocus();
        return;
      }

      // 创建独立的系统设置窗口
      const settingsWin = new WebviewWindow("settings", {
        url: "index.html?view=settings",
        title: "系统设置 — Reasonix Anki",
        width: 900,
        height: 640,
        minWidth: 760,
        minHeight: 520,
        resizable: true,
        decorations: false,
        transparent: true,
        shadow: false,
        center: true,
      });

      // 监听创建失败异常
      settingsWin.once("tauri://error", (e) => {
        console.error("创建系统设置窗口失败:", e);
      });
    } catch (err) {
      console.warn("Tauri 创建独立窗口失败，回退到浏览器窗口:", err);
      fallbackOpenBrowserWindow();
    }
  } else {
    fallbackOpenBrowserWindow();
  }
}

function fallbackOpenBrowserWindow() {
  const url = `${window.location.origin}${window.location.pathname}?view=settings`;
  const feat = "width=920,height=650,left=150,top=120,resizable=yes,scrollbars=yes,status=no";
  const win = window.open(url, "reasonix_settings", feat);
  if (win) {
    win.focus();
  }
}
