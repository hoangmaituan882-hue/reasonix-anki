/**
 * 连接状态机（技术方案 §4.3 连接指示器）
 * version + requestPermission 组合探测，3s 轮询；双通道通用。
 */
import { useQuery } from "@tanstack/react-query";
import { anki } from "./actions";

export interface AnkiStatus {
  version: number;
  permission: unknown;
}

export type ConnectionState = "checking" | "connected" | "disconnected";

export function useAnkiConnection() {
  const query = useQuery({
    queryKey: ["anki", "status"],
    queryFn: async (): Promise<AnkiStatus> => {
      const [version, permission] = await Promise.all([
        anki.version(),
        anki.requestPermission().catch(() => null),
      ]);
      return { version, permission };
    },
    refetchInterval: 3000,
    retry: false,
  });

  const status: ConnectionState = query.isPending
    ? "checking"
    : query.isError
      ? "disconnected"
      : "connected";

  return {
    status,
    version: query.data?.version,
    error: query.error instanceof Error ? query.error.message : undefined,
    refetch: query.refetch,
  };
}

/**
 * 粗粒度连接状态 hook（供 App 根等高频订阅点使用）：
 * 利用 TanStack Query v5 的 prop-tracking（trackResult）——本组件只订阅
 * isPending/isError 派生结果，3s 轮询 refetch 时 status 未变化则不触发
 * 订阅者重渲染——避免整棵应用树每 3 秒全量重渲染。
 */
export function useAnkiStatus(): ConnectionState {
  const query = useQuery({
    queryKey: ["anki", "status"],
    queryFn: async (): Promise<AnkiStatus> => {
      const [version, permission] = await Promise.all([
        anki.version(),
        anki.requestPermission().catch(() => null),
      ]);
      return { version, permission };
    },
    refetchInterval: 3000,
    retry: false,
  });
  return query.isPending ? "checking" : query.isError ? "disconnected" : "connected";
}
