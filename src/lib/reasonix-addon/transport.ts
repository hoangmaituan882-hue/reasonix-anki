import { invoke } from "@tauri-apps/api/core";
import type { AddonRequest } from "./schemas";

export const inTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface AddonErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

interface AddonEnvelope<T> {
  result: T | null;
  error: AddonErrorPayload | null;
}

export class ReasonixAddonError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;

  constructor(payload: AddonErrorPayload) {
    super(payload.message);
    this.name = "ReasonixAddonError";
    this.code = payload.code;
    this.retryable = payload.retryable;
    this.details = payload.details ?? {};
  }
}

function unwrap<T>(body: AddonEnvelope<T>): T {
  if (body.error) throw new ReasonixAddonError(body.error);
  return body.result as T;
}

export async function reasonixCall<T = unknown>(request: AddonRequest): Promise<T> {
  if (inTauri) {
    const body = (await invoke("reasonix_request", { request })) as AddonEnvelope<T>;
    return unwrap(body);
  }

  let response: Response;
  try {
    response = await fetch("/reasonix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error("无法连接 Reasonix Anki 插件（127.0.0.1:8766）");
  }
  if (!response.ok) {
    throw new Error(`Reasonix Anki 插件响应失败（HTTP ${response.status}）`);
  }
  let body: AddonEnvelope<T>;
  try {
    body = (await response.json()) as AddonEnvelope<T>;
  } catch {
    throw new Error("Reasonix Anki 插件响应解析失败");
  }
  return unwrap(body);
}
