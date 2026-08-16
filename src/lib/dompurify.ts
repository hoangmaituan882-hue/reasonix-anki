/**
 * DOMPurify 共享实例与全局安全钩子（卡片 HTML 消毒统一入口）。
 *
 * 背景：`resolveMediaUrl` 生成的媒体 URL 是 `blob:` object URL（仅页面自身
 * `createObjectURL` 可创建，注入方无法伪造指向任意内容的 blob:），而 DOMPurify
 * 默认 URI 白名单不含 blob: —— `sanitize` 会把 `<img src="blob:...">` /
 * `<audio src="blob:...">` 的 src 整个剥掉，导致卡片媒体静默不显示/不播放。
 *
 * 解决：注册 `uponSanitizeAttribute` 钩子，**仅对媒体元素的 URI 属性**
 * （img/audio/video/source/track 的 src/poster）放行 blob: 前缀值。
 * 放行面必须收窄：forceKeepAttr 在 DOMPurify 的属性名白名单与 URI 校验
 * **之前**执行（purify.es.mjs _sanitizeAttributes：hook → forceKeepAttr
 * continue → _isValidAttribute），若按"值以 blob: 开头"放行任意属性，
 * `onerror="blob:alert(1)"`（合法 JS label 语句）会原样保留并在主文档执行
 * （伴学面板 dangerouslySetInnerHTML 无沙箱）——即 XSS。此白名单天然排除
 * on* 事件属性、srcdoc、href 等非 URI 媒体属性。
 *
 * 注意：钩子必须在此单例模块注册（被 mock 的 lib/media 等模块不可承载，
 * 否则测试环境与生产行为分叉）；两个渲染器（CardRenderer / 伴学面板）
 * 统一从此模块取 DOMPurify，保证一处注册、全局生效。
 */
import DOMPurify from "dompurify";

/** 允许保留 blob: 值的目标元素（媒体元素，其 src 指向 object URL 无脚本面） */
const MEDIA_TAGS = new Set(["img", "audio", "video", "source", "track"]);
/** 仅 URI 属性放行；on* 事件、srcdoc、href 等一律走默认规则 */
const URI_ATTRS = new Set(["src", "poster"]);

DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  if (
    node?.nodeName &&
    MEDIA_TAGS.has(node.nodeName.toLowerCase()) &&
    URI_ATTRS.has(data.attrName) &&
    typeof data.attrValue === "string" &&
    data.attrValue.startsWith("blob:")
  ) {
    data.forceKeepAttr = true;
  }
});

export { DOMPurify };
