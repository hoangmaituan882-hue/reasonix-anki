import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SettingsWindowLayout } from "./SettingsWindowLayout";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Anki 即后端：默认不自动重取，由各处显式控制
      refetchOnWindowFocus: false,
      retry: false,
      // 30s 内复用缓存：切视图（卸载→重挂载）不再重拉 deckNamesAndIds/getDeckStats 等
      staleTime: 30_000,
    },
  },
});

// 独立设置窗口：openSettingsWindow 创建 ?view=settings 的新窗口
const searchParams = new URLSearchParams(window.location.search);
const isStandaloneSettings = searchParams.get("view") === "settings";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {isStandaloneSettings ? <SettingsWindowLayout /> : <App />}
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
);
