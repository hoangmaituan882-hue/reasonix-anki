#!/usr/bin/env node
/**
 * build-info —— 注入构建元数据（版本 / git commit / 构建时间）。
 *
 * 生成 src/lib/buildInfo.ts，About 页/设置页可展示，用户自助核对版本。
 * 版本取 package.json（前端应用版本，与插件版本解耦）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "lib", "buildInfo.ts");

function gitCommit(short = true) {
  try {
    const out = execFileSync(
      "git",
      short ? ["rev-parse", "--short", "HEAD"] : ["rev-parse", "HEAD"],
      { cwd: ROOT, encoding: "utf-8" },
    );
    return out.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function main() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  const version = pkg.version;
  const commit = gitCommit(true);
  const builtAt = new Date().toISOString();

  const content =
    `// 自动生成，勿手改 —— 由 npm run build:info 从 package.json + git 写入\n` +
    `export const APP_VERSION = ${JSON.stringify(version)};\n` +
    `export const GIT_COMMIT = ${JSON.stringify(commit)};\n` +
    `export const BUILD_TIME = ${JSON.stringify(builtAt)};\n`;
  writeFileSync(OUT, content);
  console.log(`build-info OK — v${version} @ ${commit} (${builtAt})`);
}

main();
