import { beforeEach, describe, expect, it, vi } from "vitest";
import { processHtml } from "./CardRenderer";

const resolveMediaUrlMock = vi.hoisted(() => vi.fn());
const peekMediaUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/media", () => ({
  isLocalMediaSrc: (src: string) =>
    !/^(https?:|data:|blob:|anki:|file:)/i.test(src),
  resolveMediaUrl: resolveMediaUrlMock,
  peekMediaUrl: peekMediaUrlMock,
}));

describe("CardRenderer processHtml LRU 缓存", () => {
  beforeEach(() => {
    resolveMediaUrlMock.mockReset();
    resolveMediaUrlMock.mockImplementation(async (name: string) => `blob:${name}`);
    peekMediaUrlMock.mockReset();
    peekMediaUrlMock.mockImplementation((name: string) => `blob:${name}`); // 默认仍有效
  });

  it("同 html 二次调用命中缓存，不重复媒体解析", async () => {
    const html = '<div>声 [sound:kaigi.mp3]<img src="pic.jpg"></div>';
    const fields = ["声 [sound:kaigi.mp3]"];

    const first = await processHtml(html, fields, false);
    const second = await processHtml(html, fields, false);

    expect(second).toEqual(first);
    // 媒体解析只发生一次（LRU 命中跳过整个链路）
    expect(resolveMediaUrlMock).toHaveBeenCalledTimes(2); // kaigi.mp3 + pic.jpg
  });

  it("blob 被 media LRU 淘汰后缓存失效，翻回同一卡重新解析", async () => {
    const html = '<img src="pic.jpg">';
    await processHtml(html, [], false);
    expect(resolveMediaUrlMock).toHaveBeenCalledTimes(1);

    // 模拟 media LRU 淘汰并 revoke（peekMediaUrl 返回 null）
    peekMediaUrlMock.mockReturnValue(null);
    const reprocessed = await processHtml(html, [], false);

    // 缓存失效 → 重新解析媒体（resolveMediaUrl 再次被调用）
    expect(resolveMediaUrlMock).toHaveBeenCalledTimes(2);
    expect(reprocessed.html).toBeTypeOf("string");
  });

  it("不同 html 不命中缓存，各自解析", async () => {
    await processHtml("<div>a</div>", [], false);
    await processHtml("<div>b</div>", [], false);

    expect(resolveMediaUrlMock).toHaveBeenCalledTimes(0); // 无媒体
  });

  it("allowScripts 模式差异不共享缓存", async () => {
    const html = "<div>x</div>";
    await processHtml(html, [], false);
    await processHtml(html, [], true);

    expect(resolveMediaUrlMock).toHaveBeenCalledTimes(0); // 无媒体，但两模式各自处理
  });

  it("安全模式保留 blob: 媒体 src（hook 注册），剥 on* 事件与 javascript: URL", async () => {
    const html =
      '<div><img src="pic.jpg" onerror="alert(1)"><audio src="kaigi.mp3"></audio><a href="javascript:alert(1)">x</a></div>';
    const { html: out } = await processHtml(html, [], false);

    // blob: object URL（resolveMediaUrl 产物）不被 DOMPurify 剥掉
    expect(out).toContain('src="blob:pic.jpg"');
    expect(out).toContain('src="blob:kaigi.mp3"');
    // 默认消毒规则仍然生效
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("javascript:");
  });

  it("blob: 钩子不放行 on* 事件属性（onerror='blob:...' 是合法 JS label 语句，不得保留）", async () => {
    const html = '<img src="pic.jpg" onerror="blob:alert(1)"><video srcdoc="blob:alert(1)"></video>';
    const { html: out } = await processHtml(html, [], false);

    // 媒体 blob: src 保留（钩子目标），但事件属性/srcdoc 必须被剥
    expect(out).toContain('src="blob:pic.jpg"');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("srcdoc");
  });
});
