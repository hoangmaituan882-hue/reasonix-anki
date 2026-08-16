# Reasonix Anki — 项目概览（v0.2 现状）

> 本文件是**与当前代码状态一致的准确概览**（2026-08 核对）。
> 权威技术规范、架构红线与 API 参考见 [`AGENTS.md`](../AGENTS.md)；已批准的后续设计见 [`tech-plan.md`](tech-plan.md)。
> 本项目每次改动的强制登记见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## 1. 基本信息

| 属性 | 值 |
|---|---|
| 项目名称 | reasonix-anki |
| 版本 | 0.1.0 |
| 定位 | 基于 [AnkiConnect](https://git.sr.ht/~foosoft/anki-connect) 的现代 Anki 桌面工作台（"嫌 Anki 原生界面丑"的替代前端） |
| 协议 | MIT |
| 标识符 | com.linze.reasonix-anki |
| 运行形态 | 前端连接**本机运行中的 Anki**（HTTP `127.0.0.1:8765`），所有数据读写真实落到 Anki 数据库；不替代 Anki |

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri 2（Rust 薄层 + WebView2 前端） |
| 前端框架 | React 19.1 |
| 语言 | TypeScript 5.8（strict） |
| 构建工具 | Vite 7 |
| 状态管理 | Zustand 5（命令式会话状态） |
| 数据请求 | TanStack React Query 5（查询型数据） |
| 样式方案 | Tailwind CSS 4 + 自定义设计令牌（`@reasonix/ui`） |
| UI 组件库 | Radix UI + 自研 `@reasonix/ui`（vendor tgz，38 组件） |
| 数据验证 | Zod 4 |
| 动画 | Motion (Framer Motion) 13 + 自研动画图标系统（Lucide Animated 规范） |
| 本地存储 | SQLite（tauri-plugin-sql，统计层） |
| 测试 | Vitest 4 + Testing Library（前端）/ Python unittest（插件） |

## 3. 架构总览（双通道）

```
┌─ Tauri 2 桌面窗口（无边框透明圆角）──────────────────────────────┐
│  React 19 前端                                                    │
│  ┌──────────┬──────────────────────────────────────────────┐     │
│  │ Sidebar  │ 主内容区（6 导航视图 + 沉浸式学习会话视图）    │     │
│  │ 今日学习 │  查询型数据 → TanStack Query（牌组/卡片/笔记） │     │
│  │ 牌组浏览 │  会话型状态 → Zustand（复习/沉浸学习/编辑器）  │     │
│  │ 笔记编辑 │  右侧：背词助手面板（背单词/成就站/小部件）    │     │
│  │ 复习     │                                                │     │
│  │ 统计概览 │                                                │     │
│  │ 系统设置 │                                                │     │
│  └──────────┴──────────────────────────────────────────────┘     │
│  ═══════════ lib/anki/actions.ts（唯一 AnkiConnect 入口）═══════  │
│  ═══════════ lib/reasonix-addon/client.ts（配套插件 RPC）═══════  │
└──────────────┬─────────────────────────────────┬─────────────────┘
               ▼                                 ▼
   AnkiConnect :8765（v6）        Reasonix 配套插件 :8766（协议 v1）
   ─ 通用 CRUD / 查询 / 统计 / 媒体   ─ 原生 scheduler 队列 / 预计间隔 /
                                      撤销 / 精确计数 / 同步协调
               └──────────────┬─────────────────┘
                              ▼
            Anki collection + scheduler（唯一业务真源）
```

**关键分工（v2 架构红线）**：
- **AnkiConnect**（`lib/anki/actions.ts` 24 个类型化函数）：通用 CRUD、检索、统计、媒体。组件禁止直接 `invoke`/`fetch`。
- **reasonix-addon 插件**（`:8766`）：**v2 正式背词的必要组件**——只认 Anki scheduler，`session.start` 只接收 deckId，不筛选、不重排、不覆盖每日限额。未安装/不兼容时禁用精确学习入口，不静默降级。
- 旧 `findCards + shuffle + answerCards` 仅保留在"复习"兼容视图，不是正式背词入口。

## 4. 视图系统

### 4.1 侧边栏导航视图（6 个，`stores/app.ts` 的 `currentView` 驱动，无路由库）

| 视图 | 入口文件 | 能力 |
|---|---|---|
| 今日学习（默认） | `features/today/TodayView.tsx` | 当前 Profile 牌组今日新卡/学习中/复习计数；先选牌组，再以唯一 `deckId` 启动沉浸式学习 |
| 牌组浏览 | `features/BrowseView.tsx` | 三栏：牌组树（"新卡 已学/上限"Badge）→ 卡片列表（Anki 搜索 + 分页）→ 笔记预览；行操作（暂停/恢复、改期、编辑、删除，均确认弹窗） |
| 笔记编辑 | `features/EditorView.tsx` | 新建笔记（牌组+模板 → modelFieldNames 动态表单）；按 id 编辑（Sheet 面板，源码/预览双态）；图片粘贴上传 |
| 复习（兼容） | `features/ReviewView.tsx` | 旧自建复习流：选牌组 → 到期队列（is:due，上限 300，乱序）→ 四档评分；**非 v2 正式背词调度入口** |
| 统计概览 | `features/StatsView.tsx` | 汇总卡；记忆热力图（13/26/52 周，液态注水/经典双风格，8 主题）；牌组汇总表；增量同步/重建 |
| 系统设置 | `features/SettingsView.tsx` | 连接/外观/复习/统计/星系/数据 6 tab；另有 AppSettingsModal 弹窗形态 + 独立设置窗口 |

### 4.2 沉浸式学习会话视图（不入侧边栏）

| 视图 | 入口文件 | 能力 |
|---|---|---|
| 沉浸式日语学习 | `features/study/StudyView.tsx` | Anki scheduler 队首 → Lapis/自制字段映射 → 原生正背面 → 始终显示四档原生间隔 → 自动音频 → 即时撤销 → 简洁完成报告。状态机 `stores/studySession.ts`（10 态：idle/starting/front/revealing/back/answering/undoing/mapping/done/error）；插件 session v1 是唯一调度真源 |

## 5. 状态管理层（Zustand）

| Store | 文件 | 职责 |
|---|---|---|
| `app` | `stores/app.ts` | 视图切换（6 视图）、主题方向（石墨/极光/石板/碳/夜曲/琥珀 6 种 × 明暗 = 12 风格）、侧边栏折叠、圆角开关、沉浸助手面板、浏览注入查询 `browseQuery`、复习注入牌组 `pendingReviewDeck`；持久化 `ra.*` |
| `studySession` | `stores/studySession.ts`（+Types/+Utils 拆分） | v2 沉浸学习状态机：会话生命周期、卡片/词条、剩余计数、原生间隔、answeredCards、撤销、字段映射、profileKey 命名空间隔离 |
| `review` | `stores/review.ts` | 兼容复习流状态机：队列（300 上限）、四档评分（`answering` in-flight 锁 + 会话代际 epoch 防跨会话污染）、会话内 bury（零调度副作用） |
| `editor` | `stores/editor.ts` | 全局编辑面板单实例：`editingNoteId` / `newNoteOpen` |
| `settings` | `stores/settings.ts` | v1 设置持久化（`ra.settings.v1`）+ updateSetting/resetToDefaults |

**分层纪律**：查询型数据（牌组/卡片/笔记/模型）→ TanStack Query；命令式会话状态 → Zustand。会话状态不得塞进 Query。

## 6. 通信层（双通道 transport）

```
lib/anki/transport.ts  →  Tauri: invoke("anki_request") → Rust reqwest → AnkiConnect :8765
                         浏览器: fetch("/anki") → Vite dev proxy → AnkiConnect
lib/reasonix-addon/    →  invoke("reasonix_request") → 插件 :8766（固定 loopback，不接受前端传 URL）
```

- **AnkiConnect 唯一入口**：`lib/anki/actions.ts`（类型化函数 + `lib/anki/schemas.ts` zod 解析，字段名按官方 README 逐条核对）。
- **查询层**：`lib/anki/query.ts`（queryKeys 工厂 + 6 个 hooks：useDeckTree/useDeckConfigs/useCardSearch/useNotePreview/useModelNames/useModelFields）。
- **连接状态**：`lib/anki/useConnection.ts`（3s 轮询 version + requestPermission → checking/connected/disconnected；`useAnkiStatus` 供 App 根高频订阅，v5 prop-tracking 避免整树每 3s 重渲染）。
- **插件侧**：`client.ts`（RPC）/ `schemas.ts` / `transport.ts` / `capabilities.ts`（版本化能力协商 `status.capabilityVersions`）/ `retry.ts` / `bundledVersion.ts`（版本单一真源）。

## 7. 配套插件 reasonix-addon

- **位置**：仓库根 `reasonix-addon/`（Anki 25.09.2 配套插件 + Python unittest + 打包脚本）。
- **职责**：原生 scheduler 队列（`session.start/next_item/answer/undo`）、预计间隔、撤销（token 轮换）、`decks.today` 精确计数、同步协调（连接成功/会话结束自动同步，学习中不自动同步）。
- **分发**：NSIS 安装包内嵌 `.ankiaddon`（bundle resources）+ 前端 `PluginSyncCard` 安装引导；版本单一真源 = manifest.json `human_version`，`npm run addon:sync` 自动递增/打包/内嵌/生成 `bundledVersion.ts`。
- **授权**：首次询问并永久记住，跨 Profile/重启共享；工具 → Reasonix 设置… 原生 Qt 页面。

## 8. 数据与安全层

| 模块 | 文件 | 说明 |
|---|---|---|
| 统计 SQLite | `lib/db/stats.ts` | 三表（revlog 幂等 / deck_daily 聚合 / watermark 水位线），`cardReviews(startID)` 增量同步；仅 Tauri 模式 |
| 字段映射 | `lib/db/mappings.ts` | profileKey/modelId 命名空间隔离的一次性映射（标准 Lapis 自动识别，非标准模型走映射向导） |
| 媒体管线 | `lib/media.ts` | `read_media_file` → base64 → Blob URL（LRU 120）；失败/浏览器兜底 `retrieveMediaFile` |
| 消毒层 | `lib/dompurify.ts` | **卡片 HTML 统一消毒入口**：DOMPurify 单例 + `uponSanitizeAttribute` hook 仅放行媒体元素（img/audio/video/source/track）的 URI 属性（src/poster）blob: 值；on* 事件/srcdoc/href 一律默认规则 |

**卡片渲染安全模型（AGENTS.md §1.4）**：卡片 HTML 是不可信输入。安全模式 = DOMPurify + iframe `sandbox`（无脚本）；脚本模式仅用户显式开启（等同 Anki 原生信任级别）。

## 9. 特色功能模块

| 模块 | 位置 | 说明 |
|---|---|---|
| 沉浸式学习 | `features/study/` | 全屏无干扰；原生四档间隔、自动音频、即时撤销、完成报告 |
| 词汇识别/映射 | `features/vocabulary/` | Lapis 标准模型自动识别、字段重组、一次性映射向导 |
| 背词助手面板 | `components/companion/` | 右侧三 tab：背单词（迷你学习/词典）/ 成就站 / 小部件 |
| 成就系统 | `components/achievements/` | 成就墙/解锁弹窗/像素提示/数据 |
| 桌面小部件 | `components/widgets/` | 玻璃态天气/音乐/会议提醒/沉浸小部件视图 |
| 右键上下文菜单 | `components/ContextMenu.tsx` | 牌组树/卡片列表/复习会话/热力图四入口，morph 动画 + 键盘导航 |
| 动画图标 | `components/icons/animated/` | 34 个 Lucide Animated 规范图标（`useIconAnimation` 驱动，归位纪律） |
| 物理选项卡 | `components/MotionTabs.tsx` | pill/segment/underline 三形态 layoutId 弹簧 |
| 数字滚动 | `components/NumberTicker.tsx` | 汇总卡/报告/成就墙数值滚动动画 |
| 独立设置窗口 | `features/SettingsView.tsx` + `lib/window.ts` | `?view=settings` 独立 WebviewWindow |
| 错误边界 | `components/ErrorBoundary.tsx` | 全局渲染崩溃友好提示 |

## 10. UI/UX 特性

- **无边框透明圆角窗口**（Win10）：`decorations:false + transparent + shadow:false`，自绘标题栏（拖拽/双击最大化）+ WindowControls；根容器 `rounded-[var(--rx-r-l)]` 提供圆角；窗口级阴影 `.ra-window-shadow`（最大化自动去除）。
- **12 种视觉风格**：6 主题方向 × 明暗模式。
- **响应式侧边栏**：可折叠悬浮圆角卡片，折叠态 Tooltip。
- **玻璃态设计**：小部件/伴学面板毛玻璃效果。
- **通知**：ToasterLite（M0–M3 方案，zustand 驱动；sonner 已装未启用）。

## 11. 项目结构（v0.2 实际）

```
reasonix-anki/
├── src/
│   ├── main.tsx                  # createRoot + QueryClientProvider（staleTime 30s 全局）
│   ├── App.tsx                   # 外壳：Sidebar + currentView 切换 + 全局挂载层 + 自绘标题栏
│   ├── index.css                 # tailwind + @reasonix/ui/styles.css + 字体令牌 + rx-liquid CSS
│   ├── components/               # Sidebar / WindowControls / DisconnectedScreen / ToasterLite
│   │   ├── achievements/         # 成就系统（8 文件）
│   │   ├── companion/            # VocabCompanionPanel 背词助手（2475 行）+ ADHDVocabArcade
│   │   ├── widgets/              # 桌面小部件（10 文件）
│   │   └── icons/animated/       # 34 个 Lucide Animated 动画图标
│   │   （另含 AppSettingsModal/ContextMenu/ErrorBoundary/MotionTabs/NumberTicker/
│   │     PluginSyncCard/DiagnosticsCard/AboutCard/SettingsControls/Slider…）
│   ├── features/
│   │   ├── BrowseView.tsx / EditorView.tsx / ReviewView.tsx / StatsView.tsx / SettingsView.tsx
│   │   ├── browse/  editor/  review/           # 各视图子模块（DeckTree/CardTable/FieldEditor/ReviewSession…）
│   │   ├── today/                              # 今日首页（TodayDashboard + todayUtil）
│   │   ├── study/                              # 沉浸式学习（StudyView + studySession + lapisAdapter）
│   │   ├── vocabulary/                         # Lapis 识别与字段映射向导
│   │   └── settings/                           # 设置页 + heatmapPreview
│   ├── lib/
│   │   ├── anki/               # transport / actions（唯一入口）/ schemas / query / useConnection
│   │   ├── reasonix-addon/     # client / schemas / transport / capabilities / retry / bundledVersion
│   │   ├── db/                 # stats.ts（SQLite 三表）/ mappings.ts
│   │   ├── media.ts            # 媒体解析（Blob URL + LRU）
│   │   ├── dompurify.ts        # 卡片 HTML 统一消毒入口（blob: 白名单 hook）
│   │   └── utils.ts / window.ts / ease.ts
│   └── stores/                 # app / studySession(+Types/+Utils) / review / editor / settings
├── reasonix-addon/             # Anki 配套插件源码 + Python 测试 + 打包脚本（manifest 版本真源）
├── protocol/fixtures/v1/       # TS/Python 共享协议契约 golden 样本
├── src-tauri/
│   ├── src/commands.rs         # anki_request + reasonix_request + read_media_file + addon_package_path（刻意做薄）
│   ├── src/lib.rs              # 插件/state 注册
│   ├── capabilities/default.json  # 最小权限（core + opener + sql + window 控制）
│   └── tauri.conf.json         # NSIS currentUser；无边框透明圆角；bundle resources 内嵌插件
├── docs/                       # CHANGELOG / tech-plan / qa-runbook / official-docs-review / 本文件
├── scripts/                    # release.mjs / addon-sync.mjs / build-info.mjs
├── vendor/reasonix-ui-0.2.0.tgz  # @reasonix/ui 本地包（file: 安装）
└── AGENTS.md                   # 项目唯一权威指南（红线/API/纪律）
```

## 12. 开发命令

```bash
npm run dev            # 纯浏览器调试：localhost:1420，/anki → vite proxy → 8765
npm run tauri dev      # Tauri 窗口（改 Rust 自动重编译重启）
npm run build          # tsc + vite 生产构建
npm run test           # 前端 vitest
npm run test:addon     # 插件 Python unittest
npm run addon:sync     # ★ 改插件后必须：自动升 manifest 版本 + 打包 + 内嵌 resources + 生成 bundledVersion.ts
npm run addon:package  # 只打包 .ankiaddon 到 dist/
npm run build:info     # 注入 buildInfo.ts（版本/commit/构建时间）
npm run release        # 发布分发：校验干净 → addon:sync → build:info → tauri build → 产物收集到 dist/release/
npm run qa:preflight / qa:seed   # QA Profile 数据准备与闸门（调度开发只写独立 QA Profile）
npm run tauri build    # NSIS 安装包 → src-tauri/target/release/bundle/nsis/
```

**开发纪律要点**（详见 AGENTS.md §7）：调用 AnkiConnect 用 Node fetch 禁 curl（中文 GBK 假故障）；写操作不污染用户库（ceshi 牌组 + `reasonix-*-test` 标签回路测完清空）；每次改动提交前登记 CHANGELOG；改插件必跑 `addon:sync`；修复/功能改动提交前走 review 子代理审查。

## 13. 状态与路线

- **当前**：v0.2 开发态——v2 的 P0–P5 已落地（今日首页、沉浸学习、插件会话、Lapis 映射、统计热力图），P6 自动同步已落地，P7 稳定性进行中（会话持久化/长内容性能已完，跨插件重启深测、Profile 切换深测未完），P8 发布验收未完成。
- **下一步**：详见 [`tech-plan.md`](tech-plan.md)（v2，已批准）。
- **git**：公开仓库 https://github.com/hoangmaituan882-hue/reasonix-anki（分支 master）。
