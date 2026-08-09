import { Badge } from "@reasonix/ui";
import { useAnkiConnection } from "../lib/anki/useConnection";
import { cn } from "@reasonix/ui";

/** 头部连接指示器：绿点已连接 / 琥珀色检查中 / 红点断开 */
export function ConnectionIndicator() {
  const { status, version } = useAnkiConnection();

  const dot = (color: string) => (
    <span
      aria-hidden
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status === "checking" && "rx-pulse")}
      style={{ background: color }}
    />
  );

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
