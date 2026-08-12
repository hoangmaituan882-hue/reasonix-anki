import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SETTINGS_DESIGNS,
  useAppStore,
  viewTitle,
  type SettingsDesign,
  type View,
} from "./app";
import { createMemoryStorage } from "../test/helpers";

describe("app views", () => {
  it("names the new default today view", () => {
    expect(viewTitle("today" as View)).toBe("今日学习");
  });
});

describe("app settings state", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    useAppStore.setState({
      roundedCorners: true,
      settingsDesign: "columns",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to rounded corners enabled", () => {
    expect(useAppStore.getState().roundedCorners).toBe(true);
  });

  it("defaults to the columns settings design", () => {
    expect(useAppStore.getState().settingsDesign).toBe("columns");
  });

  it("persists roundedCorners and exposes a setter", () => {
    useAppStore.getState().setRoundedCorners(false);
    expect(useAppStore.getState().roundedCorners).toBe(false);
    expect(localStorage.getItem("ra.roundedCorners")).toBe("false");
  });

  it("persists settingsDesign and exposes a setter", () => {
    useAppStore.getState().setSettingsDesign("tabs");
    expect(useAppStore.getState().settingsDesign).toBe("tabs");
    expect(localStorage.getItem("ra.settingsDesign")).toBe('"tabs"');
  });

  it("exposes the three settings design variants", () => {
    expect(SETTINGS_DESIGNS.map((d) => d.id)).toEqual([
      "columns",
      "tabs",
      "cards",
    ]);
    useAppStore.getState().setSettingsDesign("cards" as SettingsDesign);
    expect(useAppStore.getState().settingsDesign).toBe("cards");
  });
});
