import DOMPurify from "dompurify";
import { Skeleton } from "@reasonix/ui";
import { useEffect, useState } from "react";
import { isLocalMediaSrc, resolveMediaUrl } from "../../lib/media";

/**
 * CardRenderer（技术方案 §6）：
 * 1. 安全模式（默认）：DOMPurify 消毒 + iframe sandbox 无脚本
 * 2. 脚本模式（用户显式开启）：保留卡片脚本，等同 Anki 原生行为，
 *    用于 JS 驱动的重模板（如日语挖矿卡：图片/音频/辞典全由脚本装配）
 * 3. [sound:] 与 [anki:play:q/a:N] → <audio controls>
 * 4. img/audio/video 与 <style> 内 url()（字体等）本地媒体 → Blob URL
 * 5. 暗色时给 iframe body 挂 nightMode 类（兼容 Anki 模板的夜览样式）
 */

interface ProcessResult {
  html: string;
  hadScripts: boolean;
}

async function processHtml(
  html: string,
  fieldValues: string[],
  allowScripts: boolean,
): Promise<ProcessResult> {
  const hadScripts = /<script[\s>]/i.test(html);

  // 卡片字段里的全部 [sound:] 文件（按字段顺序），用于映射 [anki:play:X:N]
  const fieldSounds: string[] = [];
  for (const value of fieldValues) {
    for (const m of value.matchAll(/\[sound:([^\]]+)\]/g)) {
      fieldSounds.push(m[1].trim());
    }
  }

  // 收集需要解析的媒体文件名：声音 + 元素 src + <style> 里的 url()（字体/背景图）
  const names = new Set<string>(fieldSounds);
  for (const m of html.matchAll(/\[sound:([^\]]+)\]/g)) names.add(m[1].trim());
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const u of m[1].matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/g)) {
      const ref = u[1].trim();
      if (isLocalMediaSrc(ref)) names.add(decodeURIComponent(ref));
    }
  }
  const probe = new DOMParser().parseFromString(html, "text/html");
  probe.querySelectorAll("[src]").forEach((el) => {
    const src = el.getAttribute("src") ?? "";
    if (isLocalMediaSrc(src)) names.add(decodeURIComponent(src));
  });

  // 并行解析（单个失败不影响整体）
  const urlMap = new Map<string, string>();
  await Promise.all(
    [...names].map(async (name) => {
      const url = await resolveMediaUrl(name);
      if (url) urlMap.set(name, url);
    }),
  );

  const audioTag = (name: string) =>
    `<audio controls preload="metadata" src="${urlMap.get(name)}"></audio>`;

  // Anki 渲染后的音频标记 [anki:play:q:0] / [anki:play:a:1] → 按索引取字段声音
  // （近似映射：单音频卡精确；多音频卡按字段顺序对齐，覆盖绝大多数场景）
  let out = html.replace(/\[anki:play:[qa]:(\d+)\]/g, (_, idx: string) => {
    const file = fieldSounds.length === 1 ? fieldSounds[0] : fieldSounds[Number(idx)];
    return file && urlMap.has(file) ? audioTag(file) : `<span title="音频未找到">🔇</span>`;
  });

  // 裸 [sound:x]（字段直接内联的场景）
  out = out.replace(/\[sound:([^\]]+)\]/g, (_, name: string) => {
    const key = name.trim();
    return urlMap.has(key) ? audioTag(key) : `<span title="媒体未找到：${key}">🔇</span>`;
  });

  // DOM 内替换：src 属性与 <style> 里的 url()（走 DOM，避免正则误伤）
  const doc = new DOMParser().parseFromString(out, "text/html");
  doc.querySelectorAll("[src]").forEach((el) => {
    const raw = el.getAttribute("src") ?? "";
    if (!isLocalMediaSrc(raw)) return;
    const url = urlMap.get(decodeURIComponent(raw));
    if (url) el.setAttribute("src", url);
  });
  doc.querySelectorAll("style").forEach((st) => {
    st.textContent = (st.textContent ?? "").replace(
      /url\(\s*["']?([^"')]+?)["']?\s*\)/g,
      (full, ref: string) => {
        const url = urlMap.get(decodeURIComponent(ref.trim()));
        return url ? `url("${url}")` : full;
      },
    );
  });

  if (allowScripts) {
    // 信任模式：保留脚本（等同 Anki 原生），不做 DOMPurify 消毒
    return { html: doc.body.innerHTML, hadScripts };
  }
  // 安全模式收尾：剥 on* 事件属性 / javascript: URL / script（技术方案 §6 第 1 条）
  return { html: DOMPurify.sanitize(doc.body.innerHTML), hadScripts };
}

interface Props {
  html: string;
  css?: string;
  title?: string;
  /** 卡片字段原始值（按字段顺序）：解析 [anki:play:X:N] 音频标记用 */
  fieldValues?: string[];
  /** 脚本模式：允许执行卡片脚本（用户显式开启，等同 Anki 原生信任级别） */
  allowScripts?: boolean;
}

export function CardRenderer({
  html,
  css = "",
  title = "卡片内容",
  fieldValues = [],
  allowScripts = false,
}: Props) {
  const [result, setResult] = useState<ProcessResult | null>(null);

  useEffect(() => {
    let alive = true;
    setResult(null);
    processHtml(html, fieldValues, allowScripts).then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
    // fieldValues 随卡片切换整体替换，join 后比较即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, allowScripts, fieldValues.join("\u0000")]);

  if (result === null) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // iframe 与主页面样式隔离：手动带入主题前景/背景与字体
  const rootStyle = getComputedStyle(document.documentElement);
  const fg = rootStyle.getPropertyValue("--rx-fg").trim() || "#f1f1ef";
  const bg = rootStyle.getPropertyValue("--rx-bg").trim() || "#0c0d10";
  const font =
    rootStyle.getPropertyValue("--font-ui").trim() || "system-ui, sans-serif";
  const dark = document.documentElement.classList.contains("dark");

  // 注：模板 CSS 基本都在卡片内联 <style> 里（processHtml 已解析其 url()），
  // 此处注入的 card.css 保持原样
  // 脚本模式下转发按键到父窗口（焦点在卡片内时评分键不失效）
  const keyForward = allowScripts
    ? `<script>window.addEventListener('keydown',function(e){try{parent.postMessage({__reasonixKey:e.key},'*')}catch(_){}});<\/script>`
    : "";

  const srcDoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 16px; background: ${bg}; color: ${fg}; font-family: ${font}; font-size: 16px; line-height: 1.6; }
  img { max-width: 100%; height: auto; }
  audio, video { max-width: 100%; }
  ${css}
</style>
</head>
<body class="card ${dark ? "nightMode" : ""}">${result.html}${keyForward}</body>
</html>`;

  return (
    <div className="flex h-full flex-col">
      {!allowScripts && result.hadScripts && (
        <div
          className="shrink-0 px-3 py-1.5 text-2xs"
          style={{
            background: "color-mix(in srgb, var(--rx-warn) 14%, transparent)",
            color: "var(--rx-warn)",
          }}
        >
          该卡片包含脚本，安全模式下已禁用，内容可能不完整——可在顶部开启「脚本模式」完整渲染
        </div>
      )}
      <iframe
        title={title}
        sandbox={allowScripts ? "allow-scripts allow-same-origin" : "allow-same-origin"}
        className="min-h-0 w-full flex-1 border-0 bg-transparent"
        srcDoc={srcDoc}
      />
    </div>
  );
}
