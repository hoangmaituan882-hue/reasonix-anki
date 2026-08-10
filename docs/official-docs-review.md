# Reasonix Anki v2 — 官方文档复审记录

> 复审日期：2026-08-10  
> 用途：记录上游官方事实、版本边界与对项目的影响。  
> 权威关系：本文件不是产品规格；已经批准的实施决策只写入 [`tech-plan.md`](tech-plan.md)，长期硬边界只写入仓库根目录 [`AGENTS.md`](../AGENTS.md)。

## 1. 结论摘要

1. AnkiConnect 继续适合通用 CRUD、媒体、统计和 Profile 查询，但其公开 `answerCards` / `guiUndo` 契约不足以提供 Reasonix 所需的精确会话队列、四档 scheduling states、幂等回答和可核对撤销载荷。
2. 精确学习流需要配套 Anki 插件直接适配 Anki scheduler；collection 访问必须使用 Anki 的 operation 队列，Qt/UI 操作留在主线程。
3. Anki 25.09.2 的 `get_queued_cards()` 没有“只新卡/只旧卡”参数。Reasonix 不应制造第二套模式语义；选牌组后应直接消费原生调度队列。
4. Filtered Deck 会移动卡片并引入自己的收集/复习顺序，不适合作为“只新/只旧”的透明实现。
5. Profile、临时关闭 collection 和同步都是协议边界。所有本地缓存必须按 Profile 隔离；首次/全量同步的 Upload/Download 决策必须交回 Anki。
6. shadcn/ui、Radix、Lucide 和 Tauri v2 的官方约束已经转化为 UI 组合、弹层焦点、图标无障碍和最小 capability 规则。

## 2. 阅读范围与版本

