# Reasonix Anki 工作台

基于 AnkiConnect 的 Anki 桌面工作台：牌组浏览 / 笔记增删改 / 自定义复习 / 统计概览。
UI 采用 [reasonix-design-kit](../reasonix-design-kit) 的 `@reasonix/ui` 组件库。

技术方案：[../reasonix-anki-tech-plan.md](../reasonix-anki-tech-plan.md)（v1.2）

## 技术栈

Tauri 2（Rust 层代理 AnkiConnect，绕 CORS）· React 19 · TypeScript · Vite 7 · Tailwind CSS v4 · TanStack Query（查询层）· Zustand（会话层）· SQLite（tauri-plugin-sql，M4 统计）。

## 前置条件

- Anki 桌面端运行中，并安装 AnkiConnect 插件（附加组件代码 `2055492159`）
- Node ≥ 20、Rust stable（MSVC 工具链）

## 开发

```bash
npm install
npm run tauri dev        # Tauri 窗口（生产路径：Rust 转发 8765）
npm run dev              # 纯浏览器调试（localhost:1420，走 /anki vite proxy）
npm run tauri build      # 打 NSIS 安装包（产物在 src-tauri/target/release/bundle/nsis/）
```

浏览器模式下前端 `fetch('/anki')` 由 Vite 代理到 `127.0.0.1:8765`；Tauri 窗口内自动走 Rust command（`src/lib/anki/transport.ts` 双通道抽象）。

## 复习与卡片渲染

- 默认安全沙箱渲染（DOMPurify + iframe 无脚本）；JS 驱动的重模板（如日语挖矿背词卡）在复习页顶部开启"脚本模式"后完整渲染（等同 Anki 原生信任级别）
- 媒体（图片/音频/GIF）经 Rust 直读 Anki 媒体目录转 Blob；`[sound:]` 与 `[anki:play:q/a:N]` 自动转播放器
- 键盘流：Space 显示答案 · 1–4 评分 · B 今天不看（会话内 bury，不改 Anki 调度）

## 更新 @reasonix/ui

```bash
cd ../reasonix-design-kit/packages/ui && npm run pack
cp reasonix-ui-*.tgz ../../reasonix-anki/vendor/
cd ../../reasonix-anki && npm i ./vendor/reasonix-ui-*.tgz
```

## 里程碑

M0 脚手架与连接状态机 → M1 牌组浏览器（stats 已学/上限口径）→ M2 笔记编辑 → M3 复习（Zustand 状态机 + 会话内 bury）→ M4 统计（SQLite 增量聚合）→ M5 打包。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
