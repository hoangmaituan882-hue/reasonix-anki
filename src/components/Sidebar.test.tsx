import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "../stores/app";
import { createMemoryStorage } from "../test/helpers";

describe("Sidebar 悬浮卡与收缩", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    useAppStore.setState({ sidebarCollapsed: false });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("渲染品牌卡与功能卡导航", () => {
    render(<Sidebar />);
    expect(screen.getByText("Reasonix Anki")).toBeInTheDocument();
    expect(screen.getByText("日语学习工作台 · v0.2")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "主导航" }),
    ).toBeInTheDocument();
  });

  it("点击收起按钮切换收缩态并持久化", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    expect(localStorage.getItem("ra.sidebarCollapsed")).toBe("true");
    // 收缩态按钮变为展开语义，aria-expanded 跟随
    expect(
      screen.getByRole("button", { name: "展开侧边栏" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("收缩态文字隐藏（aria-hidden），图标按钮以 aria-label 补语义", () => {
    useAppStore.setState({ sidebarCollapsed: true });
    render(<Sidebar />);
    // 品牌卡文字包装层被 aria-hidden（淡出后对读屏隐藏）
    expect(screen.getByText("Reasonix Anki").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    // 导航按钮以 aria-label 补可访问名
    expect(
      screen.getByRole("button", { name: "今日学习" }),
    ).toHaveAttribute("aria-label", "今日学习");
  });

  it("再次点击展开恢复文字可见语义", () => {
    useAppStore.setState({ sidebarCollapsed: true });
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "展开侧边栏" }));
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    // 展开态品牌文字 aria-hidden 为 false（可见）
    expect(
      screen.getByText("Reasonix Anki").parentElement,
    ).toHaveAttribute("aria-hidden", "false");
    // 展开态导航按钮无 aria-label（文字即名称）
    expect(
      screen.getByRole("button", { name: "今日学习" }),
    ).not.toHaveAttribute("aria-label");
  });
});
