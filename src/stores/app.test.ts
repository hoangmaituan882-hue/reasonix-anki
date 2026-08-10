import { describe, expect, it } from "vitest";
import { viewTitle, type View } from "./app";

describe("app views", () => {
  it("names the new default today view", () => {
    expect(viewTitle("today" as View)).toBe("今日学习");
  });
});
