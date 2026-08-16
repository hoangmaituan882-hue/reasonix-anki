import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@reasonix/ui";

interface BuildInfo {
  APP_VERSION: string;
  GIT_COMMIT: string;
  BUILD_TIME: string;
}

/**
 * buildInfo.ts 由 scripts/build-info.mjs 生成，且被 .gitignore 排除
 * （BUILD_TIME 每次构建必变，避免污染工作区）。干净 clone（Google AI
 * Studio / CI / 协作者）没有此文件——静态 import 会导致编译失败。
 * 用 import.meta.glob 动态发现：文件缺失时 glob 返回空对象 → 回退开发版
 * 常量，保证任何环境可编译运行（本地 build:info 后仍显示真实版本）。
 */
const buildInfoMods = import.meta.glob<{ default: BuildInfo }>("../lib/buildInfo.ts", {
  eager: true,
});
const DEFAULT_BUILD: BuildInfo = {
  APP_VERSION: "0.1.0-dev",
  GIT_COMMIT: "dev",
  BUILD_TIME: "",
};
const buildInfo: BuildInfo = buildInfoMods["../lib/buildInfo.ts"]?.default ?? DEFAULT_BUILD;

/**
 * 关于分组（P8）：应用版本 / git commit / 构建时间。
 * 用户可自助核对是否最新发布（对照 RELEASE.json）。
 */
export function AboutCard() {
  const builtAt = new Date(buildInfo.BUILD_TIME);
  const builtLabel = buildInfo.BUILD_TIME
    ? Number.isNaN(builtAt.getTime())
      ? buildInfo.BUILD_TIME
      : builtAt.toLocaleString()
    : "开发版（未运行 build:info）";
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
          <span className="font-bold">v{buildInfo.APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--rx-fg-dim)]">Git commit</span>
          <span className="font-mono text-caption-xs text-[var(--rx-fg-dim)]">
            {buildInfo.GIT_COMMIT}
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
