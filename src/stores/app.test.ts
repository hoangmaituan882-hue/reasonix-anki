import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore, viewTitle, type View } from "./app";
import { createMemoryStorage } from "../test/helpers";

describe("app views", () => {
  it("names the today view", () => {
    expect(viewTitle("today" as View)).toBe("今日学习");
  });

  it("names the settings view", () => {
    expect(viewTitle("settings" as View)).toBe("系统设置");
  });
});

describe("app settings state", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    useAppStore.setState({ roundedCorners: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to rounded corners enabled", () => {
    expect(useAppStore.getState().roundedCorners).toBe(true);
  });

  it("persists roundedCorners and exposes a setter", () => {
    useAppStore.getState().setRoundedCorners(false);
    expect(useAppStore.getState().roundedCorners).toBe(false);
    expect(localStorage.getItem("ra.roundedCorners")).toBe("false");
  });
});
