/**
 * 能力协商辅助：检查插件状态是否支持某能力（含最低版本门槛）。
 *
 * 用法：
 *   hasCapability(status, "decks.today")                 // 仅存在性
 *   hasCapability(status, "decks.today", "0.1.1")        // 存在 + 版本门槛
 */
import type { StatusResponse } from "./schemas";

/** hasCapability 只依赖这两个字段（兼容精简 status 与完整 status） */
type CapabilityStatus = Pick<
  StatusResponse["result"],
  "capabilities" | "capabilityVersions"
>;

/** semver "x.y.z" → 数值（x*10000 + y*100 + z），用于比较；非法返回 -1 */
export function versionNumber(version: string | undefined | null): number {
  if (!version) return -1;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return -1;
  return (
    Number(match[1]) * 10000 +
    Number(match[2]) * 100 +
    Number(match[3])
  );
}

export function hasCapability(
  status: CapabilityStatus | null | undefined,
  name: string,
  minVersion?: string,
): boolean {
  if (!status || !status.capabilities.includes(name)) return false;
  if (minVersion === undefined) return true;
  const installed = status.capabilityVersions?.[name];
  if (!installed) return true; // 旧插件无版本元数据：按存在性放行
  const installedNum = versionNumber(installed);
  const requiredNum = versionNumber(minVersion);
  if (installedNum < 0 || requiredNum < 0) return false; // 非法版本，保守拒绝
  return installedNum >= requiredNum;
}
