import "@testing-library/jest-dom/vitest";

// jsdom 未实现 Element.scrollIntoView（Radix Select 打开时依赖它）；
// node 环境（如 viteConfig.test.ts）没有 Element，需守卫
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
