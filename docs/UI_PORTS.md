# UI 移植清单（reasonix-anki ⇄ Ainox 纯前端沙盒）

> 用途：定义 Reasonix Anki 前端 UI 与云端纯前端沙盒（Ainox）之间的移植边界。
> **Ainox = 本仓库前端源码逐文件复刻 + 少量 stub 替换**（真实数据通道 → mock）。
> AI 在 Ainox 改的 UI 文件，拿回本仓库**路径相同、直接覆盖**。

## 1. 移植原则

- **单向流动**：reasonix-anki → Ainox（导出基线）；Ainox → reasonix-anki（移植成果）。
  同一时间只改一边，避免双向漂移。
- **视图/组件与主仓库零差异**：AI 改的就是同款代码，覆盖即移植。
- **契约层不可改**（stub 之外的数据接口）：见 §4。

## 2. 可移植文件（UI 层，全量）

以下文件复制到 Ainox 相同路径，内容与主仓库一致：

```
src/main.tsx, src/App.tsx, src/SettingsWindowLayout.tsx, src/index.css, src/App.css, src/vite-env.d.ts
src/components/                     （全量 UI 组件，含 icons/animated、achievements、companion、widgets）
src/features/                       （全量视图：today/browse/editor/review/study/stats/settings/history/vocabulary）
src/stores/                         （app/editor/review/settings/studySession*）
src/lib/anki/actions.ts             （类型化接口层，与主仓库一致——Ainox 走 demo transport）
src/lib/anki/schemas.ts             （zod schemas，与主仓库一致）
src/lib/anki/demo.ts                （演示数据，与主仓库一致）
src/lib/anki/query.ts               （查询 hooks，与主仓库一致）
src/lib/dompurify.ts, src/lib/utils.ts, src/lib/ease.ts, src/lib/media.ts
vendor/reasonix-ui-0.2.0.tgz        （@reasonix/ui 本地包）
```

## 3. Stub 文件（Ainox 专用替换，不得改动 UI 文件 import）

Ainox 无 Tauri/Anki/SQLite，以下文件用 stub 替换（UI import 路径不变，编译解析通过；
stub 内部抛错/返回空，因 demo 模式不会调用真实通道）：

| 路径 | stub 行为 |
|---|---|
| `src/lib/anki/transport.ts` | **所有 action 直通 demo**（`demoCall`），不再 fetch/invoke |
| `src/lib/anki/useConnection.ts` | 恒返回 connected（demo 模式语义） |
| `src/lib/db/stats.ts` | `getDayTimeline` 等抛错（demo 走浏览器降级路径，不会调用） |
| `src/lib/db/mappings.ts` | 抛错 stub |
| `src/lib/window.ts` | `openSettingsWindow` 空实现（无 Tauri 窗口） |
| `src/lib/reasonix-addon/transport.ts` | 抛错 stub（配套插件协议，demo 不调用） |
| `src/lib/reasonix-addon/bundledVersion.ts` | 常量 stub（版本号） |

其余 `lib/reasonix-addon/*`（client/schemas/capabilities/retry）为纯 TS，原样复制。
`src/lib/buildInfo.ts` 由 build:info 生成、被 gitignore——Ainox 无此文件（glob fallback 已处理）。

## 4. 契约（不可改，移植时审查）

AI 在 Ainox 改动时**不得修改以下接口签名**（否则移植回会破坏数据层）：

1. `lib/anki/actions.ts` 全部函数签名（anki.version/deckNamesAndIds/...）
2. `lib/anki/schemas.ts` 的类型（CardInfo/DeckStats/NoteInfo...）
3. `lib/anki/query.ts` 的 queryKeys 与 hooks 签名（useDeckTree/useCardSearch/...）
4. `features/history/historyUtil.ts` 全部导出（纯函数+类型）
5. `stores/app.ts` 的 `View` 类型与 `historyDate`/`browseQuery` 等注入字段
6. `stores/studySession*` 的状态机类型与 actions
7. 演示数据 `lib/anki/demo.ts` 的 action 键（新增 action 需同步主仓库）

## 5. 移植回流程（Ainox → reasonix-anki）

1. 按 §2 清单**覆盖**对应文件（保留 stub 文件的差异：transport/useConnection/db/window/reasonix-addon-transport 不覆盖）
2. 审查 §4 契约是否被改（git diff 对比）
3. 主仓库 `npx tsc --noEmit` + `npx vitest run`（145 用例）
4. 真实浏览器（Tabbit）+ `npm run tauri dev` 验证
5. 若新增页面依赖真实数据接口 → 先在主仓库补数据层，再合 UI
6. 登记 CHANGELOG + 提交

## 6. 排除（不移植）

```
src-tauri/               （Rust 层）
src/lib/db/ 真实实现     （SQLite 仅 stub 进沙盒）
lib/reasonix-addon/ 真实 transport
*.test.ts(x)            （测试文件随主仓库保留，沙盒不复制）
docs/、scripts/ 等
```

## 7. Ainox 独立运行要求

- 依赖：react/react-dom/zustand/@tanstack/react-query/motion/lucide-react/dompurify/
  @reasonix/ui(file:vendor)/tailwindcss@4/@vitejs/plugin-react/typescript —— **不含 @tauri-apps/***
  （stub 文件不 import Tauri API）
- `npm run dev` 可预览；演示模式默认开启（或断线屏点「进入演示模式」）
- 全部视图用 mock 数据可交互
