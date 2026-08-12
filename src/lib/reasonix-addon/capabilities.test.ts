import { describe, expect, it } from "vitest";
import { hasCapability, versionNumber } from "./capabilities";
import type { StatusResponse } from "./schemas";

function makeStatus(overrides: Partial<StatusResponse["result"]> = {}): StatusResponse["result"] {
  return {
    addonVersion: "0.1.2",
    protocolVersion: 1,
    ankiVersion: "25.09.2",
    profileKey: "sha256:qa",
    profileName: "Default",
    collectionState: "open",
    syncState: "idle",
    capabilities: ["status", "session.start", "decks.today"],
    capabilityVersions: {
      "session.start": "0.1.0",
      "decks.today": "0.1.1",
    },
    ...overrides,
  };
}

describe("versionNumber", () => {
  it("解析 semver 并支持比较", () => {
    expect(versionNumber("0.1.0")).toBeLessThan(versionNumber("0.1.1"));
    expect(versionNumber("0.1.1")).toBeLessThan(versionNumber("0.2.0"));
    expect(versionNumber("0.9.9")).toBeLessThan(versionNumber("1.0.0"));
  });

  it("拒绝非法版本", () => {
    expect(versionNumber("v0.1.2")).toBe(-1);
    expect(versionNumber("0.1")).toBe(-1);
    expect(versionNumber(undefined)).toBe(-1);
    expect(versionNumber(null)).toBe(-1);
    expect(versionNumber("")).toBe(-1);
  });
});

describe("hasCapability", () => {
  it("能力存在且版本满足 → true", () => {
    const status = makeStatus();
    expect(hasCapability(status, "decks.today", "0.1.1")).toBe(true);
    expect(hasCapability(status, "decks.today", "0.1.0")).toBe(true);
    expect(hasCapability(status, "session.start")).toBe(true);
  });

  it("版本不满足 → false", () => {
    const status = makeStatus();
    expect(hasCapability(status, "decks.today", "0.1.2")).toBe(false);
  });

  it("能力缺失 → false", () => {
    const status = makeStatus();
    expect(hasCapability(status, "session.undo")).toBe(false);
  });

  it("旧插件无 capabilityVersions → 按存在性放行", () => {
    const status = makeStatus({ capabilityVersions: undefined });
    expect(hasCapability(status, "decks.today", "0.1.1")).toBe(true);
  });

  it("null status → false", () => {
    expect(hasCapability(null, "session.start")).toBe(false);
    expect(hasCapability(undefined, "session.start")).toBe(false);
  });
});
