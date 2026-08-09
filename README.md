<p align="center">
  <img src="./app-icon.png" width="128" height="128" alt="Reasonix Anki" />
</p>

<h1 align="center">Reasonix Anki 工作台</h1>

<p align="center">
  基于 <a href="https://github.com/FooSoft/anki-connect">AnkiConnect</a> 的现代 Anki 桌面工作台<br/>
  牌组浏览 · 笔记编辑 · 自建复习流 · 统计概览
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-ff6a3d" alt="version" />
  <img src="https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Platform-Windows_10+-0078D6?logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/AnkiConnect-v6-2980b9?logo=anki&logoColor=white" alt="AnkiConnect" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 这是什么

**Reasonix Anki** 是给"嫌 Anki 原生界面丑"的人做的现代客户端。它不替代 Anki，而是作为前端连接**本机运行中的 Anki**（AnkiConnect，`127.0.0.1:8765`），所有数据读写真实落到 Anki 数据库。

UI 采用 [`@reasonix/ui`](https://github.com/hoangmaituan882-hue/reasonix) 组件库（38 个 shadcn 风格组件 + 6 个主题方向），无边框圆角窗口 + 自绘标题栏。

## 功能

| 视图 | 能力 |
|---|---|
| 📚 **牌组浏览** | 三栏布局（牌组树 → 卡片列表 → 笔记预览）；"新卡 已学/上限"口径；Anki 搜索语法 + 分页；行操作：暂停/改期/编辑/删除 |
| ✏️ **笔记编辑** | 按模板动态字段表单；新建/编辑/删除；图片粘贴上传（自动写入 Anki 媒体目录） |
| 🎓 **复习** | 自建复习流：到期队列 → 问题面/答案面沙箱渲染 → 键盘评分；媒体（图/音/GIF）Rust 直读；"今天不看"会话内 bury（零调度副作用）；脚本模式渲染 JS 重模板 |
| 📊 **统计概览** | 汇总卡 + 26 周热力图；SQLite 本地聚合 + `cardReviews(startID)` 增量同步 |

## 技术栈

Tauri 2（Rust 薄层代理 AnkiConnect，绕 CORS）· React 19 · TypeScript strict · Vite 7 · Tailwind CSS v4 · TanStack Query（查询层）· Zustand（会话层）· SQLite（tauri-plugin-sql）· `@reasonix/ui`（vendor/ 本地 tgz）。

## 前置条件

- **Anki 桌面端运行中**，并安装 AnkiConnect 插件（附加组件代码 `2055492159`）
- Node ≥ 20、Rust stable（MSVC 工具链）

## 快速开始

```bash
git clone https://github.com/hoangmaituan882-hue/reasonix-anki.git
cd reasonix-anki
npm install
npm run tauri dev
```

## 开发

```bash
npm run tauri dev        # Tauri 窗口（生产路径：Rust 转发 8765）
npm run dev              # 纯浏览器调试（localhost:1420，走 /anki vite proxy）
npm run tauri build      # 打 NSIS 安装包（产物在 src-tauri/target/release/bundle/nsis/）
npx tsc --noEmit         # 类型检查
```

浏览器模式下前端 `fetch('/anki')` 由 Vite 代理到 `127.0.0.1:8765`；Tauri 窗口内自动走 Rust command（`src/lib/anki/transport.ts` 双通道抽象）。

## 复习与卡片渲染

- **安全沙箱为默认**：DOMPurify 消毒 + iframe 无脚本渲染；JS 驱动的重模板（如日语挖矿背词卡）在复习页顶部开启"脚本模式"后完整渲染（等同 Anki 原生信任级别）
- **媒体管线**：图片/音频/GIF 经 Rust 直读 Anki 媒体目录转 Blob；`[sound:]` 与 `[anki:play:q/a:N]` 自动转播放器
- **键盘流**：`Space` 显示答案 · `1–4` 评分 · `B` 今天不看（会话内 bury，不改 Anki 调度）

## 窗口圆角（Windows 10）

无边框 + 透明窗口 + CSS 圆角（Win10 DWM 边框恒为直角，原生标题栏无法圆角）。`decorations:false + transparent:true + shadow:false`，应用背景由根容器圆角提供，header 升级为自绘标题栏（拖拽移动 / 双击最大化 / 自绘最小化·最大化·关闭）。方案对比与坑详见 [`AGENTS.md §11`](AGENTS.md)。

## 项目结构

```
reasonix-anki/
├── src/                    # React 前端（components / features / lib / stores）
│   └── lib/anki/           # AnkiConnect 类型化 action 客户端（唯一入口）
├── src-tauri/              # Tauri Rust 薄层 + 窗口配置
├── docs/tech-plan.md       # 技术方案（v1.2，含评审记录与实施日志）
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

M0 脚手架与连接状态机 ✅ → M1 牌组浏览器 ✅ → M2 笔记编辑 ✅ → M3 复习（Zustand 状态机 + 会话内 bury）✅ → M4 统计（SQLite 增量聚合）✅ → M5 打包 ✅ · M6 打磨（可选）· M7 配套 Anki 插件（可选）

详见 [`docs/tech-plan.md`](docs/tech-plan.md)。

## 文档

- [`AGENTS.md`](AGENTS.md) — 架构红线 · AnkiConnect API 参考 · 实测陷阱速查 · 圆角方案
- [`docs/tech-plan.md`](docs/tech-plan.md) — 技术方案 v1.2（评审记录 + M0–M5 实施日志）

## 致谢

- [Anki](https://apps.ankiweb.net/) 与 [AnkiConnect](https://github.com/FooSoft/anki-connect)
- [Tauri](https://tauri.app/) · [shadcn/ui](https://ui.shadcn.com/) · [Radix UI](https://www.radix-ui.com/) · [Lucide](https://lucide.dev/)
- [reasonix-design-kit](https://github.com/hoangmaituan882-hue/reasonix)（`@reasonix/ui` 组件库来源）

## IDE 推荐

[VS Code](https://code.visualstudio.com/) + [Tauri 扩展](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

[MIT](LICENSE) © 2026 Reasonix Design
