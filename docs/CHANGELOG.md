# 变更日志（Changelog）

> **硬性纪律**：每次对仓库的任何改动（代码、文档、配置、UI、插件）都必须在本文件追加一条记录，
> 与 git commit 同步完成。最新改动放在最上方。格式：`- **类别**：描述（关联 commit / 日期）`。

## 未发布（工作区）

### 插件自托管（Bundled Addon）
- **插件安装包内嵌软件（Tauri bundle resources）**：`tauri.conf.json` bundle.resources 加入 `reasonix-anki-addon.ankiaddon`，随 NSIS 安装包分发；Rust 新 command `addon_package_path`（`BaseDirectory::Resource` 解析安装包绝对路径）
- **addon:sync 同步复制（Artifact Sync-on-Change）**：新增 npm script `addon:sync`（`scripts/addon-sync.mjs`）——重新打包 → 复制到 `src-tauri/resources/` → 生成 `src/lib/reasonix-addon/bundledVersion.ts`；打包脚本自检包内 manifest 版本与真源一致（防陈旧产物）
- **版本单一真源（manifest.json）**：`runtime.py` 的 `ADDON_VERSION` 改为动态读 manifest `human_version`（失败兜底 0.1.1）；`package_addon.py` 新增 `addon_version()` 校验非空
- **前端安装引导 + Staleness Guard**：新增 `PluginSyncCard`（SettingsSheet 插件与同步组接入真实内容）——对比运行中 `status.addonVersion` vs 内置 `BUNDLED_ADDON_VERSION`，未安装/版本过旧/已就绪三态，`openPath` 打开安装包目录 + 安装步骤文案；TodayView 未就绪提示补充设置引导
- **AGENTS.md §7.2 纪律 8**：修改插件必须递增 manifest `human_version` + `npm run addon:sync` + 登记 changelog，内嵌包不得与源码脱节
- 测试：插件 unittest 99→101（版本真源 2 用例）、前端 vitest 72→75（PluginSyncCard 3 用例）

### 插件（reasonix-addon）
- **修复三缺口（多代理审查发现）**：
  - **bridge 超时倒挂**：`AnkiOperationBridge` 默认 timeout 10s → 12s（Anki operation 预算需 < Rust 端到端 15s，留往返余量，给大牌组 `next_item` 渲染空间）
  - **cardKind / card.media 接线**：`anki_adapter` 新增 `_infer_card_kind`（模板名关键词，与前端 `lapisAdapter` 对齐：audio/click/word_sentence/sentence/vocabulary）与 `_collect_media`（提取 `[sound:]`/`img`/`audio src`/`url()` 本地文件名，过滤路径分隔与外链，去重保序）；`next_item` 改用两者并复用 `question`/`answer` 避免重复渲染
  - **decks.today 实现**：插件新增 `decks.today` action（`adapter.today_counts` 用 Anki 原生 `sched.deck_due_tree(deck_id)` 含子牌组累计 + `tomorrow_due`，返回 new/learning/review/tomorrowDue）；service 分发、protocol 请求/响应校验、runtime CAPABILITIES、golden fixtures（`decks-today.request/response.json`）；前端 `schemas.ts` 加 `decksTodayResponseSchema`/`parseDecksTodayResponse`、`client.ts` 加 `reasonixDecksToday`（今日首页当前仍走 `getDeckStats`，可后续切换到精确计数）
- **decks.today API 修正（对照 addon-docs 官方文档 + 本机 Anki 25.09.2 源码实核）**：初版误用 `sched.counts(deck_id=..., include_child_decks=...)`——真实签名是 `counts(card=None) -> tuple`（无牌组参数）；改为正确的 `sched.deck_due_tree(deck_id)`（Rust backend `deck_tree`，只读无副作用，节点含 `new_count`/`learn_count`/`review_count`/`total_in_deck`，scheduler 每日限额口径，含子牌组累计）；`decks.id()` 解析 deck_id；同步修正 fake 与测试断言
- 测试：插件 unittest 93 → 99（新增 cardKind/media/today_counts/protocol fixture/service 分发 6 用例）；前端 schemas 测试 +1

