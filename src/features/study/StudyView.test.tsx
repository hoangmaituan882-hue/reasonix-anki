import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import sessionNextFixture from "../../../protocol/fixtures/v1/session-next.response.json";
import { parseSessionNextResponse } from "../../lib/reasonix-addon/schemas";
import { toJapaneseWordRecord } from "../vocabulary/lapisAdapter";
import { StudyCardStage, StudyReportSummary } from "./StudyView";

afterEach(cleanup);

const card = parseSessionNextResponse(sessionNextFixture).result.card;
const word = toJapaneseWordRecord(card);
if (!word) throw new Error("Lapis fixture must adapt");

const intervals = {
  "1": { label: "<1分" },
  "2": { label: "<6分" },
  "3": { label: "<10分" },
  "4": { label: "5天" },
};

const baseProps = {
  word,
  remaining: { new: 10, learning: 2, review: 35 },
  canUndo: false,
  onReveal: vi.fn(),
  onAnswer: vi.fn(),
  onUndo: vi.fn(),
  onReplay: vi.fn(),
  onFinish: vi.fn(),
};

describe("StudyCardStage", () => {
  it("keeps four ratings visible on the front without leaking the answer", () => {
    render(
      <StudyCardStage
        {...baseProps}
        phase="front"
        intervals={null}
      />,
    );

    expect(screen.getByText("人間")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /显示答案/ })).toBeEnabled();
    for (const label of ["忘记", "困难", "良好", "简单"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeDisabled();
    }
    expect(screen.queryByText("人类；人。")).not.toBeInTheDocument();
  });

  it("prioritizes the core definition and submits an Anki rating on the back", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(
      <StudyCardStage
        {...baseProps}
        phase="back"
        intervals={intervals}
        onAnswer={onAnswer}
      />,
    );

    expect(screen.getByText("人类；人。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /良好.*<10分/ })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /良好.*<10分/ }));
    expect(onAnswer).toHaveBeenCalledWith(3);
  });
});

describe("StudyReportSummary", () => {
  it("shows native report metrics and sync status", () => {
    render(
      <StudyReportSummary
        answeredCards={4}
        syncState="syncing"
        onReset={vi.fn()}
        report={{
          sessionId: "session-a",
          answeredCards: 4,
          durationMs: 120000,
          averageMs: 30000,
          ratings: { "1": 1, "2": 0, "3": 2, "4": 1 },
          forgottenRate: 0.25,
          weakCardIds: [1782031602405],
          tomorrowDue: 9,
        }}
      />,
    );

    expect(screen.getByText("本轮学习完成")).toBeInTheDocument();
    expect(screen.getByText("2 分 0 秒")).toBeInTheDocument();
    expect(screen.getByText("正在与 Anki 自动同步")).toBeInTheDocument();
    expect(screen.getByText("#1782031602405")).toBeInTheDocument();
  });
});
