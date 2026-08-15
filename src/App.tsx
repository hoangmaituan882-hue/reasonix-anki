import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ConnectionIndicator } from "./components/ConnectionIndicator";
import { DisconnectedScreen } from "./components/DisconnectedScreen";
import { Sidebar } from "./components/Sidebar";
import { ToasterLite } from "./components/ToasterLite";
import { WindowControls } from "./components/WindowControls";
import { BrowseView } from "./features/BrowseView";
import { EditorView } from "./features/EditorView";
import { NewNoteDialog } from "./features/editor/NewNoteDialog";
import { NoteEditorSheet } from "./features/editor/NoteEditorSheet";
import { ReviewView } from "./features/ReviewView";
import { SettingsView } from "./features/SettingsView";
import { StatsView } from "./features/StatsView";
import { StudyView } from "./features/study/StudyView";
import { TodayView } from "./features/today/TodayView";
import { useAnkiConnection } from "./lib/anki/useConnection";
import { inTauri } from "./lib/anki/transport";
import { applyTheme, useAppStore, viewTitle } from "./stores/app";
import { useStudySessionStore } from "./stores/studySession";

function App() {
  const { view, setView, direction, dark, roundedCorners } = useAppStore();
  const connection = useAnkiConnection();
  const studyPhase = useStudySessionStore((state) => state.phase);
  const studySessionId = useStudySessionStore((state) => state.sessionId);
  const studyDeckName = useStudySessionStore((state) => state.deckName);
  const immersiveStudy = studySessionId !== null || studyPhase === "done";
  const [maximized, setMaximized] = useState(false);

  // 主题落盘到 <html>：data-direction + .dark（reasonix 主题约定）
  useEffect(() => {
    applyTheme(direction, dark);
  }, [direction, dark]);

  // 窗口阴影方案：根容器不贴窗口边缘（外层留 p-2 给阴影扩散），
  // 阴影绘制在透明 webview 上合成到桌面。最大化时窗口贴边，
  // 去掉间隙、圆角与阴影（还原全屏观感）；浏览器开发环境恒为 false。
  useEffect(() => {
    if (!inTauri) return;
    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void win.isMaximized().then((m) => {
      if (!disposed) setMaximized(m);
    });
    void win
      .onResized(async () => {
        const m = await win.isMaximized();
        if (!disposed) setMaximized(m);
      })
      .then((un) => {
        if (disposed) un();
        else unlisten = un;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // 无边框窗口（decorations:false）：header 作为自绘标题栏，按下即拖拽移动
  const startDrag = () => {
    if (inTauri) void getCurrentWindow().startDragging();
  };
  const toggleMaximize = () => {
    if (inTauri) void getCurrentWindow().toggleMaximize();
  };

  // 圆角开关：关闭时根容器四角变直角（透明窗口四角不再透出，观感即直角窗口）；
  // 最大化时强制直角（贴边窗口四角不可见）。
  const rootRounded =
    roundedCorners && !maximized
      ? "rounded-[var(--rx-r-l)]"
      : "rounded-none";
  // 窗口级阴影与边框：与周围窗口/桌面区分；最大化时不显示
  const rootWindow = maximized ? "" : "ra-window-shadow";
  // 阴影扩散留白（12px = p-3，须覆盖阴影外边界 offset+blur+spread=10px）：
  // 最大化时为 0
  const windowInset = maximized ? "p-0" : "p-3";

  // 设置齿轮按钮（header 右侧，可拖拽区 stopPropagation 防误触拖拽）
  const settingsButton = (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setView("settings");
      }}
      aria-label="设置"
      title="设置"
      className="rx-press flex h-6 w-6 items-center justify-center rounded-[var(--rx-r-m)] text-[var(--rx-fg-dim)] transition-colors hover:bg-[var(--rx-sidebar-hover)] hover:text-[var(--rx-fg)]"
    >
      <SettingsIcon className="h-4 w-4" />
    </button>
  );

  if (immersiveStudy) {
    return (
      <div className={`h-screen ${windowInset}`}>
        <div
          className={`flex h-full flex-col overflow-hidden bg-[var(--rx-bg)] text-[var(--rx-fg)] ${rootRounded} ${rootWindow}`}
        >
          <header
            onMouseDown={startDrag}
            onDoubleClick={toggleMaximize}
            className="flex h-10 shrink-0 select-none items-center justify-between border-b border-[var(--rx-border-soft)] px-4"
          >
            <div className="min-w-0 truncate text-xs font-medium text-[var(--rx-fg-dim)]">
              {studyDeckName ?? "今日学习"}
            </div>
            <div className="flex items-center gap-2">
              <ConnectionIndicator />
              {inTauri && <WindowControls />}
            </div>
          </header>
          <main className="min-h-0 flex-1"><StudyView /></main>
          <ToasterLite />
        </div>
      </div>
    );
  }

  return (
    // 透明窗口：外层留 inset 供窗口阴影扩散，内层圆角根容器承载应用背景
    // （四角透出即圆角效果；半径走设计令牌 --rx-r-l，开关可关）
    <div className={`h-screen ${windowInset}`}>
      <div
        className={`flex h-full overflow-hidden bg-[var(--rx-bg)] text-[var(--rx-fg)] ${rootRounded} ${rootWindow}`}
      >
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            onMouseDown={startDrag}
            onDoubleClick={toggleMaximize}
            className="flex h-12 shrink-0 select-none items-center justify-between border-b border-[var(--rx-border-soft)] px-4"
          >
            <h1 className="text-sm font-semibold">{viewTitle(view)}</h1>
            <div className="flex items-center gap-2">
              {settingsButton}
              <ConnectionIndicator />
              {inTauri && <WindowControls />}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {view === "settings" ? (
              <SettingsView />
            ) : connection.status !== "connected" ? (
              <DisconnectedScreen
                error={connection.error}
                onRetry={() => void connection.refetch()}
              />
            ) : (
              <>
                {view === "today" && <TodayView />}
                {view === "browse" && <BrowseView />}
                {view === "editor" && <EditorView />}
                {view === "review" && <ReviewView />}
                {view === "stats" && <StatsView />}
              </>
            )}
          </main>
        </div>

        <ToasterLite />
        <NoteEditorSheet />
        <NewNoteDialog />
      </div>
    </div>
  );
}

export default App;
