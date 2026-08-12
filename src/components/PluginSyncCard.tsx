import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@reasonix/ui";
import { ExternalLink, PackageCheck, PackageX } from "lucide-react";
import { reasonixStatus } from "../lib/reasonix-addon/client";
import { inTauri } from "../lib/anki/transport";
import { BUNDLED_ADDON_VERSION } from "../lib/reasonix-addon/bundledVersion";

/**
 * 插件与同步分组：展示配套插件的运行/内置版本一致性（staleness guard），
 * 并提供安装引导（打开内嵌安装包所在目录，由用户在 Anki 里"从文件安装"）。
 */
export function PluginSyncCard() {
  const [addonVersion, setAddonVersion] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [packagePath, setPackagePath] = useState<string | null>(null);

  // 查询插件运行版本（status.addonVersion）
  useEffect(() => {
    let disposed = false;
    void reasonixStatus(crypto.randomUUID())
      .then((status) => {
        if (!disposed) setAddonVersion(status.addonVersion ?? null);
      })
      .catch(() => {
        if (!disposed) setStatusError("无法连接配套插件（127.0.0.1:8766）");
      });
    return () => {
      disposed = true;
    };
  }, []);

  // 解析内嵌安装包路径（仅 Tauri 形态）
  useEffect(() => {
    if (!inTauri) return;
    let disposed = false;
    void invoke<string>("addon_package_path")
      .then((path) => {
        if (!disposed) setPackagePath(path);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);

  const installed = addonVersion !== null;
  const stale =
    installed && addonVersion !== BUNDLED_ADDON_VERSION;

  return (
    <Card className="border-[var(--rx-border-soft)] bg-[var(--rx-card)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">插件与同步</CardTitle>
          <Badge
            variant={installed && !stale ? "outline" : "default"}
            className={
              installed && !stale
                ? "text-2xs font-normal text-[var(--rx-fg-dim)]"
                : "text-2xs font-normal text-[var(--rx-accent)]"
            }
          >
            {!installed ? "未安装" : stale ? "版本过旧" : "已就绪"}
          </Badge>
        </div>
        <CardDescription className="text-xs text-[var(--rx-fg-dim)]">
          配套插件负责精确学习调度；Anki 内"工具 → 插件 → 从文件安装"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {statusError && (
          <Alert>
            <AlertTitle className="text-xs">{statusError}</AlertTitle>
            <AlertDescription className="text-2xs">
              请确认 Anki 已打开且插件已安装
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[var(--rx-fg-dim)]">运行中版本</span>
            <span className="font-medium">
              {installed ? addonVersion : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--rx-fg-dim)]">内置安装包版本</span>
            <span className="font-medium">{BUNDLED_ADDON_VERSION}</span>
          </div>
        </div>

        {stale && (
          <Alert>
            <AlertTitle className="flex items-center gap-1.5 text-xs">
              <PackageX className="h-3.5 w-3.5" aria-hidden />
              插件版本过旧
            </AlertTitle>
            <AlertDescription className="text-2xs">
              运行中 {addonVersion} ≠ 内置 {BUNDLED_ADDON_VERSION}。
              请重新安装最新安装包，避免功能缺失或数据不一致。
            </AlertDescription>
          </Alert>
        )}
        {installed && !stale && (
          <div className="flex items-center gap-1.5 text-2xs text-[var(--rx-fg-dim)]">
            <PackageCheck className="h-3.5 w-3.5" aria-hidden />
            插件版本与内置安装包一致
          </div>
        )}

        <Separator className="bg-[var(--rx-border-soft)]" />

        <div className="flex flex-col gap-2">
          {inTauri && packagePath && (
            <Button
              variant="outline"
              size="sm"
              className="rx-press w-full justify-start"
              onClick={() => void revealItemInDir(packagePath)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打开插件安装包所在目录
            </Button>
          )}
          <p className="text-2xs text-[var(--rx-fg-faint)]">
            安装步骤：打开上方的目录 → 在 Anki「工具 → 插件 → 从文件安装」
            选择 reasonix-anki-addon.ankiaddon → 重启 Anki
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
