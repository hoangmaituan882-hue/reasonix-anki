# 变更日志（Changelog）

> **硬性纪律**：每次对仓库的任何改动（代码、文档、配置、UI、插件）都必须在本文件追加一条记录，
> 与 git commit 同步完成。最新改动放在最上方。格式：`- **类别**：描述（关联 commit / 日期）`。

## 未发布（工作区）

### 黑体失效根因修复 + 插件与同步 tab 排版重构
- **根因修复（层叠）**：上一轮移植的排版工具类（`.heading-*`/`.text-body-*`）未包 `@layer`，未分层样式优先级高于 Tailwind v4 `@layer utilities`，`.text-body-sm{font-weight:500}` 把同元素 `font-bold(700)` 全部压掉——全站黑体失效。修复：工具类包进 `@layer components`（Tailwind v4 层序 theme<base<components<utilities，700 恢复覆盖 500）；产物验证 `heading-2xl` 前为 `@layer components{`
- **插件 tab 排版重构**（三卡片）：CardTitle 升 `text-[18px] font-bold` 区块标题规格；状态 Badge 去 `font-normal`（恢复 `text-badge-xs` 自带 700）；版本数值 `font-medium`→`font-bold`；诊断状态值加 `font-semibold`；Alert 标题与安装按钮升 `font-bold`
- 验证：tsc 零错误；前端 26 文件 / 101 测试全绿；vite build 成功

### 设置界面排版阶梯移植 + 字重对比强化
- **字体工具类移植**：src/index.css 新增字号令牌（--font-size-xxs~3xl：10/12/14/16/18/20/24/32/48px）与字重令牌（--font-weight-regular/medium/bold/extrabold + 语义映射）+ 工具类 `.heading-2xl/xl/lg/md`（800/700 字重）、`.text-body-nm`（16px/500）、`.text-body-sm`（14px/500）、`.text-caption-xs`（12px/500）、`.text-badge-xs`（12px/700）、`.text-micro-xxs`（10px/500）——AppSettingsModal/SettingsView 里 74 处既有用法从此获得真实定义
- **字重对比强化**（用户：字更大、黑色重更明显）：ToggleRow 标题 16px 600→700；Checkbox 条目标签 15px 600→700；区块标题 18px 600→700（CheckboxGroup/SectionBlock/SettingCard）；全部说明文字 `--rx-fg`/65→/80（不透明度提升，更清晰）；Tab 导航选中态 font-bold（700）
- 验证：tsc 零错误；前端 26 文件 / 101 测试全绿；vite build 成功

### 插件设置排版适配（对齐设置弹窗字号字重）
- **PluginSyncCard / DiagnosticsCard / AboutCard** 排版对齐 AppSettingsModal 弹窗规范：CardTitle `text-sm`→`text-body-nm font-bold`；描述 `text-xs`→`text-body-sm`；内容行 `text-xs`→`text-body-sm`；辅助文本/徽章 `text-2xs`→`text-caption-xs`/`text-badge-xs`；Alert 标题加 `font-semibold`
- 验证：tsc 零错误；前端 26 文件 / 101 测试全绿；vite build 成功

### 设置弹窗（AppSettingsModal）+ v2 设置功能回归
- **弹窗移植**：`components/AppSettingsModal.tsx`（2186 行）从 v1 移植，HEATMAP_THEMES import 改指向 `features/settings/heatmapPreview`
- **双入口**：侧边栏「系统设置」点击 → 打开设置弹窗（v1 默认形态）；hover 显示 ExternalLink 按钮 → 独立设置窗口（v2 已有）；App.tsx 挂载 `<AppSettingsModal />`
- **v2 设置回归**：弹窗新增「插件与同步」tab，回归 v2 的 PluginSyncCard（插件版本一致性 + 安装引导）/ DiagnosticsCard（Anki/8765/插件/Profile 四诊断）/ AboutCard（版本/commit/构建时间）——此前因 SettingsSheet 删除成为孤儿组件，现重新接入
- 验证：tsc 零错误；前端 26 文件 / 101 测试全绿；vite build 成功

