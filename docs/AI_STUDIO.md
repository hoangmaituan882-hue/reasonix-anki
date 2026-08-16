# 在 Google AI Studio 中开发 Reasonix Anki

> 本文件说明如何把本仓库导入 Google AI Studio（云端 IDE）进行 AI 辅助开发，
> 以及云端环境的能力边界与推荐工作流。

## 0. 云端直接浏览界面：内置演示模式（无需 Anki）

云端没有 Anki，直接运行会卡在断线引导页。项目内置**演示模式**（2026-08 新增）：
断线页点击「进入演示模式」（或 localStorage `ra.demoMode=1`）→ 所有视图切换为
内置 mock 数据（3 个演示牌组 / 6 张日语卡 / 统计热力图 / 学习轨迹时间线 / 复习会话），
无需 Anki 即可浏览完整 UI。顶部「演示模式 · 点击退出」恢复真实连接检测。

```bash
# 云端快速体验
npm run dev          # 启动前端
# 浏览器打开 localhost:5173 → 断线页 → 进入演示模式
```

演示数据源：`src/lib/anki/demo.ts`（transport 层拦截，视图无感）。限制：
配套插件（沉浸式学习）与 SQLite 单牌组统计不 mock。

## 1. 为什么现在可以导入

早期版本有个已知问题：`src/lib/buildInfo.ts` 由 `scripts/build-info.mjs` 生成且被
`.gitignore` 排除（BUILD_TIME 每次构建必变，避免污染工作区）——但从 git 干净拉取的
环境（AI Studio / CI / 协作者）缺该文件会导致 `AboutCard.tsx` 编译失败、应用无法启动。

已修复（2026-08）：`AboutCard` 改用 Vite `import.meta.glob` 动态发现 + 开发版 fallback——
文件缺失时自动回退 `v0.1.0-dev`，**任何环境 clone 即可编译运行**，本地 `build:info`
生成后仍显示真实版本。

## 2. 导入步骤（GitHub 连接，推荐）

仓库为公开仓库：`https://github.com/hoangmaituan882-hue/reasonix-anki`（分支 `master`）。

1. 打开 Google AI Studio → 新建/进入工作区
2. 左侧面板 → **GitHub**（或 File → 打开仓库）
3. 授权登录 GitHub（OAuth）
4. 选择 `hoangmaituan882-hue/reasonix-anki` → 克隆到工作区（`/app/applet`）
5. 终端执行 `npm install` 安装依赖（node_modules 不随 git 分发）

> 备选：GitHub 页面 Code → Download ZIP 后上传，但文件较多，推荐 GitHub 连接。

## 3. 环境限制（必须知道）

| 能力 | 云端（AI Studio） | 本地（Windows） |
|---|---|---|
| 代码编辑 / AI 辅助（生成/审查/重构） | ✅ | ✅ |
| TypeScript / 单元测试（vitest） | ✅（`npm run test`） | ✅ |
| `npm run build`（tsc + vite） | ✅ | ✅ |
| 前端 dev server（`npm run dev`） | ⚠️ 可启动，但**连不上本机 Anki** | ✅ |
| **Tauri 桌面应用**（`npm run tauri dev`） | ❌ 无 WebView2 / Rust 工具链运行环境 | ✅ |
| 连接本机 Anki / AnkiConnect | ❌ 云端无本机 Anki | ✅ |
| 浏览器模式真实数据验证 | ❌ | ✅（Anki 运行 + dev server） |

**本质**：AI Studio 是**代码开发环境**，不是运行环境。Reasonix Anki 是 Tauri 桌面应用，
核心链路依赖本机 Anki（AnkiConnect :8765）与 WebView2——云端只能开发、不能运行验证。

## 4. 推荐工作流（云端开发 + 本地验证）

```
[Google AI Studio]              [本机 Windows]
      │                              │
  AI 辅助开发代码  ──git push──►  本地 pull
  （生成/审查/重构/测试）            │
                                    ▼
                              npm run tauri dev 验证
                              （Anki + 插件就绪）
      ◄──────── git push ──────── 修复合入
```

1. **云端**：用 AI Studio 的 AI 助手做功能开发、代码审查、测试编写（vitest 可在云端跑）
2. **本地**：`git pull` 后 `npm run tauri dev` 做真实运行验证（Anki、插件、UI、媒体）
3. 循环通过 git 同步（建议小步提交）

## 5. 云端可用的命令

```bash
npm install                 # 安装依赖（首次）
npm run test                # vitest 全量测试（137 用例）
npx tsc --noEmit            # 类型检查
npm run build               # tsc + vite 生产构建
npm run dev                 # 前端 dev server（可起，但连不上本机 Anki）
npm run test:addon          # 插件 Python 单测（需 python + 依赖）
```

不可用：`npm run tauri dev`（无桌面运行环境）、真实 Anki 数据交互、`npm run release`（需本地产物）。

## 6. 注意事项

- `src/lib/buildInfo.ts` 在云端是缺失态（fallback 开发版）——不影响编译；版本信息显示"开发版"
- `.ankiaddon` 等二进制产物不在 git 内，云端只能看打包脚本源码
- Rust 层（`src-tauri/`）改动云端可编辑，但无法编译验证——建议本地 `cargo check` 后合入
- 项目规范（红线/API/纪律）见 `AGENTS.md`，AI Studio 的 AI 助手应让它先读该文件再动手
