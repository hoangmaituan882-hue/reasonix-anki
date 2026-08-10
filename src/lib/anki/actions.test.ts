import { beforeEach, describe, expect, it, vi } from "vitest";
import { ankiCall } from "./transport";
import { anki } from "./actions";

vi.mock("./transport", () => ({
  ankiCall: vi.fn(),
}));

describe("AnkiConnect actions", () => {
  beforeEach(() => {
    vi.mocked(ankiCall).mockReset();
  });

  it("preserves the official requestPermission capability fields", async () => {
    vi.mocked(ankiCall).mockResolvedValue({
      permission: "granted",
      requireApiKey: true,
      version: 6,
    });

    const permission = await anki.requestPermission();

    expect(permission.requireApiKey).toBe(true);
    expect(permission.version).toBe(6);
  });
});
