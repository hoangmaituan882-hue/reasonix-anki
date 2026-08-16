/**
 * 学习轨迹工具纯函数测试（四档映射/间隔格式化/汇总/日期偏移）
 */
import { describe, expect, it } from "vitest";
import {
  cardChain,
  easeColor,
  easeLabel,
  emptySummary,
  formatDuration,
  formatIvl,
  formatTime,
  groupIntoSessions,
  shiftDate,
  summarizeDay,
  todayString,
  typeLabel,
  type TimelineEntry,
} from "./historyUtil";

function entry(partial: Partial<TimelineEntry>): TimelineEntry {
  return {
    reviewTime: Date.parse("2026-08-16T12:00:00+08:00"),
    cardId: 1,
    deckId: 0,
    ease: 3,
    ivl: 4,
    previousIvl: 1,
    duration: 8,
    type: 1,
    front: "人間",
    deckName: "Reasonix QA",
    ...partial,
  };
}

describe("ease 四档", () => {
  it("1-4 映射 Again/Hard/Good/Easy，其余归手动", () => {
    expect(easeLabel(1)).toBe("Again");
    expect(easeLabel(2)).toBe("Hard");
    expect(easeLabel(3)).toBe("Good");
    expect(easeLabel(4)).toBe("Easy");
    expect(easeLabel(0)).toBe("手动");
    expect(easeLabel(9)).toBe("手动");
  });

  it("颜色令牌对应 err/warn/ok/accent", () => {
    expect(easeColor(1)).toContain("--rx-err");
    expect(easeColor(2)).toContain("--rx-warn");
    expect(easeColor(3)).toContain("--rx-ok");
    expect(easeColor(4)).toContain("--rx-accent");
    expect(easeColor(0)).toContain("--rx-fg-dim");
  });
});

describe("格式", () => {
  it("间隔：0=10 分钟内 / <1 天=小时 / 否则天", () => {
    expect(formatIvl(0)).toBe("10 分钟内");
    expect(formatIvl(0.5)).toBe("12 小时");
    expect(formatIvl(4)).toBe("4 天");
  });

  it("耗时：秒 / 分秒", () => {
    expect(formatDuration(8)).toBe("8 秒");
    expect(formatDuration(62)).toBe("1 分 2 秒");
    expect(formatDuration(120)).toBe("2 分");
  });

  it("时间 HH:mm 本地时区", () => {
    const ms = Date.parse("2026-08-16T09:05:00+08:00");
    expect(formatTime(ms)).toMatch(/^\d{2}:\d{2}$/);
  });

  it("类型标签 0/1/2 → 学习/复习/重学", () => {
    expect(typeLabel(0)).toBe("学习");
    expect(typeLabel(1)).toBe("复习");
    expect(typeLabel(2)).toBe("重学");
    expect(typeLabel(5)).toBe("其他");
  });
});

describe("summarizeDay", () => {
  it("汇总总数/四档/耗时/类型构成", () => {
    const entries = [
      entry({ ease: 1, duration: 5, type: 0 }),
      entry({ ease: 2, duration: 6, type: 2, cardId: 2 }),
      entry({ ease: 3, duration: 8, type: 1, cardId: 3 }),
      entry({ ease: 4, duration: 10, type: 1, cardId: 4 }),
    ];
    const s = summarizeDay(entries);
    expect(s.total).toBe(4);
    expect(s.again).toBe(1);
    expect(s.hard).toBe(1);
    expect(s.good).toBe(1);
    expect(s.easy).toBe(1);
    expect(s.timeMs).toBe((5 + 6 + 8 + 10) * 1000);
    expect(s.learn).toBe(1);
    expect(s.review).toBe(2);
    expect(s.relearn).toBe(1);
  });

  it("空列表 → 全零", () => {
    expect(summarizeDay([])).toEqual(emptySummary());
  });

  it("质量指标：正确率 / 平均间隔涨幅 / 平均耗时", () => {
    const entries = [
      entry({ ease: 1, duration: 4, previousIvl: 1, ivl: 2 }), // Again
      entry({ ease: 3, duration: 8, previousIvl: 2, ivl: 6, cardId: 2 }), // Good
      entry({ ease: 4, duration: 12, previousIvl: 6, ivl: 30, cardId: 3 }), // Easy
    ];
    const s = summarizeDay(entries);
    expect(s.correctRate).toBeCloseTo(2 / 3, 5);
    expect(s.avgIvlGain).toBeCloseTo((2 / 1 + 6 / 2 + 30 / 6) / 3, 5); // (2+3+5)/3
    expect(s.avgDuration).toBeCloseTo(8, 5);
  });

  it("无 previousIvl 记录时不计算平均间隔涨幅", () => {
    const s = summarizeDay([entry({ previousIvl: null })]);
    expect(s.avgIvlGain).toBeNull();
  });
});

describe("groupIntoSessions 会话分组", () => {
  const base = Date.parse("2026-08-16T19:00:00+08:00");
  const mk = (msOffset: number, cardId: number): TimelineEntry =>
    entry({ reviewTime: base + msOffset, cardId });

  it("相邻记录 ≤20 分钟归同一会话，超时切新会话", () => {
    const entries = [mk(0, 1), mk(5 * 60 * 1000, 2), mk(30 * 60 * 1000, 3), mk(35 * 60 * 1000, 4)];
    const sessions = groupIntoSessions(entries);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].entries).toHaveLength(2);
    expect(sessions[0].endTime - sessions[0].startTime).toBe(5 * 60 * 1000);
    expect(sessions[1].entries).toHaveLength(2);
  });

  it("空列表 → 空会话数组", () => {
    expect(groupIntoSessions([])).toEqual([]);
  });

  it("单条 → 单会话", () => {
    expect(groupIntoSessions([mk(0, 1)])).toHaveLength(1);
  });
});

describe("cardChain 表现链", () => {
  it("按 cardId 过滤当天记录（保序）", () => {
    const entries = [
      entry({ cardId: 1, ease: 1 }),
      entry({ cardId: 2, ease: 3 }),
      entry({ cardId: 1, ease: 3, reviewTime: Date.parse("2026-08-16T12:10:00+08:00") }),
    ];
    const chain = cardChain(entries, 1);
    expect(chain).toHaveLength(2);
    expect(chain.map((e) => e.ease)).toEqual([1, 3]);
  });
});

describe("日期", () => {
  it("todayString 格式 YYYY-MM-DD", () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shiftDate 前后偏移（含月末/跨年）", () => {
    expect(shiftDate("2026-08-16", 1)).toBe("2026-08-17");
    expect(shiftDate("2026-08-16", -1)).toBe("2026-08-15");
    expect(shiftDate("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });
});
