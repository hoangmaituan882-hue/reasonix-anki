#!/usr/bin/env node
/**
 * addon:sync —— 插件安装包自托管同步 + 版本自动递增（Artifact Sync-on-Change）
 *
 * 每次修改插件后执行，保证：
 * 1. 检测 reasonix-addon/ 源码是否有 git 未提交变更；有则自动递增
 *    manifest.json human_version 的 patch 位（真·自动，幂等防重复）
 * 2. 重新打包 .ankiaddon（单一版本真源 manifest.json human_version，
 *    打包脚本内部自检包内 manifest 与真源一致）
 * 3. 复制到 src-tauri/resources/（随 Tauri bundle.resources 分发）
 * 4. 生成 src/lib/reasonix-addon/bundledVersion.ts（前端对比用常量）
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADDON_DIR = join(ROOT, "reasonix-addon");
const MANIFEST_PATH = join(ADDON_DIR, "manifest.json");
const OUT_ADDON = join(ROOT, "dist", "reasonix-anki-addon.ankiaddon");
const RESOURCES_DIR = join(ROOT, "src-tauri", "resources");
const BUNDLED_TS = join(ROOT, "src", "lib", "reasonix-addon", "bundledVersion.ts");

/** 解析 semver 版本 → {major, minor, patch}；非法返回 null */
export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** patch +1 递增；非 semver 返回 null（不 bump，保守） */
export function bumpPatch(version) {
  const parsed = parseVersion(version);
  if (!parsed) return null;
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

/** 检测 reasonix-addon/ 源码是否有 git 未提交变更（staged + unstaged） */
export function hasAddonSourceChanges(root = ROOT) {
  try {
    const out = execFileSync(
      "git",
      ["status", "--porcelain", "--", "reasonix-addon/"],
      { cwd: root, encoding: "utf-8" },
    );
    return out.trim().length > 0;
  } catch {
    // 非 git 环境：保守降级为 false（不自动 bump，仅同步）
    return false;
  }
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
}

function main() {
  const manifest = readManifest();

  // 真·自动递增：有源码变更且 manifest 本身未被修改（幂等）→ patch+1
  const manifestChanged = hasAddonSourceChanges();
  if (manifestChanged && !hasUncommittedChange(MANIFEST_PATH)) {
    const bumped = bumpPatch(manifest.human_version);
    if (bumped) {
      manifest.human_version = bumped;
      writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`addon:sync 自动递增版本 → ${bumped}`);
    } else {
      console.warn(
        `addon:sync 跳过自动递增：human_version 非 semver（${manifest.human_version}）`,
      );
    }
  }

  // 重新打包（package_addon.py 内部以 manifest 为真源并自检）
  execFileSync(
    "python",
    ["reasonix-addon/package_addon.py", "--output", OUT_ADDON],
    { cwd: ROOT, stdio: "inherit" },
  );

  // 复制内嵌包到 src-tauri/resources/
  mkdirSync(RESOURCES_DIR, { recursive: true });
  copyFileSync(OUT_ADDON, join(RESOURCES_DIR, "reasonix-anki-addon.ankiaddon"));

  // 读真源版本，生成前端常量
  const finalManifest = readManifest();
  const version = finalManifest.human_version;
  if (typeof version !== "string" || !version) {
    throw new Error("manifest.json human_version 必须是非空字符串");
  }
  const content =
    `// 自动生成，勿手改 —— 由 npm run addon:sync 从 manifest.json 写入\n` +
    `// 单一真源：reasonix-addon/manifest.json 的 human_version（addon:sync 自动递增）\n` +
    `export const BUNDLED_ADDON_VERSION = ${JSON.stringify(version)};\n`;
  writeFileSync(BUNDLED_TS, content);

  console.log(`addon:sync OK — bundled v${version}`);
}

/**
 * 检查某文件是否有未提交变更（幂等判定：manifest 已被本次或上次 bump 修改过）。
 * git status 输出行格式 "XY path"；匹配 manifest 路径。
 */
function hasUncommittedChange(filePath) {
  try {
    const out = execFileSync(
      "git",
      ["status", "--porcelain", "--", filePath],
      { cwd: ROOT, encoding: "utf-8" },
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

try {
  // 仅直接执行时运行（import 测试时跳过副作用）
  if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
  }
} catch (error) {
  console.error(`addon:sync 失败：${error.message}`);
  process.exitCode = 1;
}
