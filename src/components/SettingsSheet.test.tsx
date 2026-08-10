import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { SettingsSheet } from "./SettingsSheet";
import { useAppStore } from "../stores/app";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  } as Storage;
}

function setup(open = true) {
  const onOpenChange = vi.fn();
  const view = render(<SettingsSheet open={open} onOpenChange={onOpenChange} />);
  return { onOpenChange, view };
}

describe("SettingsSheet", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    useAppStore.setState({
      roundedCorners: true,
      settingsDesign: "columns",
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the title, design picker and rounded-corner switch", () => {
    setup();
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "分栏式" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "标签式" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "卡片式" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "圆角窗口" })).toBeChecked();
    // 已接入的外观组控件
    expect(screen.getByRole("combobox", { name: "主题方向" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "深色模式" })).toBeChecked();
  });

  it("changes the theme direction via the appearance select", () => {
    setup();
    // 模拟打开 Select 并选择"琥珀"
    fireEvent.click(screen.getByRole("combobox", { name: "主题方向" }));
    const option = screen.getByRole("option", { name: "琥珀" });
    fireEvent.click(option);
    expect(useAppStore.getState().direction).toBe("amber");
    expect(localStorage.getItem("ra.direction")).toBe('"amber"');
  });

  it("toggles dark mode via the appearance switch", () => {
    setup();
    expect(useAppStore.getState().dark).toBe(true);
    fireEvent.click(screen.getByRole("switch", { name: "深色模式" }));
    expect(useAppStore.getState().dark).toBe(false);
    expect(localStorage.getItem("ra.dark")).toBe("false");
  });

  it("switches layout variant and persists the choice", () => {
    setup();
    expect(screen.getByTestId("columns-nav")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "标签式" }));
    expect(useAppStore.getState().settingsDesign).toBe("tabs");
    expect(localStorage.getItem("ra.settingsDesign")).toBe('"tabs"');
    expect(screen.getByTestId("tabs-nav")).toBeInTheDocument();
    expect(screen.queryByTestId("columns-nav")).not.toBeInTheDocument();
  });

  it("toggles rounded corners off and persists it", () => {
    setup();
    fireEvent.click(screen.getByRole("switch", { name: "圆角窗口" }));
    expect(useAppStore.getState().roundedCorners).toBe(false);
    expect(localStorage.getItem("ra.roundedCorners")).toBe("false");
  });

  it("calls onOpenChange when closed via the close button", () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