---

## 2026-08-10

### 文档
- **建立变更日志机制**：新增 `docs/CHANGELOG.md`（补录全部近期改动）；AGENTS.md §7.2 新增纪律 7——每次改动提交前必须登记 changelog（即将提交）
- **README 更新到 v2 现状**：功能表补今日学习/沉浸学习/设置；新增配套插件 reasonix-addon 节；窗口外观节（无边框圆角 + 自绘阴影 + 悬浮面板侧边栏 + 圆角开关）；路线图 P0–P8；修正 `decks.today` 表述（实际走 `getDeckStats`）（commit `4ab4782`）
- **GitHub 仓库 About 与 topics**：设置仓库描述与 10 个 topics（anki / anki-addon / anki-connect / japanese-learning / react / tailwindcss / tauri / tauri-app / typescript / vite）（API 操作，非 commit）

### 窗口外观
- **窗口级阴影与边框**：Tauri 无边框窗口自绘 `box-shadow`（`.ra-window-shadow`），根容器外层 12px 留白；深色模式独立阴影组；最大化时自动去掉间隙/圆角/阴影（监听 `isMaximized` + `onResized`）（commit `ba88a6d`）

### 侧边栏
- **展开态图标列对齐**：品牌区 `px-4`→`px-5`、主题区 `p-3`→`px-5 py-3`，统一到导航图标列 20px 基准（commit `a7b318e`）
- **悬浮面板（Floating Panel）**：整块侧边栏改为悬浮圆角卡片（`m-3` 12px 间隙 + `rounded-[var(--rx-r-l)]` + 软边框），移除贴边 `border-r` 结构（commit `bbaaac7`）
- **收缩态几何修复**：收缩态导航按钮 `h-8 w-8 justify-center`、卡内 `p-0`、收缩切换按钮 `self-center`；悬浮卡容器内边距加 `transition-[padding]` 对齐宽度过渡（commit `16c0aba`）
- **上下两张悬浮卡布局**（后被悬浮面板重构取代）：品牌卡 + 功能卡（commit `8fde509`）

### 设置界面
- **文字排版与交互审查修复**：说明文字 `text-2xs+faint`→`text-xs+dim`；Switch/Select 加 `aria-describedby` 关联；主题方向 Label `htmlFor` 关联；布局变体切换器从伪 tablist 降级为 `role=group`+`aria-pressed` 分段单选组；补"关于"骨架卡；SkeletonRow 高度对齐真实控件（commit `ecfbf1b`）
- **设置齿轮被 header 拖拽吞 click**：补 `onMouseDown`/`onDoubleClick` 的 `stopPropagation`（Tauri 无边框窗口拖拽会吞掉后续 click）（commit `c946e2d`）
- **外观组接入真实控件**：主题方向 Select（6 方向）+ 深色模式 Switch，移除外观组"即将接入"标记；`src/test/setup.ts` 补 `Element.scrollIntoView` polyfill（Radix Select 依赖，node 环境守卫）（commit `5db5242`）
- **设置抽屉骨架预览**：header 齿轮入口（主布局 + 沉浸学习态两处）+ Sheet 右抽屉；三布局变体预览（分栏/标签/卡片，持久化 `ra.settingsDesign`）；圆角开关（`ra.roundedCorners`，纯 CSS 切换根容器圆角）（commit `c474333`）

### v2 主体
- **v2 日语背词工作台**：配套插件 reasonix-addon（25.09.2 调度桥接、session 协议、幂等 requestId、health 自监测、同步幂等、QA 闸门）、今日首页、沉浸学习、Lapis 适配与映射向导、protocol golden fixtures、版本升至 0.1.1（commit `5f3b003`，大提交含 P0–P6 全部内容）

---

## 模板

（新增改动时复制此模板追加到"未发布"区）

```markdown
### 类别
- **标题**：描述（commit `xxxxxxxx`）
```
