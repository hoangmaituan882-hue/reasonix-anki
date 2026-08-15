import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MotionTabs,
  MotionTabsList,
  MotionTabsTrigger,
  MotionTabsContent,
} from "./MotionTabs";

describe("MotionTabs Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders correctly and switches tab content on click", () => {
    const onValueChange = vi.fn();

    render(
      <MotionTabs defaultValue="tab1" onValueChange={onValueChange} variant="pill">
        <MotionTabsList>
          <MotionTabsTrigger value="tab1">标签1</MotionTabsTrigger>
          <MotionTabsTrigger value="tab2">标签2</MotionTabsTrigger>
        </MotionTabsList>
        <MotionTabsContent value="tab1">内容1</MotionTabsContent>
        <MotionTabsContent value="tab2">内容2</MotionTabsContent>
      </MotionTabs>
    );

    expect(screen.getByText("标签1")).toBeInTheDocument();
    expect(screen.getByText("内容1")).toBeInTheDocument();
    expect(screen.getByText("内容2")).not.toBeVisible();

    fireEvent.click(screen.getByText("标签2"));
    expect(onValueChange).toHaveBeenCalledWith("tab2");
    expect(screen.getByText("内容2")).toBeInTheDocument();
  });

  it("supports underline and segment variants", () => {
    const { unmount } = render(
      <MotionTabs defaultValue="a" variant="underline">
        <MotionTabsList>
          <MotionTabsTrigger value="a">选项 A</MotionTabsTrigger>
          <MotionTabsTrigger value="b">选项 B</MotionTabsTrigger>
        </MotionTabsList>
      </MotionTabs>
    );

    expect(screen.getByRole("tablist")).toHaveClass("border-b");
    unmount();

    render(
      <MotionTabs defaultValue="a" variant="segment">
        <MotionTabsList>
          <MotionTabsTrigger value="a">选项 A</MotionTabsTrigger>
          <MotionTabsTrigger value="b">选项 B</MotionTabsTrigger>
        </MotionTabsList>
      </MotionTabs>
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
