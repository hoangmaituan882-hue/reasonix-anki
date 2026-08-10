import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ConnectionIndicator } from "./components/ConnectionIndicator";
import { DisconnectedScreen } from "./components/DisconnectedScreen";
import { SettingsSheet } from "./components/SettingsSheet";
import { Sidebar } from "./components/Sidebar";
import { ToasterLite } from "./components/ToasterLite";
import { WindowControls } from "./components/WindowControls";
import { BrowseView } from "./features/BrowseView";
import { EditorView } from "./features/EditorView";
import { NewNoteDialog } from "./features/editor/NewNoteDialog";
import { NoteEditorSheet } from "./features/editor/NoteEditorSheet";
import { ReviewView } from "./features/ReviewView";
import { StatsView } from "./features/StatsView";
import { StudyView } from "./features/study/StudyView";
import { TodayView } from "./features/today/TodayView";
import { useAnkiConnection } from "./lib/anki/useConnection";
import { inTauri } from "./lib/anki/transport";
import { applyTheme, useAppStore, viewTitle } from "./stores/app";
import { useStudySessionStore } from "./stores/studySession";

function App() {
  const { view, direction, dark, roundedCorners } = useAppStore();
  const connection = useAnkiConnection();
  const studyPhase = useStudySessionStore((state) => state.phase);
  const studySessionId = useStudySessionStore((state) => state.sessionId);
  const studyDeckName = useStudySessionStore((state) => state.deckName);
  const immersiveStudy = studySessionId !== null || studyPhase === "done";
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 主题落盘到 <html>：data-direction + .dark（reasonix 主题约定）
  useEffect(() => {
    applyTheme(direction, dark);
  }, [direction, dark]);

  // 无边框窗口（decorations:false）：header 作为自绘标题栏，按下即拖拽移动
  const startDrag = () => {
    if (inTauri) void getCurrentWindow().startDragging();
  };
  const toggleMaximize = () => {
    if (inTauri) void getCurrentWindow().toggleMaximize();
  };

  // 圆角开关：关闭时根容器四角变直角（透明窗口四角不再透出，观感即直角窗口）
  const rootRounded = roundedCorners
    ? "rounded-[var(--rx-r-l)]"
    : "rounded-none";

  // 设置齿轮按钮（header 右侧，可拖拽区 stopPropagation 防误触拖拽）
  const settingsButton = (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setSettingsOpen(true);
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
      <div
        className={`flex h-screen flex-col overflow-hidden bg-[var(--rx-bg)] text-[var(--rx-fg)] ${rootRounded}`}
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
            {settingsButton}
            <ConnectionIndicator />
            {inTauri && <WindowControls />}
          </div>
        </header>
        <main className="min-h-0 flex-1"><StudyView /></main>
        <ToasterLite />
        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    );
  }

  return (
    // 透明窗口 + 圆角根容器：四角透出为圆角效果（半径走设计令牌 --rx-r-l；开关可关）
    <div
      className={`flex h-screen overflow-hidden bg-[var(--rx-bg)] text-[var(--rx-fg)] ${rootRounded}`}
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
          {connection.status !== "connected" ? (
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
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

export default App;
