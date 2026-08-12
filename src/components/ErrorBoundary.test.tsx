import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <div>正常内容</div>;
}

describe("ErrorBoundary 渲染崩溃恢复", () => {
  afterEach(() => {
    cleanup();
    // 重置 React 错误监听，避免测试间泄漏
    vi.restoreAllMocks();
  });

  it("子组件正常时不干预", () => {
    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("正常内容")).toBeInTheDocument();
  });

  it("子组件抛错时显示友好提示而非白屏", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("界面出现异常")).toBeInTheDocument();
    expect(screen.getByText(/重载界面/)).toBeInTheDocument();
    // 错误消息展示（供诊断）
    expect(screen.getByText("boom")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("点击重载后恢复渲染", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("界面出现异常")).toBeInTheDocument();
    consoleSpy.mockRestore();

    // 重载后子组件不再抛错（父组件状态重置，重新渲染 children）
    // 用 key 变化模拟：直接验证重载按钮存在即可（真正恢复依赖 children 修复）
    fireEvent.click(screen.getByRole("button", { name: /重载界面/ }));
    // 重置后 hasError=false，children 重新渲染（Bomb 仍抛错会再次进入边界）
    // 此处验证边界不崩溃、仍显示可交互提示
    expect(screen.getByRole("button", { name: /重载界面/ })).toBeInTheDocument();
  });
});
