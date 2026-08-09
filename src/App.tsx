import { useEffect } from "react";
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
import { StatsView } from "./features/StatsView";
import { useAnkiConnection } from "./lib/anki/useConnection";
import { inTauri } from "./lib/anki/transport";
import { applyTheme, useAppStore, viewTitle } from "./stores/app";

function App() {
  const { view, direction, dark } = useAppStore();
  const connection = useAnkiConnection();

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

  return (
    // 透明窗口 + 圆角根容器：四角透出为圆角效果（半径走设计令牌 --rx-r-l）
    <div className="flex h-screen overflow-hidden rounded-[var(--rx-r-l)] bg-[var(--rx-bg)] text-[var(--rx-fg)]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          onMouseDown={startDrag}
          onDoubleClick={toggleMaximize}
          className="flex h-12 shrink-0 select-none items-center justify-between border-b border-[var(--rx-border-soft)] px-4"
        >
          <h1 className="text-sm font-semibold">{viewTitle(view)}</h1>
          <div className="flex items-center gap-2">
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
  );
}

export default App;
