import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  AnimatedArrowRight,
  AnimatedBarChart3,
  AnimatedBookOpen,
  AnimatedBrain,
  AnimatedCalendarDays,
  AnimatedCheckCircle2,
  AnimatedClock,
  AnimatedCloudSun,
  AnimatedEye,
  AnimatedGraduationCap,
  AnimatedLibrary,
  AnimatedMoon,
  AnimatedRotateCw,
  AnimatedSettings,
  AnimatedSparkles,
  AnimatedSquarePen,
  AnimatedSun,
  AnimatedUndo2,
  AnimatedVolume2,
} from "../index";

describe("Animated Lucide Icons", () => {
  it("全部动画图标均能正常渲染 SVG 结构", () => {
    const { container } = render(
      <div>
        <AnimatedSettings data-testid="icon-settings" size={20} className="text-red-500" />
        <AnimatedCalendarDays data-testid="icon-calendar" />
        <AnimatedLibrary data-testid="icon-library" />
        <AnimatedSquarePen data-testid="icon-squarepen" />
        <AnimatedGraduationCap data-testid="icon-gradcap" />
        <AnimatedBarChart3 data-testid="icon-barchart" />
        <AnimatedSun data-testid="icon-sun" />
        <AnimatedMoon data-testid="icon-moon" />
        <AnimatedCloudSun data-testid="icon-cloudsun" />
        <AnimatedSparkles data-testid="icon-sparkles" />
        <AnimatedBrain data-testid="icon-brain" />
        <AnimatedBookOpen data-testid="icon-bookopen" />
        <AnimatedClock data-testid="icon-clock" />
        <AnimatedVolume2 data-testid="icon-volume2" />
        <AnimatedEye data-testid="icon-eye" />
        <AnimatedUndo2 data-testid="icon-undo2" />
        <AnimatedCheckCircle2 data-testid="icon-check" />
        <AnimatedArrowRight data-testid="icon-arrow" />
        <AnimatedRotateCw data-testid="icon-rotate" />
      </div>,
    );

    expect(screen.getByTestId("icon-settings")).toBeInTheDocument();
    expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("icon-volume2")).toBeInTheDocument();
    expect(container.querySelectorAll("svg").length).toBe(19);
  });

  it("响应鼠标悬停与移出事件", () => {
    render(<AnimatedSettings data-testid="interactive-settings" />);
    const svg = screen.getByTestId("interactive-settings");

    fireEvent.mouseEnter(svg);
    fireEvent.mouseLeave(svg);
    expect(svg).toBeInTheDocument();
  });
});
