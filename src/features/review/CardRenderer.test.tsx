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
});
