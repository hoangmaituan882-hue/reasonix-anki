import "@testing-library/jest-dom/vitest";

// jsdom 未实现 Element.scrollIntoView（Radix Select 打开时依赖它）；
// node 环境（如 viteConfig.test.ts）没有 Element，需守卫
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom 未实现 IntersectionObserver（Framer Motion useInView 依赖它）
if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  class MockIntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;
  (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;
}
