import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DeckTree } from "./DeckTree";

vi.mock("../../stores/app", () => ({
  useAppStore: (fn: (s: unknown) => unknown) => fn({ setView: vi.fn() }),
}));
vi.mock("../../stores/editor", () => ({
  useEditorStore: (fn: (s: unknown) => unknown) => fn({ openNewNote: vi.fn() }),
}));
vi.mock("../../components/ToasterLite", () => ({
  toast: vi.fn(),
  toastError: vi.fn(),
}));

const decks = { 日语: 1, "日语::词汇": 2 };
const stats = { "1": { total_in_deck: 10, new_count: 3, learn_count: 1, review_count: 0 } as never };

describe("DeckTree 牌组树", () => {
  afterEach(() => cleanup());

  it("渲染牌组节点与统计徽章", () => {
    render(<DeckTree decks={decks} stats={stats} configs={{}} selected={null} onSelect={vi.fn()} />);
    expect(screen.getAllByText(/日语/).length).toBeGreaterThan(0);
    expect(screen.getByText("词汇")).toBeInTheDocument();
  });

  it("右键牌组弹出菜单", () => {
    render(<DeckTree decks={decks} stats={stats} configs={{}} selected={null} onSelect={vi.fn()} />);
    // 初始菜单不可见（aria-hidden）
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getAllByText("日语")[0]);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByText("开始复习此牌组").length).toBeGreaterThan(0);
    expect(screen.getAllByText("复制牌组名称").length).toBeGreaterThan(0);
  });
});
