import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DiagnosticsCard } from "./DiagnosticsCard";
import { BUNDLED_ADDON_VERSION } from "../lib/reasonix-addon/bundledVersion";

const ankiVersionMock = vi.hoisted(() => vi.fn());
const reasonixStatusMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/anki/actions", () => ({
  anki: { version: ankiVersionMock },
}));
vi.mock("../lib/reasonix-addon/client", () => ({
  reasonixStatus: reasonixStatusMock,
}));

function statusResult(overrides: Record<string, unknown> = {}) {
  return {
    addonVersion: BUNDLED_ADDON_VERSION,
    protocolVersion: 1,
    ankiVersion: "25.09.2",
    profileKey: "sha256:qa",
    profileName: "Default",
    collectionState: "open",
    syncState: "idle",
    capabilities: ["status", "session.start"],
    ...overrides,
  };
}

describe("DiagnosticsCard 连接诊断", () => {
  beforeEach(() => {
    ankiVersionMock.mockReset().mockResolvedValue(6);
    reasonixStatusMock.mockReset().mockResolvedValue(statusResult());
  });

  afterEach(() => {
    cleanup();
  });

  it("全部正常时显示正常状态与内置版本", async () => {
    render(<DiagnosticsCard />);
    expect(await screen.findByText("Anki 是否运行")).toBeInTheDocument();
    expect(await screen.findByText("可达")).toBeInTheDocument();
    // 版本匹配正常（v{version} 出现于匹配行与底部 Badge，至少一处）
    const versionTexts = await screen.findAllByText(`v${BUNDLED_ADDON_VERSION}`);
    expect(versionTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/内置插件版本/)).toBeInTheDocument();
  });

  it("Anki 不可达时显示异常", async () => {
    ankiVersionMock.mockRejectedValue(new Error("conn refused"));
    render(<DiagnosticsCard />);
    expect(await screen.findByText("不可达")).toBeInTheDocument();
    expect(await screen.findByText("AnkiConnect 不可达（127.0.0.1:8765）")).toBeInTheDocument();
  });

  it("插件版本不匹配时显示版本异常", async () => {
    reasonixStatusMock.mockResolvedValue(
      statusResult({ addonVersion: "0.0.9" }),
    );
    render(<DiagnosticsCard />);
    expect(
      await screen.findByText(`运行 v0.0.9 ≠ 内置 v${BUNDLED_ADDON_VERSION}`),
    ).toBeInTheDocument();
  });
});