### 右侧背词助手面板（完整移植 v1）
- **子系统移植**：`components/achievements/`（8 文件：成就墙/解锁弹窗/像素解锁提示/数据）、`components/widgets/`（10 文件：桌面小部件对话框/玻璃天气/玻璃音乐/会议提醒/沉浸小部件视图/图鉴）、`components/companion/`（VocabCompanionPanel 2475 行 + ADHDVocabArcade 背词游戏 + index）
- **集成**：`stores/app.ts` 加 `rightPanelOpen`（`ra.rightPanelOpen` 持久化，默认开）+ `toggleRightPanel`；App.tsx header 加「沉浸助手」CloudSun 开关按钮（连接后显示，脉冲动画指示开启态）+ `AnimatePresence` 挂载右侧面板（连接且开启时显示）
- 面板 3 tab：背单词（沉浸式迷你学习/词典）/ 成就站 / 小部件
- 验证：tsc 零错误；前端 26 文件 / 101 测试全绿；vite build 成功

### 右键上下文菜单（完整移植 v1）
- **组件**：移植 `components/ContextMenu.tsx`（771 行完整实现：morph 展开动画、触屏长按、键盘导航/typeahead、aria 语义）；2 冒烟测试
- **牌组树**（DeckTree）：右键弹出「开始复习此牌组（R）/ 在列表中筛选 / 添加新笔记至此牌组 / 查看学习统计 / 复制牌组名称」
- **卡片列表**（CardTable）：右键「编辑笔记（E）/ 暂停或恢复卡片（Space）/ 修改到期日改期…（Dialog 支持 0/1/3-7/1! 语法）/ 复制正面 / 复制卡片 ID / 删除笔记及卡片…（确认 Dialog）」；用 mutation + queryKeys 失效刷新
- **复习会话**（ReviewSession/CardRenderer）：右键「今天暂不复习（B）/ 快速修改此卡笔记（E）/ 暂停这张卡片 / 重设为新卡·重学 / 复制正面 / 复制背面 / 复制卡片 ID」；CardRenderer 新增 onContextMenu prop + iframe contentDocument 右键事件转发（跨沙箱 iframe 坐标换算）
- **统计热力图**（StatsView）：单元格右键「检索这天复习的所有卡片（复制 rated 语法）/ 复制日期 / 复制检索语法」
- 验证：tsc 零错误；前端 26 文件 / 101 测试全绿；vite build 成功

### 独立设置窗口权限补齐
- **capabilities**：`default.json` windows 列表加入 `settings`（独立设置窗口继承 opener/sql/core 权限）；permissions 加 `core:webview:allow-create-webview-window`（`openSettingsWindow` 动态创建 WebviewWindow 的运行时权限）
- 验证：cargo check 通过；standalone 模式隐藏独立窗口按钮逻辑确认（SettingsView L189）

### 设置页移植（v1 SettingsView 引入，移除 SettingsSheet 抽屉）
- **基础设施**：移植 `stores/settings.ts`（`ra.settings.v1` 持久化 + updateSetting(s)/resetToDefaults）、`SettingsControls.tsx`（Checkbox/CheckboxGroup/ToggleRow）、`Slider.tsx`、`lib/window.ts`（openSettingsWindow 跨窗口）、`lib/ease.ts`；补 `motion`/`tailwind-merge` 依赖
- **设置页本体**：移植 `features/SettingsView.tsx`（连接/外观/复习/统计/星系/数据 6 tab）；热力图预览构件（HEATMAP_THEMES/FluidWaveWaterLines + rx-wave CSS）抽取到 `features/settings/heatmapPreview.tsx`（不动主项目 StatsView）
- **入口**：App 齿轮按钮与 Sidebar「系统设置」导航项 → `setView("settings")` 渲染 SettingsView（不依赖 Anki 连接）；沉浸学习态移除齿轮；`main.tsx` 支持 `?view=settings` 独立窗口（SettingsWindowLayout）；独立窗口按钮在 standalone 时隐藏
- **清理**：删除 `SettingsSheet.tsx`/`SettingsSheet.test.tsx`；`stores/app.ts` 删 SettingsDesign/SETTINGS_DESIGNS/settingsDesign（`ra.settingsDesign` 键不再读取）；app.test 同步清理；新增 SettingsView 冒烟测试
- 验证：tsc 零错误；前端 24 文件 / 97 测试全绿；vite build 成功

