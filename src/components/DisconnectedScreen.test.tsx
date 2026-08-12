import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DisconnectedScreen } from "./DisconnectedScreen";

describe("DisconnectedScreen 首次连接引导", () => {
  afterEach(() => cleanup());

  it("渲染 AnkiConnect 与配套插件两步安装引导 + 重试按钮", () => {
    const onRetry = vi.fn();
    render(<DisconnectedScreen onRetry={onRetry} />);

    expect(screen.getByText("未检测到 Anki")).toBeInTheDocument();
    expect(screen.getByText(/启动 Anki 桌面端/)).toBeInTheDocument();
    expect(screen.getByText("2055492159")).toBeInTheDocument(); // AnkiConnect 代码
    expect(
      screen.getByText(/reasonix-anki-addon\.ankiaddon/),
    ).toBeInTheDocument(); // 配套插件
    expect(screen.getByRole("button", { name: /立即重试/ })).toBeInTheDocument();
  });

  it("显示最近错误信息", () => {
    render(<DisconnectedScreen onRetry={() => undefined} error="连接超时" />);
    expect(screen.getByText(/最近错误：连接超时/)).toBeInTheDocument();
  });

  it("点击重试触发回调", () => {
    const onRetry = vi.fn();
    render(<DisconnectedScreen onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /立即重试/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
