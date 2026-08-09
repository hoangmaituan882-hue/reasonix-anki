/**
 * 媒体解析管线（技术方案 §6.3 两档策略）
 * 首选：Tauri `read_media_file`（Rust std::fs 直读媒体目录，零中转）
 * 兜底：AnkiConnect `retrieveMediaFile`（base64 往返）
 * 结果转 Blob URL 并做简易 LRU 缓存。
 */
import { invoke } from "@tauri-apps/api/core";
import { anki } from "./anki/actions";
import { inTauri } from "./anki/transport";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

function mimeOf(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

const cache = new Map<string, string>();
const MAX_CACHE = 120;

function remember(filename: string, url: string): string {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      URL.revokeObjectURL(cache.get(oldest) as string);
      cache.delete(oldest);
    }
  }
  cache.set(filename, url);
  return url;
}

/** 解析媒体文件名为 Blob URL；失败返回 null（渲染侧保留占位） */
export async function resolveMediaUrl(filename: string): Promise<string | null> {
  const hit = cache.get(filename);
  if (hit) return hit;

  let base64: string | null = null;

  if (inTauri) {
    try {
      base64 = await invoke<string>("read_media_file", { filename });
    } catch {
      base64 = null; // 落到 AnkiConnect 兜底通道
    }
  }

  if (!base64) {
    try {
      base64 = await anki.retrieveMediaFile(filename);
    } catch {
      return null;
    }
  }
  if (!base64) return null;

  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: mimeOf(filename) }),
    );
    return remember(filename, url);
  } catch {
    return null;
  }
}

/** src 是否指向本地媒体（排除 http/data/blob 等外链） */
export function isLocalMediaSrc(src: string): boolean {
  if (!src) return false;
  return !/^(https?:|data:|blob:|anki:|file:)/i.test(src);
}
