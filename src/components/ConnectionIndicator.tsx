import { Sparkles } from "lucide-react";
import { Badge } from "@reasonix/ui";
import { useAnkiConnection } from "../lib/anki/useConnection";
import { cn } from "@reasonix/ui";
import { isDemoMode, setDemoMode } from "../lib/anki/demo";

/**
 * 头部连接指示器：绿点已连接 / 琥珀色检查中 / 红点断开。
 * 演示模式：显示「演示模式」紫色徽章，点击退出（恢复真实连接检测）。
 */
export function ConnectionIndicator() {
  const { status, version, refetch } = useAnkiConnection();

  const dot = (color: string) => (
    <span
      aria-hidden
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status === "checking" && "rx-pulse")}
      style={{ background: color }}
    />
  );

  if (isDemoMode()) {
    return (
      <button
        type="button"
        onClick={() => {
          setDemoMode(false);
          void refetch();
        }}
        title="退出演示模式，恢复真实 Anki 连接"
        className="inline-flex h-6 items-center gap-1.5 rounded-full border border-[var(--rx-accent)]/40 bg-[var(--rx-accent)]/10 px-2.5 text-[11px] font-bold text-[var(--rx-accent)] transition-colors hover:bg-[var(--rx-accent)]/20"
      >
        <Sparkles className="h-3 w-3" />
        演示模式 · 点击退出
      </button>
    );
  }

  if (status === "connected") {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        {dot("var(--rx-ok)")}
        Anki 已连接{typeof version === "number" ? ` · API v${version}` : ""}
      </Badge>
    );
  }

  if (status === "checking") {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        {dot("var(--rx-warn)")}
        正在连接 Anki…
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      {dot("var(--rx-err)")}
      Anki 未连接
    </Badge>
  );
}
