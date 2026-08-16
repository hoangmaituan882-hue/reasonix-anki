export { cn } from "@reasonix/ui";

/** localStorage 安全写入：隐私模式/配额满时不抛异常中断用户操作 */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`localStorage 写入失败（${key}）:`, e);
  }
}