| 主题 | 官方入口 | 本次使用范围 |
|---|---|---|
| AnkiConnect | [GitHub 旧镜像](https://github.com/FooSoft/anki-connect)、[SourceHut 当前仓库](https://git.sr.ht/~foosoft/anki-connect) | API v6 README、授权、评分、GUI 撤销、同步/Profile 能力 |
| Anki 插件 | [Writing Anki Add-ons](https://addon-docs.ankiweb.net/) | 插件生命周期、hooks、后台 operation、Qt 线程边界 |
| Anki scheduler | [25.09.2 scheduler v3 源码](https://github.com/ankitects/anki/blob/25.09.2/pylib/anki/scheduler/v3.py) | `get_queued_cards()`、下一状态与队列适配边界 |
| Anki 用户手册 | [Filtered Decks](https://docs.ankiweb.net/filtered-decks.html)、[Profiles](https://docs.ankiweb.net/profiles.html)、[Syncing](https://docs.ankiweb.net/syncing.html) | 过滤牌组、Profile 隔离、同步冲突与全量同步 |
| shadcn/ui | [官方文档](https://ui.shadcn.com/docs) | Open Code、组合方式、Tailwind/CSS variables |
| Radix UI | [Primitives 介绍](https://www.radix-ui.com/primitives/docs/overview/introduction)、[Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)、[Popover](https://www.radix-ui.com/primitives/docs/components/popover) | Portal、焦点、Esc、外部交互、碰撞处理 |
| Lucide | [Lucide React](https://lucide.dev/guide/packages/lucide-react)、[Accessibility](https://lucide.dev/guide/advanced/accessibility) | 按需导入、SVG 属性、无障碍名称 |
| Tauri | [Tauri v2 中文文档](https://v2.tauri.app/zh-cn/)、[从前端调用 Rust](https://v2.tauri.app/zh-cn/develop/calling-rust/)、[Capabilities](https://v2.tauri.app/security/capabilities/) | command、异步与错误、权限边界 |

版本判断以项目当前实机 Anki 25.09.2 与 Tauri v2 为准。Anki 内部 Python API 不是跨版本稳定的公开网络协议，后续升级必须重新跑 P1 调度契约测试。

## 3. AnkiConnect

### 3.1 仓库与文档真源

- GitHub `FooSoft/anki-connect` 页面当前只保留“仓库已永久迁移到 SourceHut”的说明；它不再承载完整 API README。
- 当前 API 阅读入口应使用 SourceHut 仓库 README。项目文档和代码注释不应继续把 GitHub 镜像称为 API 真源。
- AnkiConnect 是由 Anki 内运行的本地 HTTP 插件；Anki 必须由用户启动并保持运行。

项目影响：Reasonix 保留 `127.0.0.1:8765` 通道和 AnkiConnect 通用 action 封装，但官方链接统一指向 SourceHut，GitHub 仅作为迁移说明或历史入口。

### 3.2 授权与请求契约

- API 请求使用 `action`、`version` 与可选 `params`；当前 README 示例使用协议版本 6。
- `requestPermission` 的结果字段是 `permission`、`requireApiKey` 和 `version`。配置了 API key 后，后续请求体需携带 `key`。
- 授权行为属于 Anki 侧安全边界；前端不能假设 `requestPermission` 永远静默。

项目影响：`PermissionInfo` 使用 `requireApiKey?`，不使用旧的 `requireKey?`；所有响应继续在 TS 入口做运行时校验。

### 3.3 为什么不能只靠 `answerCards`

官方 `answerCards` 契约只接收 `{ cardId, ease }`，ease 为 1–4，并返回对应卡片是否存在/受理的布尔结果。README 没有为它定义以下 Reasonix 会话能力：

- scheduler 指定的下一张与完整原生队列；
- 当前卡四档 scheduling states / 预计间隔；
- `expectedCardId` 并发保护；
- `requestId` 幂等与重复评分恢复；
- 会话锁、Profile 锁和同步锁。

项目影响：`answerCards` 可以留给现有 v0.1 兼容复习流和通用操作，但不能驱动 v2 正式学习会话。

### 3.4 `guiUndo` 的边界

官方 README 只承诺 `guiUndo` 撤销最后一个 GUI action/card，并返回成功或失败。这个返回值不包含被恢复的 cardId、恢复后的活动卡、队列快照或撤销完成后的会话载荷。

项目影响：v2 不能把 `guiUndo` 的单个布尔值当成精确撤销协议。配套插件需要在 Anki 原生撤销之后重新读取 scheduler 状态，并返回可供 Reasonix 核对的恢复结果。

## 4. Anki 插件开发文档

### 4.1 生命周期与 hooks

- 插件模块可能在 Profile/collection 尚不可用时加载，不能在模块 import 阶段假定 `mw.col` 已存在。
- Profile 打开/关闭、collection 临时关闭/恢复和同步均有对应 hooks；插件应以这些事件维护自身可用状态。
- collection 在全量同步、导入导出等流程中可能临时不可用。

项目影响：配套插件的 `status` 必须明确返回 Profile、collection 与 sync 状态；关闭或切换期间拒绝新的学习写请求，恢复后重新核对活动会话。

### 4.2 后台 operation 与线程边界

- 官方文档建议使用 `QueryOp` 执行读取类后台任务，使用 `CollectionOp` 执行会修改 collection 的操作，以便与 Anki 其他 collection 操作序列化。Anki 25.09.2 的真实构造契约是 `QueryOp(parent=, op=, success=)`，而 `CollectionOp(parent, op)` 通过 `.success()`/`.failure()` 注册回调；`CollectionOp` 的 `op` 返回值必须是 `OpChanges` 或带 `.changes` 的结果，Reasonix 桥接层因此包装协议响应并保留原生 changes。
- `DeckManager.select()` 是丢弃返回值的兼容方法；它内部调用的 `set_current()` 才返回 `OpChanges`。因此 `session.start` 直接调用 `set_current(deckId)` 并走 `CollectionOp`，不能把牌组选择误当成纯查询。`Collection.undo()` 返回 `OpChangesAfterUndo`，桥接结果需再展开其内层 `.changes` 后交给 Anki operation hooks。
- 后台 operation 中不得直接调用 Qt/UI；成功/失败回调和界面更新留在主线程。
- 外部 HTTP 监听线程不应直接访问 `mw.col`。

项目影响：Reasonix 插件的 HTTP 层只负责解析、鉴权和投递任务；scheduler/collection 工作进入 Anki operation 队列，权限提示与 UI 反馈回到主线程。

## 5. Anki 25.09.2 scheduler 与用户手册

### 5.1 `get_queued_cards()` 的真实接口

25.09.2 `pylib/anki/scheduler/v3.py` 中 `get_queued_cards()` 暴露 `fetch_limit` 与 `intraday_learning_only`，没有 `new_only`、`review_only` 或等价的“只新卡/只旧卡”参数。源码将它描述为返回待学习卡与剩余计数的幂等读取；同一适配层的 `describe_next_states()` 明确返回各评分按钮的文案。

这意味着：

- “只新/只旧”不是对原生队列的无损参数切换；
- 从完整队列挑出某一类别会让 Reasonix 而不是 scheduler 决定下一张；
- 即使保持相对顺序，回答非队首卡后的 scheduler 状态也需要额外证明，且没有产品必要性。

项目影响：取消模式参数。`session.start.params` 严格只保留 `deckId`，首页计数仅供展示，不能变成队列过滤控件。

### 5.2 原生队列一致性验收

配套插件仍依赖 Anki 内部 scheduler API，因此 P1 必须在固定版本和克隆 QA collection 上证明：

1. 会话第一张等于 Anki scheduler 队首；
2. reveal 的四档文案来自同一组 scheduling states；
3. 回答后下一张、剩余计数和 revlog 与 Anki 一致；
4. 撤销后活动卡与队列恢复一致；
5. 重复 requestId 不产生第二次评分。

### 5.3 为什么不用 Filtered Deck

官方手册说明 Filtered Deck 会把匹配卡片临时移入过滤牌组，并让用户选择卡片收集顺序与复习顺序；重建或清空时又会移动卡片。

项目影响：不得在后台创建 Filtered Deck 来伪装“只新/只旧”或临时会话。这会改变 collection 状态和队列语义，也增加同步与崩溃恢复风险。

### 5.4 Profile 与同步

- 每个 Profile 拥有独立 collection；插件本身由 Anki 安装并可跨 Profile 存在，因此插件进程级状态不能只按 deckId/cardId 区分。
- 正常增量同步可自动触发，但首次同步或需要单向全量同步时，用户必须选择 Upload 或 Download；选错会覆盖一侧数据。

项目影响：Query key、媒体目录、SQLite stats/mapping、会话锁和幂等记录都带 `profileKey`。Reasonix 可以启动普通同步，但不能替用户自动决定全量上传/下载；`Reasonix QA` Profile 永不绑定或同步 AnkiWeb。

## 6. shadcn/ui

- shadcn/ui 采用 Open Code：组件源码由项目持有并可组合，不是不可见黑盒组件包。
- 官方主题方式以 CSS variables 和语义颜色为核心，适合 Reasonix 的 `--rx-*` 令牌体系。
- 当前 Tailwind v4/shadcn 样式依赖 `shadcn/tailwind.css` 提供状态变体；缺失时 `data-open`、`data-closed` 等类可能不生效。

项目影响：继续优先使用 `@reasonix/ui` 的 shadcn 组合接口；宿主样式显式加载 `shadcn/tailwind.css`、Reasonix UI 样式和 Tailwind `@source`，不在业务组件复制另一套基础组件。

## 7. Radix UI

- Dialog 等 modal primitive 负责 Portal、焦点进入/返回、键盘 Esc 和屏幕阅读器所需语义。
- Popover 提供 Portal、锚点定位、边界碰撞与外部交互行为。
- 这些 primitive 是组合式状态机；错误嵌套两个仍保持打开的 modal/focus scope 会造成焦点争抢。

项目影响：Dialog、Sheet、Popover、DropdownMenu、Tooltip 均复用 `@reasonix/ui` 的 Radix 底层实现。菜单触发 Dialog 时先关闭/解耦菜单内容，不能在保持打开的 DropdownMenu modal 内再挂 Dialog modal。

## 8. Lucide

- `lucide-react` 的命名导入可让构建器只打包所用图标；不应从动态图标映射入口批量引入整个图标集合。
- 图标 SVG 支持普通 SVG 属性；装饰图标默认不应单独成为无障碍名称来源。
- 纯图标按钮的交互名称属于按钮本身，应使用可见文本、`aria-label` 或屏幕阅读器文本提供。

项目影响：统一命名导入 Lucide；装饰图标不重复朗读，所有纯图标按钮在按钮节点上有可访问名称。

## 9. Tauri v2

- Rust 函数通过 `#[tauri::command]` 暴露并注册到 invoke handler，前端通过 v2 `invoke()` 调用。
- command 可以返回可序列化值或 `Result<T, E>`；错误类型需要能被序列化/转换，异步 I/O 使用 async command。
- v2 capability 决定窗口/WebView 能调用哪些命令和插件权限；权限应按窗口与实际需求最小化。
- Tauri v1 的 allowlist、初始化和插件教程不能直接套到 v2。

项目影响：Rust 保持薄层，只处理固定 localhost 转发、超时、解包和媒体读取；新 command 使用结构化 `Result`，并同步更新最小 capability，不复制 v1 配置示例。

## 10. 已落入项目真源的决策

| 官方结论 | `tech-plan.md` / `AGENTS.md` 中的落点 |
|---|---|
| scheduler 无“只新/只旧”参数 | 删除三模式；`session.start` 只含 `deckId`；首页单一开始入口 |
| AnkiConnect 不提供精确会话契约 | v2 配套插件为必要组件，AnkiConnect 保留通用 CRUD |
| operation/Qt 线程边界 | HTTP 线程不碰 collection；QueryOp/CollectionOp 串行执行 |
| Profile 与同步风险 | 全链路 profileKey；Profile 切换暂停；全量同步交回 Anki |
| Filtered Deck 会改 collection/顺序 | 明确禁止用它模拟学习模式 |
| shadcn/Radix/Lucide 语义 | 语义令牌、Portal/焦点纪律、图标按钮名称 |
| Tauri v2 capability | Rust 薄层、结构化错误、最小权限 |

## 11. 仍需实机证明的事项

文档能确定接口边界，但不能替代以下 P1 证据：

- Anki 25.09.2 上 scheduler adapter 的具体调用顺序；
- `describe_next_states()` 与 UI 四档标签的精确映射；
- 评分、撤销、Profile 临时关闭和断线重连时的状态恢复；
- Reasonix 会话与 Anki 原生 Reviewer 在相同 QA collection 快照上的逐步一致性。

这些测试只能在独立 `Reasonix QA` Profile 或可恢复的克隆 collection 上运行，不能对用户真实 Profile 自动评分。
