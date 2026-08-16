/**
 * 学习轨迹工具纯函数测试（四档映射/间隔格式化/汇总/日期偏移）
 */
import { describe, expect, it } from "vitest";
import {
  easeColor,
  easeLabel,
  emptySummary,
  formatDuration,
  formatIvl,
  formatTime,
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
