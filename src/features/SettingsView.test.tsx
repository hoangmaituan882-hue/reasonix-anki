import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SettingsView } from "./SettingsView";

const ankiVersionMock = vi.hoisted(() => vi.fn());
const ankiSyncMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/anki/actions", () => ({
  anki: {
    version: ankiVersionMock,
    sync: ankiSyncMock,
    requestPermission: vi.fn(),
  },
}));
vi.mock("../lib/anki/useConnection", () => ({
  useAnkiConnection: () => ({
    status: "connected",
    version: 6,
  }),
}));
vi.mock("../lib/anki/transport", () => ({
  inTauri: false,
}));
vi.mock("../lib/window", () => ({
  openSettingsWindow: vi.fn(),
}));

describe("SettingsView 设置页", () => {
  afterEach(() => cleanup());

  it("渲染设置页（标题 + 主布局）", () => {
    render(<SettingsView />);
    expect(screen.getByRole("heading", { name: "系统设置" })).toBeInTheDocument();
    expect(document.querySelector(".max-w-5xl")).not.toBeNull();
  });
});
