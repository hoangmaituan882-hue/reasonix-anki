<p align="center">
  <img src="./app-icon.png" width="128" height="128" alt="Reasonix Anki" />
</p>

<h1 align="center">Reasonix Anki 工作台</h1>

<p align="center">
  基于 <a href="https://github.com/FooSoft/anki-connect">AnkiConnect</a> 的现代 Anki 桌面工作台<br/>
  今日学习 · 沉浸学习 · 牌组浏览 · 笔记编辑 · 统计概览
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.1-ff6a3d" alt="version" />
  <img src="https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Anki-25.09-2980b9?logo=anki&logoColor=white" alt="Anki" />
  <img src="https://img.shields.io/badge/AnkiConnect-v6-2980b9?logo=anki&logoColor=white" alt="AnkiConnect" />
  <img src="https://img.shields.io/badge/Addon_Protocol-v1-2980b9?logo=anki&logoColor=white" alt="Addon Protocol" />
  <img src="https://img.shields.io/badge/Platform-Windows_10+-0078D6?logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 这是什么

**Reasonix Anki** 是给"嫌 Anki 原生界面丑"的人做的现代客户端。它不替代 Anki，而是作为前端连接**本机运行中的 Anki**，所有数据读写真实落到 Anki 数据库。

- **调度真源是 Anki**：v2 起通过配套插件 `reasonix-addon` 桥接 Anki 原生 scheduler（`QueryOp`/`CollectionOp` 主线程队列），不筛选、不重排、不覆盖每日限额
- **今日首页**：选择牌组后直接进入 Anki 原生调度会话（四档间隔、即时撤销、自动音频、会话结束自动同步）
- UI 采用 [`@reasonix/ui`](https://github.com/hoangmaituan882-hue/reasonix) 组件库（shadcn 风格组件 + 6 个主题方向），无边框圆角窗口 + 自绘标题栏 + 悬浮面板侧边栏

## 功能

| 视图 | 能力 |
|---|---|
| 🗓️ **今日学习** | 今日首页：牌组计数（AnkiConnect `getDeckStats`）、选择牌组直接开始 Anki 原生调度会话 |
| 🎓 **沉浸学习** | 插件调度：问题/答案渲染、四档评分、即时撤销、同步状态监测（`health` 字段 + 指数退避重试） |
| 📚 **牌组浏览** | 三栏布局（牌组树 → 卡片列表 → 笔记预览）；Anki 搜索语法 + 分页；行操作：暂停/改期/编辑/删除 |
| ✏️ **笔记编辑** | 按模板动态字段表单；新建/编辑/删除；图片粘贴上传（自动写入 Anki 媒体目录） |
| 📊 **统计概览** | 汇总卡 + 26 周热力图；SQLite 本地聚合 + `cardReviews(startID)` 增量同步 |
| ⚙️ **设置** | 外观（圆角窗口开关 / 主题方向 / 深色模式）；学习与插件分组为骨架预览，即将接入 |

## 配套 Anki 插件（reasonix-addon）

v2 起配套插件是**必要组件**（监听 `127.0.0.1:8766`），通过 Anki 主线程 operation 队列桥接原生调度：

- `session.start / next / reveal / answer / undo / finish` 会话协议（JSON-RPC，UUID `requestId` + token + 幂等）
- 四档间隔、即时撤销、准确计数、同步协调；Profile 命名空间（`profileKey`）
- 生命周期 hooks 门控 + 同步锁；启动失败非致命化、worker 异常进 `health`、同步启动幂等
- 锁定 Anki **25.09.2**（manifest `min/max_point_version: 250902`）；`Reasonix QA` Profile 永不自动同步

```bash
npm run addon:package        # 产出 dist/reasonix-anki-addon.ankiaddon
```

## 技术栈

Tauri 2（Rust 薄层代理 AnkiConnect/插件，绕 CORS）· React 19 · TypeScript strict · Vite 7 · Tailwind CSS v4 · TanStack Query（查询层）· Zustand（会话层）· SQLite（tauri-plugin-sql）· `@reasonix/ui`（vendor/ 本地 tgz）。

## 前置条件

- **Anki 桌面端运行中**（25.09.2），安装 AnkiConnect（附加组件代码 `2055492159`）与 `reasonix-addon` 配套插件
- Node ≥ 20、Rust stable（MSVC 工具链）

## 快速开始

```bash
git clone https://github.com/hoangmaituan882-hue/reasonix-anki.git
cd reasonix-anki
npm install
npm run addon:package         # 打包配套插件 .ankiaddon（Anki 里安装）
npm run tauri dev
```

## 开发

```bash
npm run tauri dev        # Tauri 窗口（生产路径：Rust 转发 8765/8766）
npm run dev              # 纯浏览器调试（localhost:1420，走 /anki vite proxy）
npm run tauri build      # 打 NSIS 安装包（产物在 src-tauri/target/release/bundle/nsis/）
npm test                 # 前端 vitest（含协议 schema golden fixtures）
npm run test:addon       # 插件 Python unittest（11 个测试文件）
npx tsc --noEmit         # 类型检查
npm run qa:preflight     # QA Profile 只读闸门（调度写测试前必须通过）
```

浏览器模式下前端 `fetch('/anki')` 由 Vite 代理到 `127.0.0.1:8765`；Tauri 窗口内自动走 Rust command（`src/lib/anki/transport.ts` 双通道抽象）。

## 复习与卡片渲染

- **安全沙箱为默认**：DOMPurify 消毒 + iframe 无脚本渲染；JS 驱动的重模板在复习页开启"脚本模式"后完整渲染（等同 Anki 原生信任级别）
- **媒体管线**：图片/音频/GIF 经 Rust 直读 Anki 媒体目录转 Blob；`[sound:]` 与 `[anki:play:q/a:N]` 自动转播放器
- **键盘流**：`Space` 显示答案 · `1–4` 评分 · `B` 今天不看（会话内 bury，不改 Anki 调度）

## 窗口外观（Windows 10）

- **无边框圆角窗口**：`decorations:false + transparent:true + shadow:false`，应用背景由根容器圆角提供，header 升级为自绘标题栏（拖拽移动 / 双击最大化 / 自绘最小化·最大化·关闭）。方案对比与坑详见 [`AGENTS.md §11`](AGENTS.md)
- **窗口阴影**：系统不提供阴影，自绘 `box-shadow` 合成到桌面（根容器外留 12px 间隙），最大化时自动去掉间隙/圆角/阴影
- **悬浮面板侧边栏**：整块侧边栏是一张悬浮圆角卡片（与窗口边缘留 12px 间隙），收缩动画走设计令牌（`--rx-dur-slow`/`--rx-ease`，`motion-reduce` 降级）
- **设置里的圆角开关**：设置抽屉 → 外观 → 圆角窗口（纯 CSS 切换，持久化 `ra.roundedCorners`）

## 项目结构

```
reasonix-anki/
├── src/                    # React 前端（components / features / lib / stores）
│   ├── features/today/     # 今日首页（选择牌组 → 开始调度会话）
│   ├── features/study/     # 沉浸学习（插件调度会话）
│   └── lib/anki/           # AnkiConnect 类型化 action 客户端（唯一入口）
├── src-tauri/              # Tauri Rust 薄层 + 窗口配置
├── reasonix-addon/         # 配套 Anki 插件（调度/同步/health，锁定 25.09.2）
├── protocol/               # TS/Python 共用 golden JSON fixtures（协议校验）
├── docs/                   # tech-plan.md / qa-runbook.md / official-docs-review.md
├── vendor/                 # @reasonix/ui 本地 tgz
└── AGENTS.md               # AI 编程代理规范 + API 参考 + 圆角方案
```

## 更新 @reasonix/ui

```bash
cd ../reasonix-design-kit/packages/ui && npm run pack
cp reasonix-ui-*.tgz ../../reasonix-anki/vendor/
cd ../../reasonix-anki && npm i ./vendor/reasonix-ui-*.tgz
```

## 路线图

P0 方向确认 ✅ → P1 插件调度硬闸门 ✅（2026-08-10 实机验证通过）→ P2 今日首页 ✅ → P3 Lapis 适配 ✅ → P4 沉浸学习 ✅ → P5 报告 ✅ → P6 同步与报告 ✅ → **P7 稳定性（进行中）** → P8 发布

详见 [`docs/tech-plan.md`](docs/tech-plan.md)。

## 文档

- [`AGENTS.md`](AGENTS.md) — 架构红线 · AnkiConnect API 参考 · 实测陷阱速查 · 圆角方案
- [`docs/tech-plan.md`](docs/tech-plan.md) — v2 技术方案（P0–P8 实施计划与验收）
- [`docs/qa-runbook.md`](docs/qa-runbook.md) — 调度 QA 手册（实机闸门步骤与安全边界）
- [`docs/official-docs-review.md`](docs/official-docs-review.md) — 官方文档复审记录

## 致谢

- [Anki](https://apps.ankiweb.net/) 与 [AnkiConnect](https://github.com/FooSoft/anki-connect)
- [Tauri](https://tauri.app/) · [shadcn/ui](https://ui.shadcn.com/) · [Radix UI](https://www.radix-ui.com/) · [Lucide](https://lucide.dev/)
- [reasonix-design-kit](https://github.com/hoangmaituan882-hue/reasonix)（`@reasonix/ui` 组件库来源）

## IDE 推荐

[VS Code](https://code.visualstudio.com/) + [Tauri 扩展](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

[MIT](LICENSE) © 2026 Reasonix Design
