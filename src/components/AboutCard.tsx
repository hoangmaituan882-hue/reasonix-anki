import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@reasonix/ui";
import {
  APP_VERSION,
  BUILD_TIME,
  GIT_COMMIT,
} from "../lib/buildInfo";

/**
 * 关于分组（P8）：应用版本 / git commit / 构建时间。
 * 用户可自助核对是否最新发布（对照 RELEASE.json）。
 */
export function AboutCard() {
  const builtAt = new Date(BUILD_TIME);
  const builtLabel = Number.isNaN(builtAt.getTime())
    ? BUILD_TIME
    : builtAt.toLocaleString();
  return (
    <Card className="border-[var(--rx-border-soft)] bg-[var(--rx-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[18px] font-bold text-[var(--rx-fg)] leading-[1.4]">关于</CardTitle>
        <CardDescription className="text-body-sm text-[var(--rx-fg-dim)]">
          版本与构建信息
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 text-body-sm">
        <div className="flex items-center justify-between">
          <span className="text-[var(--rx-fg-dim)]">应用版本</span>
          <span className="font-bold">v{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--rx-fg-dim)]">Git commit</span>
          <span className="font-mono text-caption-xs text-[var(--rx-fg-dim)]">
            {GIT_COMMIT}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--rx-fg-dim)]">构建时间</span>
          <span className="text-caption-xs text-[var(--rx-fg-dim)]">{builtLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
