import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { SettingsSheet } from "./SettingsSheet";
import { useAppStore } from "../stores/app";
import { createMemoryStorage } from "../test/helpers";

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
    expect(screen.getByRole("button", { name: "分栏式", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标签式", pressed: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "卡片式", pressed: false })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "圆角窗口" })).toBeChecked();
    // 已接入的外观组控件
    expect(screen.getByRole("combobox", { name: "主题方向" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "深色模式" })).toBeChecked();
    // 说明文字与控件关联（aria-describedby）
    expect(screen.getByText("无边框透明窗口的 CSS 圆角；关闭后四角变直角")).toHaveAttribute(
      "id",
      "settings-rounded-desc",
    );
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
    fireEvent.click(screen.getByRole("button", { name: "标签式" }));
    expect(useAppStore.getState().settingsDesign).toBe("tabs");
    expect(localStorage.getItem("ra.settingsDesign")).toBe('"tabs"');
    expect(screen.getByTestId("tabs-nav")).toBeInTheDocument();
    expect(screen.queryByTestId("columns-nav")).not.toBeInTheDocument();
    // 选中态跟随切换
    expect(screen.getByRole("button", { name: "标签式", pressed: true })).toBeInTheDocument();
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
