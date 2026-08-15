import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ContextMenu";

describe("ContextMenu 右键菜单", () => {
  afterEach(() => cleanup());

  it("右键触发打开菜单并可选菜单项", () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger>
          <button type="button">目标</button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>操作</ContextMenuLabel>
          <ContextMenuItem onSelect={onSelect}>编辑</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem tone="destructive">删除</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    // 初始菜单不显示
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // 右键触发
    fireEvent.contextMenu(screen.getByRole("button", { name: "目标" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("操作")).toBeInTheDocument();
    expect(screen.getByText("编辑")).toBeInTheDocument();
    expect(screen.getByText("删除")).toBeInTheDocument();

    // 点击菜单项触发 onSelect 并关闭
    fireEvent.click(screen.getByText("编辑"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Escape 关闭菜单", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>
          <button type="button">目标</button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>编辑</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "目标" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
