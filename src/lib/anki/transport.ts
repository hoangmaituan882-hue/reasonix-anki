/**
 * AnkiConnect 双通道 transport（技术方案 §2.1）
 * - Tauri 环境：invoke → Rust reqwest → 127.0.0.1:8765（生产路径）
 * - 浏览器环境：fetch /anki → Vite dev proxy → 127.0.0.1:8765（调试路径）
 * 两条通道返回同构 result，上层无感。
 */
import { invoke } from "@tauri-apps/api/core";

export const inTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface AnkiEnvelope<T> {
  result: T;
  error: string | null;
}

export async function ankiCall<T = unknown>(
  action: string,
  params: unknown = {},
): Promise<T> {
  if (inTauri) {
    return (await invoke("anki_request", { action, params })) as T;
  }

  let res: Response;
  try {
    res = await fetch("/anki", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params }),
    });
  } catch {
    throw new Error("无法连接 AnkiConnect（127.0.0.1:8765）");
  }
  if (!res.ok) {
    throw new Error(`无法连接 AnkiConnect（HTTP ${res.status}）`);
  }

  const body = (await res.json()) as AnkiEnvelope<T>;
  if (body.error) throw new Error(body.error);
  return body.result;
}
