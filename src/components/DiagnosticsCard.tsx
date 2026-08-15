import { useEffect, useState } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@reasonix/ui";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { anki } from "../lib/anki/actions";
import { reasonixStatus } from "../lib/reasonix-addon/client";
import { versionNumber } from "../lib/reasonix-addon/capabilities";
import { BUNDLED_ADDON_VERSION } from "../lib/reasonix-addon/bundledVersion";

type CheckState = "checking" | "ok" | "fail";

function CheckRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: CheckState;
  detail?: string;
}) {
  const icon =
    state === "checking" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
    ) : state === "ok" ? (
      <CircleCheck className="h-3.5 w-3.5 text-[var(--rx-accent)]" />
    ) : (
      <CircleX className="h-3.5 w-3.5 text-[var(--rx-danger)]" />
    );
  const color =
    state === "ok"
      ? "text-[var(--rx-accent)]"
      : state === "fail"
        ? "text-[var(--rx-danger)]"
        : "text-[var(--rx-fg-dim)]";
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 py-1.5 text-body-sm"
    >
      <span className="flex items-center gap-2 text-[var(--rx-fg-dim)]">
        {icon}
        {label}
      </span>
      <span className={color}>{detail ?? (state === "ok" ? "正常" : state === "fail" ? "异常" : "检查中")}</span>
    </div>
  );
}

/**
 * 诊断页（P8）：逐项显示 Anki / 插件 / Profile 连接健康状态。
 * 用户自助排查"为什么连不上/为什么不能精确学习"。
 */
export function DiagnosticsCard() {
  const [ankiState, setAnkiState] = useState<CheckState>("checking");
  const [addonState, setAddonState] = useState<CheckState>("checking");
  const [addonVersion, setAddonVersion] = useState<string | null>(null);
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const [collectionState, setCollectionState] = useState<string | null>(null);
  const [ankiError, setAnkiError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      // AnkiConnect 可达性
      try {
        await anki.version();
        if (!disposed) setAnkiState("ok");
      } catch {
        if (!disposed) {
          setAnkiState("fail");
          setAnkiError("AnkiConnect 不可达（127.0.0.1:8765）");
        }
      }
      // 插件状态
      try {
        const status = await reasonixStatus(crypto.randomUUID());
        if (!disposed) {
          setAddonState("ok");
          setAddonVersion(status.addonVersion ?? null);
          setProfileKey(status.profileKey ?? null);
          setCollectionState(status.collectionState);
        }
      } catch {
        if (!disposed) setAddonState("fail");
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const versionMatch =
    addonVersion !== null && addonVersion === BUNDLED_ADDON_VERSION;
  // 区分方向：运行 < 内置（插件过旧需重装）vs 运行 > 内置（应用较旧需升级）
  const addonOlder =
    addonVersion !== null &&
    versionNumber(addonVersion) >= 0 &&
    versionNumber(addonVersion) < versionNumber(BUNDLED_ADDON_VERSION);

  return (
    <Card className="border-[var(--rx-border-soft)] bg-[var(--rx-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-body-nm font-bold">连接诊断</CardTitle>
        <CardDescription className="text-body-sm text-[var(--rx-fg-dim)]">
          逐项检查 Anki 与配套插件状态，用于排查连接问题
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <CheckRow label="Anki 是否运行" state={ankiState} detail={ankiError ?? undefined} />
        <CheckRow
          label="AnkiConnect（:8765）"
          state={ankiState}
          detail={ankiState === "ok" ? "可达" : "不可达"}
        />
        <CheckRow
          label="配套插件（:8766）"
          state={addonState}
          detail={addonState === "ok" ? `v${addonVersion ?? "?"}` : "未连接"}
        />
        <CheckRow
          label="插件版本匹配"
          state={addonVersion === null ? "checking" : versionMatch ? "ok" : "fail"}
          detail={
            addonVersion === null
              ? undefined
              : versionMatch
                ? `v${addonVersion}`
                : addonOlder
                  ? `插件过旧 v${addonVersion}（内置 v${BUNDLED_ADDON_VERSION}，请重装）`
                  : `应用较旧（内置 v${BUNDLED_ADDON_VERSION} < 运行 v${addonVersion}，请升级应用）`
          }
        />
        <CheckRow
          label="Profile 状态"
          state={collectionState === "open" ? "ok" : addonState === "ok" ? "fail" : "checking"}
          detail={
            addonState !== "ok"
              ? "未知（插件未连接）"
              : collectionState === "open" && profileKey
                ? profileKey.slice(0, 12)
                : (collectionState ?? undefined)
          }
        />
        <div className="flex items-center justify-between pt-2">
          <span className="text-caption-xs text-[var(--rx-fg-faint)]">内置插件版本</span>
          <Badge variant="outline" className="text-badge-xs font-normal text-[var(--rx-fg-dim)]">
            v{BUNDLED_ADDON_VERSION}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
