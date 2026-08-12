import { describe, expect, it, vi } from "vitest";
import { checkCleanWorkspace } from "./release.mjs";

describe("release.mjs checkCleanWorkspace", () => {
  it("工作区干净时通过", () => {
    const exec = vi.fn().mockReturnValue("");
    expect(() => checkCleanWorkspace(undefined, exec)).not.toThrow();
  });

  it("有未提交改动时中止并列出改动", () => {
    const exec = vi.fn().mockReturnValue(" M src/App.tsx\n");
    expect(() => checkCleanWorkspace(undefined, exec)).toThrow(
      /工作区有未提交改动/,
    );
  });

  it("非 git 环境报友好错误", () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error("Command failed: git status");
    });
    expect(() => checkCleanWorkspace(undefined, exec)).toThrow(
      /需在 git 仓库中发布/,
    );
  });
});
