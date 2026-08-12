import { describe, expect, it } from "vitest";
import { bumpPatch, parseVersion } from "../scripts/addon-sync.mjs";

describe("addon-sync 版本自动递增", () => {
  it("解析合法 semver", () => {
    expect(parseVersion("0.1.2")).toEqual({ major: 0, minor: 1, patch: 2 });
    expect(parseVersion("1.0.0")).toEqual({ major: 1, minor: 0, patch: 0 });
  });

  it("拒绝非法版本（不 bump，保守）", () => {
    expect(parseVersion("v0.1.2")).toBeNull();
    expect(parseVersion("0.1")).toBeNull();
    expect(parseVersion("")).toBeNull();
    expect(parseVersion(null)).toBeNull();
    expect(bumpPatch("v0.1.2")).toBeNull();
    expect(bumpPatch("0.1")).toBeNull();
  });

  it("patch 位递增", () => {
    expect(bumpPatch("0.1.2")).toBe("0.1.3");
    expect(bumpPatch("1.9.9")).toBe("1.9.10");
    expect(bumpPatch("0.0.0")).toBe("0.0.1");
  });
});
