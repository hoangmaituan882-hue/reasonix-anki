import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import { PluginSyncCard } from "./PluginSyncCard";
import { BUNDLED_ADDON_VERSION } from "../lib/reasonix-addon/bundledVersion";

function statusResponse(addonVersion: string | null) {
  return {
    result: {
      addonVersion,
      protocolVersion: 1,
      ankiVersion: "25.09.2",
      profileKey: "sha256:qa",
      profileName: "Default",
      collectionState: "open",
      syncState: "idle",
      capabilities: ["status", "session.start"],
      health: {
        serviceState: "listening",
        threadAlive: true,
        startedAt: 0,
        lastRequestAt: 0,
        lastHeartbeatAt: 0,
        requestCount: 0,
        failedRequestCount: 0,
        lastError: null,
        sync: {
          state: "idle",
          attempts: 0,
          requestedAt: null,
          startedAt: null,
          finishedAt: null,
          error: null,
        },
      },
    },
    error: null,
  };
}

describe("PluginSyncCard 插件版本一致性与安装引导", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // Tauri invoke 在 jsdom 中不可用 → inTauri=false，跳过路径查询
    vi.stubGlobal("__TAURI_INTERNALS__", undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("版本一致时显示已就绪，不提示安装", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => statusResponse(BUNDLED_ADDON_VERSION),
    });
    render(<PluginSyncCard />);
    expect(await screen.findByText("已就绪")).toBeInTheDocument();
    expect(screen.queryByText("版本过旧")).not.toBeInTheDocument();
  });

  it("版本过旧时提示重新安装", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => statusResponse("0.0.9"),
    });
    render(<PluginSyncCard />);
    expect(await screen.findByText("版本过旧")).toBeInTheDocument();
    expect(screen.getByText(/运行中 0\.0\.9/)).toBeInTheDocument();
    expect(screen.getByText(/内置安装包版本/)).toBeInTheDocument();
    expect(screen.getByText("0.1.1")).toBeInTheDocument();
  });

  it("插件未安装时显示未安装", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => statusResponse(null),
    });
    render(<PluginSyncCard />);
    expect(await screen.findByText("未安装")).toBeInTheDocument();
  });
});
