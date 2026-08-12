# 变更日志（Changelog）

> **硬性纪律**：每次对仓库的任何改动（代码、文档、配置、UI、插件）都必须在本文件追加一条记录，
> 与 git commit 同步完成。最新改动放在最上方。格式：`- **类别**：描述（关联 commit / 日期）`。

## 未发布（工作区）

### 能力协商审查补强（review）
- **补测试**：`hasCapability` 非法 installed 版本保守拒绝 + capabilityVersions 缺键放行（capabilities.test 7→9）
- **schemas 收紧**：`capabilityVersions` 键/值均 `min(1)`（与 protocol.py 非空一致）
- **fixture 更新**：`status.response.json` 补 `capabilityVersions` 示例 + `addonVersion` 同步 0.1.2 + capabilities 补 decks.today/sync.*；旧结构用例显式删字段验证向后兼容
- 测试：插件 107、前端 88→90；tsc/build 通过

### 能力协商升级（v2 协议）
- **`status.capabilityVersions`（版本化能力协商）**：插件 `CAPABILITY_MIN_VERSIONS` 静态映射（能力 → 引入版本，如 `decks.today`=0.1.1），`status` 新增 `capabilityVersions` 字段；`capabilities` 保持 string[] 向后兼容
- **协议校验**：`capabilityVersions` 可选（Record<string,string>），旧插件无此字段仍通过；新增协议测试（合法/非法/向后兼容）
- **前端 `hasCapability(status, name, minVersion?)`**：能力存在性 + 版本门槛检查（`versionNumber` semver 比较）；`Pick` 类型兼容精简/完整 status；studySession 的 REQUIRED_CAPABILITIES 检查与 TodayView 的 sync.start/session.start 检查改用 `hasCapability`
- 测试：插件 106→107（协议）、前端 81→88（capabilities 7 用例）；tsc/build 通过

### 版本自动递增（真·自动）
- **`addon:sync` 自动递增版本**：`scripts/addon-sync.mjs` 新增 git 检测（`reasonix-addon/` 未提交变更 → patch+1，幂等防重复），移除人工递增要求；`parseVersion`/`bumpPatch` 纯函数 + 3 单元测试；main 入口守卫（import 测试不执行副作用）；vitest include 扩展 `scripts/*.test.mjs`
- **AGENTS.md 纪律 8 更新**：改插件只需 `npm run addon:sync`（自动递增 + 打包 + 复制 + 生成）；**新增纪律 9**：修复/功能改动后必须 AI 审查核验版本四源一致与快照/缓存无回归
- 实机验证：无源码变更不 bump（0.1.2 保持）、有变更 0.1.2→0.1.3、重复跑幂等

### 审查修复（代码质量与稳定性）
- **快照恢复类型校验（review should-fix）**：`_resume_from_snapshot` 逐项校验（answeredCards/startedAt/lastAnsweredCardId/answerHistory 脏条目跳过），脏快照放弃恢复走全新会话，不崩 start；补坏快照容错测试
- **entrypoint 读写单元（review should-fix）**：`write_config` 改为接收合并函数，读+合并+写在 `run_on_main` 内串行执行，消除调用线程读、主线程写的授权/会话互相覆盖窗口
- **blob 缓存回退（review should-fix）**：`media.ts` 新增 `peekMediaUrl`；`ProcessResult` 记录 `mediaNames`；`processHtml` 缓存命中时校验 blob 仍有效（media LRU revoke 后重处理）；真 LRU（delete+set 刷新迭代序）
- **finish 清 OpChanges（review nit）**：`finish` 清 `_last_operation_changes`（与 invalidate 一致）
- 测试：插件 105→106（坏快照容错）、前端 78→79（blob 失效重处理）；tsc/build 通过

### 稳定性（P7）
- **插件版本递增 0.1.1→0.1.2 + addon:sync**：P7 修复改插件代码，按纪律 8 递增 manifest human_version 并重跑 `npm run addon:sync`（重新打包 + 复制 resources 内嵌包 + 生成 bundledVersion.ts）；runtime 兜底常量同步 0.1.2（版本真源测试拦截了遗漏）
- **跨插件重启会话持久化**：`SessionManager` 支持持久化快照（sessionId/deckId/profileKey/lastAnsweredCardId/answeredCards/answerHistory 限 500/startedAt 墙钟），按 profileKey 隔离存于 addon config `session` 映射；`start` 同 deck+profile 快照恢复（active_item=None 重取 scheduler 队首、幂等 commands 不持久化）；`answer`/`undo` 后保存、`finish`/`invalidate`/PROFILE_CHANGED 清理；`durationMs` 改墙钟避免跨重启负值；entrypoint 注入 config 读写
- **entrypoint 配置写入竞态修复（交付检查）**：提取统一 `write_config` 通道；`persist_session_snapshot` 基于最新 `getConfig` 合并（授权与会话快照不再互相覆盖）
- **长内容渲染性能**：`CardRenderer.processHtml` 结果模块级 LRU 缓存（键=html+allowScripts+字段值，MAX 64），撤销回跳/翻回同一卡跳过整个处理链路（两次 DOMParser + 媒体解析）；`srcDoc` useMemo 包裹；`resolveMediaUrl` 已有内部 LRU 复用
- 测试：插件 101→105（持久化 4 用例）、前端 75→78（CardRenderer 缓存 3 用例）；tsc/build 通过

### 简洁性重构（纯重构，行为不变）
- **测试重复代码提取**：`createMemoryStorage` 提取到 `src/test/helpers.ts`（3 处重复实现 → 共享导入，app.test/SettingsSheet.test/Sidebar.test）
- **studySession.ts 拆分（601→主体+2 模块）**：类型迁至 `studySessionTypes.ts`（NativeEase/StudyPhase/StudySessionApi/StudySessionState 等），工具与 `REQUIRED_CAPABILITIES` 迁至 `studySessionUtils.ts`；studySession.ts import + re-export 保持对外 API 不变
- **TodayView.tsx 拆分（413→编排）**：UI 组件迁至 `TodayDashboard.tsx`，类型/纯函数迁至 `todayUtil.ts`（TodayDeckRow/dueCount/summarizeTodayDecks）；TodayView 保留数据编排并 re-export 兼容测试导入
- 验证：插件 102、前端 75 全绿；tsc/build/cargo check 通过

### 审查修复（skill:review）
- **blocking：`today_counts` 误用 `decks.id(deck_id)`**——Anki 25.x `DeckManager.id(name: str, create=True)` 按名字查/建，传 int 会 PyO3 TypeError 或创建垃圾牌组；改为直接 `sched.deck_due_tree(deck_id)`（接受 DeckId 位置参数），删掉误导性 `FakeDecks.id` mock（其掩盖真实 API 差异）
- **`PluginSyncCard` 打开方式**：`openPath`（会用关联程序打开 .ankiaddon）改 `revealItemInDir`（资源管理器中定位文件，`opener:default` 已含权限）
- **`addon:sync` 挂入 `beforeBuildCommand`**：`npm run addon:sync && npm run build`，防改 manifest 忘同步产生陈旧 bundledVersion
- **兜底版本断言**：`test_runtime.py` 新增"兜底常量 == manifest 真源"测试，防升版后前端误报 stale；`PluginSyncCard.test.tsx` 版本断言改引用 `BUNDLED_ADDON_VERSION`
- 测试：插件 unittest 101→102、前端 75 全绿

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
