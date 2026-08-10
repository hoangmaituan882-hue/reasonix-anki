import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  summarizeTodayDecks,
  TodayDashboard,
  type TodayDeckRow,
} from "./TodayView";

afterEach(cleanup);

const decks: TodayDeckRow[] = [
  {
    id: 42,
    name: "Japanese",
    newCount: 10,
    learningCount: 2,
    reviewCount: 35,
    totalCount: 500,
  },
  {
    id: 43,
    name: "Japanese::Mining",
    newCount: 0,
    learningCount: 0,
    reviewCount: 5,
    totalCount: 120,
  },
];

describe("TodayDashboard", () => {
  it("requires deck selection and exposes one native-scheduler start action", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onStart = vi.fn();
    const { rerender } = render(
      <TodayDashboard
        decks={decks}
        selectedDeckId={null}
        addonAvailable
        syncState="idle"
        starting={false}
        onSelect={onSelect}
        onStart={onStart}
      />,
    );

    expect(screen.getByRole("button", { name: "开始学习" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Japanese，/ }));
    expect(onSelect).toHaveBeenCalledWith(42);

    rerender(
      <TodayDashboard
        decks={decks}
        selectedDeckId={42}
        addonAvailable
        syncState="idle"
        starting={false}
        onSelect={onSelect}
        onStart={onStart}
      />,
    );
    await user.click(screen.getByRole("button", { name: "开始学习" }));

    expect(onStart).toHaveBeenCalledWith(42, "Japanese");
    expect(screen.queryByText(/只新卡|只旧卡|学习模式/)).not.toBeInTheDocument();
  });

  it("disables precise study when the companion is unavailable", () => {
    render(
      <TodayDashboard
        decks={decks}
        selectedDeckId={42}
        addonAvailable={false}
        syncState="unavailable"
        starting={false}
        onSelect={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "开始学习" })).toBeDisabled();
    expect(screen.getByText(/配套插件未就绪/)).toBeInTheDocument();
  });
});

describe("summarizeTodayDecks", () => {
  it("does not count child decks twice when parent stats include them", () => {
    expect(
      summarizeTodayDecks([
        { ...decks[0], newCount: 10, reviewCount: 35 },
        { ...decks[1], newCount: 4, reviewCount: 12 },
        {
          id: 44,
          name: "Core",
          newCount: 3,
          learningCount: 1,
          reviewCount: 7,
          totalCount: 80,
        },
      ]),
    ).toEqual({ newCount: 13, learningCount: 3, reviewCount: 42 });
  });
});
