#!/usr/bin/env node
/**
 * release —— 手动发布管线（P8）
 *
 * 步骤：
 * 1. 校验工作区干净（防止产物带未提交代码）
 * 2. npm run addon:sync（纪律 8：内嵌插件最新 + 版本自动递增）
 * 3. 生成 buildInfo.ts（版本 + commit + 构建时间）
 * 4. npm run tauri build（NSIS 安装包）
 * 5. 复制产物到 dist/release/ReasonixAnki-v{version}-{commit}/
 *    （版本 + commit 命名，防旧产物混淆）
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NSIS_DIR = join(ROOT, "src-tauri", "target", "release", "bundle", "nsis");

function run(cmd, args) {
  execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
}

/**
 * 校验工作区干净（防止产物带未提交代码）。
 * exec 可注入（测试用）；默认 execFileSync。
 */
export function checkCleanWorkspace(root = ROOT, exec = execFileSync) {
  try {
    const out = exec("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf-8",
    });
    if (out.trim().length > 0) {
      throw new Error(`工作区有未提交改动，中止发布：\n${out}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("工作区有未提交改动")) {
      throw error;
    }
    throw new Error("需在 git 仓库中发布（无法读取 git 状态）");
  }
}

function main() {
  // 1. 校验工作区干净
  checkCleanWorkspace();

  // 2. 内嵌插件同步（含版本自动递增）
  run("npm", ["run", "addon:sync"]);

  // 3. 生成构建元数据
  run("node", ["scripts/build-info.mjs"]);

  // 4. Tauri 构建（NSIS）
  run("npm", ["run", "tauri", "build"]);

  // 5. 复制产物到版本化发布目录
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  const version = pkg.version;
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: ROOT,
    encoding: "utf-8",
  }).trim();
  const releaseDir = join(ROOT, "dist", "release", `ReasonixAnki-v${version}-${commit}`);
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });

  // NSIS 安装包
  cpSync(NSIS_DIR, releaseDir, { recursive: true });
  // 内嵌插件包（随发布分发，便于单独更新）
  cpSync(
    join(ROOT, "src-tauri", "resources", "reasonix-anki-addon.ankiaddon"),
    join(releaseDir, "reasonix-anki-addon.ankiaddon"),
  );
  // 校验清单
  const manifest = JSON.parse(
    readFileSync(join(ROOT, "reasonix-addon", "manifest.json"), "utf-8"),
  );
  const checklist = {
    appVersion: version,
    addonVersion: manifest.human_version,
    commit,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(
    join(releaseDir, "RELEASE.json"),
    `${JSON.stringify(checklist, null, 2)}\n`,
  );

  console.log(`release OK — ${releaseDir}`);
  console.log(JSON.stringify(checklist));
}

try {
  // 仅直接执行时运行（import 测试时跳过副作用）
  if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
  }
} catch (error) {
  console.error(`release 失败：${error.message}`);
  process.exitCode = 1;
}
