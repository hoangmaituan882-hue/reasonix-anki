#!/usr/bin/env node
/**
 * addon:sync —— 插件安装包自托管同步（Artifact Sync-on-Change）
 *
 * 每次修改插件后执行，保证：
 * 1. 重新打包 .ankiaddon（单一版本真源 manifest.json human_version，
 *    打包脚本内部自检包内 manifest 与真源一致）
 * 2. 复制到 src-tauri/resources/（随 Tauri bundle.resources 分发）
 * 3. 生成 src/lib/reasonix-addon/bundledVersion.ts（前端对比用常量）
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

function main() {
  // 1. 重新打包（package_addon.py 内部以 manifest 为真源并自检）
  execFileSync(
    "python",
    ["reasonix-addon/package_addon.py", "--output", OUT_ADDON],
    { cwd: ROOT, stdio: "inherit" },
  );

  // 2. 复制内嵌包到 src-tauri/resources/
  mkdirSync(RESOURCES_DIR, { recursive: true });
  copyFileSync(OUT_ADDON, join(RESOURCES_DIR, "reasonix-anki-addon.ankiaddon"));

  // 3. 读真源版本，生成前端常量
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  const version = manifest.human_version;
  if (typeof version !== "string" || !version) {
    throw new Error("manifest.json human_version 必须是非空字符串");
  }
  const content =
    `// 自动生成，勿手改 —— 由 npm run addon:sync 从 manifest.json 写入\n` +
    `// 单一真源：reasonix-addon/manifest.json 的 human_version\n` +
    `export const BUNDLED_ADDON_VERSION = ${JSON.stringify(version)};\n`;
  writeFileSync(BUNDLED_TS, content);

  console.log(`addon:sync OK — bundled v${version}`);
}

try {
  main();
} catch (error) {
  console.error(`addon:sync 失败：${error.message}`);
  process.exitCode = 1;
}