### 插件审查修复（双 review）
- **插件侧**：UNDO_MISMATCH 后回滚 bookkeeping（防 finish 把已回滚卡计入统计）；ease 校验改精确 int（排除 `True`==1 / `1.0` 混过集合成员测试）；补 2 测试（109 全绿）
- **前端侧**：monitorSync 30×1s→45×1s（与插件 SYNC_START_TIMEOUT=30s 边界错位，大集合同步不再误报 error）；resume 复查 REQUIRED_CAPABILITIES；PluginSyncCard 版本方向区分（插件旧"版本过旧"/插件新"版本不一致"）
- **误报澄清**：TodayView 自动同步静止分支已存在（`!["idle","error"].includes(syncState)`），加注释防误改；release.mjs 注释对齐（bump 在开发时 addon:sync 发生，release 仅同步）
- 审查结论：插件内部无阻塞项；前后端合作其余问题为 nits（schemas 字段多于 Python 校验、undo 失败不缓存、weak_card_ids O(n²)、decks.today 无 token 注释）

### 架构纵深（稳定性）
- **前端错误边界**：`ErrorBoundary` 全局包裹（main.tsx 渲染根，覆盖全部视图）——渲染崩溃显示友好提示 + 重载按钮 + 错误消息（供诊断），console 记录不白屏；3 测试
- **媒体预取**：StudyView 新卡到达时对 `card.media` 并行 `resolveMediaUrl` 预热（media.ts LRU 命中，渲染/翻面零等待）；失败静默不阻塞；disposed 防护
- 测试：前端 101→104；tsc/build 通过

### 文案与提示优化
- **studySession 错误文案用户友好化**：4 处（"Anki 尚未就绪（未打开牌组库）"、"配套插件版本过旧请重装"（隐藏技术能力名）、"学习期间配置已切换"、"状态不允许恢复请返回首页"）；保留已清晰的同步/权限文案
- **DisconnectedScreen 补配套插件引导**：新增第 4 步（工具 → 插件 → 从文件安装 `.ankiaddon`，指向设置页引导）——首次连接用户装完 AnkiConnect 后不再卡住
- 测试：前端 98→101（DisconnectedScreen 3 用例）；插件 107、tsc/build 通过

### 发布层审查修复（review）
- **release 幂等性**：`buildInfo.ts` 加入 `.gitignore` 并移出 git 跟踪（BUILD_TIME 每次必变不再污染工作区，第二次 release 不再因校验中止）；`release.mjs` commit 改 `git rev-parse` 直取（不再依赖生成文件正则/静默 unknown）；非 git 环境报友好错误
- **DiagnosticsCard**：版本不匹配区分方向（插件过旧请重装 vs 应用较旧请升级）；Profile fail 显示"未知（插件未连接）"；CheckRow 加 `role=status`（无障碍）
- **SettingsSheet**：分栏/标签导航列表补"连接诊断"（与实际渲染顺序一致）
- **测试补强**：`checkCleanWorkspace` 抽为可测导出（可注入 exec）+ 3 用例；DiagnosticsCard 补插件 fail/Profile fail 2 用例
- 测试：前端 93→98；插件 107、tsc/build 通过

### 发布分发层（P8，手动分发）
- **构建产物管线**：新增 `npm run release`（`scripts/release.mjs`）——校验工作区干净 → `addon:sync`（纪律 8）→ `build:info` → `tauri build` → 产物复制到 `dist/release/ReasonixAnki-v{版本}-{commit}/`（NSIS 包 + `.ankiaddon` + `RELEASE.json` 清单，防旧产物混淆）；`npm run build:info`（`scripts/build-info.mjs`）注入 `buildInfo.ts`（APP_VERSION/GIT_COMMIT/BUILD_TIME）
- **连接诊断页**：新建 `DiagnosticsCard`（Anki 运行 / :8765 可达 / 插件版本匹配 / Profile 状态 4 项），接入设置页插件与同步组下方
- **关于组**：`AboutCard`（版本/commit/构建时间）替换骨架，设置页展示
- 首次连接向导复用既有 DisconnectedScreen/PluginSyncCard/TodayView 提示串联（未重复造组件）
- 测试：前端 90→93（DiagnosticsCard 3 用例）；插件 107、tsc/build 通过

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
