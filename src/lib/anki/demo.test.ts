/**
 * 演示模式 mock 数据测试：各 action 返回结构正确、可支撑全部视图渲染
 */
import { describe, expect, it } from "vitest";
import { demoCall, DEMO_DECKS, setDemoMode, isDemoMode } from "./demo";

describe("演示模式开关", () => {
  it("默认关闭，可切换", () => {
    expect(isDemoMode()).toBe(false);
    setDemoMode(true);
    expect(isDemoMode()).toBe(true);
    setDemoMode(false);
    expect(isDemoMode()).toBe(false);
  });
});

describe("演示数据", () => {
  it("牌组与统计结构正确（对象映射 + 额度口径）", () => {
    const decks = demoCall<Record<string, number>>("deckNamesAndIds", {});
    expect(decks["演示牌组::N5 词汇"]).toBe(2);
    const stats = demoCall<Record<string, { new_count: number }>>("getDeckStats", {
      decks: Object.keys(decks),
    });
    expect(stats["2"].new_count).toBe(12);
  });

  it("卡片查询：cardsInfo 返回完整卡（question/answer/fields）", () => {
    const cards = demoCall<{ cardId: number; question: string; answer: string }[]>("cardsInfo", {
      cards: [1001, 1002],
    });
    expect(cards).toHaveLength(2);
    expect(cards[0].question).toBe("人間");
    expect(cards[0].answer).toContain("にんげん");
  });

  it("统计：今日复习数与热力图序列", () => {
    const today = demoCall<number>("getNumCardsReviewedToday", {});
    expect(today).toBeGreaterThan(0);
    const byDay = demoCall<[string, number][]>("getNumCardsReviewedByDay", {});
    expect(byDay.length).toBeGreaterThan(50); // 近 26 周稀疏数据（约 40% 天有记录）
    expect(byDay[byDay.length - 1][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("时间线：仅演示牌组返回今天数据（避免遍历牌组重复）", () => {
    const rows = demoCall<number[][]>("cardReviews", {
      deck: "演示牌组::N5 词汇",
      startID: 0,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveLength(9); // 9 元组
    // 其他牌组返回空（降级路径遍历时去重）
    const other = demoCall<number[][]>("cardReviews", {
      deck: "演示牌组::日语入门",
      startID: 0,
    });
    expect(other).toEqual([]);
    // startID 在今天零点之后 → 空（增量语义）
    const late = demoCall<number[][]>("cardReviews", {
      deck: "演示牌组::N5 词汇",
      startID: Date.now(),
    });
    expect(late).toEqual([]);
  });

  it("写操作返回成功形状（answerCards boolean[] / suspend boolean[]）", () => {
    const ans = demoCall<boolean[]>("answerCards", { answers: [{ cardId: 1, ease: 3 }] });
    expect(ans).toEqual([true]);
    const susp = demoCall<boolean[]>("suspend", { cards: [1] });
    expect(susp).toEqual([true]);
  });

  it("未支持的 action 抛错", () => {
    expect(() => demoCall("guiBrowse", {})).toThrow(/演示模式暂不支持/);
  });
});

describe("演示牌组常量", () => {
  it("含系统默认与两个演示牌组", () => {
    expect(Object.keys(DEMO_DECKS)).toEqual(["系统默认", "演示牌组::日语入门", "演示牌组::N5 词汇"]);
  });
});
