import { describe, expect, it } from "vitest";
import type { CardInfo } from "../../lib/anki/schemas";
import { buildDeckTree, dueLabel, frontText } from "./browseUtil";

function card(overrides: Partial<CardInfo> = {}): CardInfo {
  return {
    cardId: 1,
    question: "<b>fallback</b>",
    answer: "answer",
    deckName: "Japanese",
    modelName: "Lapis",
    fields: {
      Expression: { value: "<b>人間</b>", order: 0 },
    },
    note: 2,
    type: 0,
    queue: 0,
    due: 0,
    ...overrides,
  };
}

describe("browseUtil characterization", () => {
  it("builds nested Anki deck names without duplicating shared parents", () => {
    expect(buildDeckTree(["Japanese::Mining", "Japanese::Core", "Other"])).toEqual([
      {
        name: "Japanese",
        fullName: "Japanese",
        children: [
          {
            name: "Core",
            fullName: "Japanese::Core",
            children: [],
          },
          {
            name: "Mining",
            fullName: "Japanese::Mining",
            children: [],
          },
        ],
      },
      {
        name: "Other",
        fullName: "Other",
        children: [],
      },
    ]);
  });

  it("uses the first ordered field as the front summary", () => {
    expect(
      frontText(
        card({
          fields: {
            Meaning: { value: "human", order: 1 },
            Expression: { value: "<ruby>人間<rt>にんげん</rt></ruby>", order: 0 },
          },
        }),
      ),
    ).toBe("人間にんげん");
  });

  it("keeps the current queue-to-label mapping", () => {
    expect(dueLabel(card({ queue: -1 }))).toBe("已暂停");
    expect(dueLabel(card({ queue: -2 }))).toBe("已埋没");
    expect(dueLabel(card({ type: 0, queue: 0 }))).toBe("新卡");
    expect(dueLabel(card({ type: 1, queue: 1 }))).toBe("学习中");
    expect(dueLabel(card({ type: 2, queue: 2 }))).toBe("复习");
  });
});
