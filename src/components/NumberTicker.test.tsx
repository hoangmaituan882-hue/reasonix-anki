import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NumberTicker } from "./NumberTicker";

describe("NumberTicker Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("正确渲染数字文本与无障碍 sr-only 标签", () => {
    render(<NumberTicker value={128} startOnView={false} prefix="¥" suffix="元" />);
    expect(screen.getByText("¥128元")).toBeInTheDocument();
  });

  it("支持 pad 补零与格式化", () => {
    render(<NumberTicker value={7} pad={3} startOnView={false} />);
    expect(screen.getByText("007")).toBeInTheDocument();
  });

  it("支持千分位格式化", () => {
    render(<NumberTicker value={25000} locale startOnView={false} />);
    expect(screen.getByText("25,000")).toBeInTheDocument();
  });
});
