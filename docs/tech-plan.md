# Reasonix Anki v2 — 日语背词工作台实施计划

> 日期：2026-08-10
> 状态：**用户已批准，P0–P6 已落地，P7 稳定性增强进行中**
> 当前实现：v0.1.0 的 M0–M5 保留；配套插件版本为 v0.1.1。v2 已完成安全测试、调度核心、协议/插件传输、Lapis 与自制模型字段映射、今日学习首页和沉浸式学习闭环。2026-08-10 已在独立 `Reasonix QA` Profile 完成真实 Anki 25.09.2 调度闸门：队首、四档文案、评分后下一张、revlog、撤销恢复与重复 `requestId` 均与原生一致。插件授权默认首次询问并跨 Profile/重启永久记住，中文原生设置页可撤销并轮换 token；本轮补充 HTTP 启动回滚、健康监测、同步 pending 超时和前端退避重试。
> 权威关系：项目硬边界与当前代码状态以仓库根目录 AGENTS.md 为准；本文件是唯一详细实施计划，不另建平行 spec。

---

## 1. 产品目标

Reasonix Anki v2 的首要目标是替代用户日常使用 Anki 原版界面进行日语背词的流程，同时保留 Anki 作为唯一的数据、调度、同步与插件运行内核。

用户仍需手动启动 Anki；连接后，从 Reasonix 完成：

1. 自动同步。
2. 在今日首页选择一个现有 Anki 牌组。
3. 直接使用 Anki 原生调度器给出的完整队列学习。
4. 通过现代原生 UI 完成正面、背面与四档评分。
5. 即时撤销上一张误评分。
6. 会话结束后查看简洁学习报告并自动同步。

### 1.1 完成定义

只有同时满足以下条件，才能称为“可替代原版 Anki 的日常背词流程”：

- 用户除手动启动 Anki 外，无需操作原版界面。
- 会话逐张消费 Anki 原生调度结果，Reasonix 不筛选、不重排、不随机。
- 四档间隔、评分和撤销结果与 Anki 一致。
- 标准 Lapis 牌组无需配置即可使用。
- 自制笔记模型完成一次字段映射后即可稳定使用。
- 原卡型的测试目标没有因原生重排版而改变。
- 自动音频、自动同步和学习报告完整工作。
- 断线、崩溃和重复请求不会造成重复评分。
- 当前源码通过自动测试、构建和独立 Anki QA Profile 验证。

### 1.2 本阶段非目标

- 不脱离 Anki 自建数据库或调度器。
- 不支持英语或其他语言的专用背词体验。
- 不自动启动或隐藏 Anki。
- 不迁移、复制或重建用户已有笔记与卡片。
- 不由 Reasonix 生成 Lapis 的五类卡。
- 不加入金币、等级、排行榜或重游戏化。
- 不在第一阶段实现完整模板编辑器、插件市场或移动端。

---

## 2. 已批准的长期决策

1. **Anki 是唯一调度真源**：FSRS、每日限额、卡片顺序、预计间隔、撤销和同步状态全部由 Anki 决定。
2. **Reasonix 只负责呈现**：不得用 findCards + shuffle 模拟正式学习队列，不得自行计算、过滤、重排或覆盖调度结果。
3. **配套插件是精确学习的必要组件**：AnkiConnect 保留通用 CRUD；Reasonix 插件负责调度会话、间隔、撤销、准确计数和同步协调。
4. **直接读取现有牌组**：标准 Lapis 自动识别；其他自制模型使用一次性字段映射。
5. **原生字段 UI**：不以 iframe 模板作为日语背词主界面；使用字段重组为沉浸式原生界面。
6. **保留原卡型语义**：词汇、词句、点击、句子、听力卡仍测试原本能力，只改变视觉和交互。
7. **保留 Anki 四档评分**：忘记、困难、良好、简单始终显示原生预计间隔。
8. **按卡型自动播放音频**。
9. **即时撤销上一张**：使用 Anki 原生撤销栈。
10. **今日首页先选牌组，再直接开始原生调度会话**。
11. **连接成功和会话结束后自动同步；学习过程中不自动同步**。
12. **视觉方向为沉浸式极简；背面核心释义优先，完整词典折叠**。
13. **Profile 全链路隔离**：查询缓存、媒体目录、SQLite 派生数据、字段映射和活动学习会话都必须以当前 Profile 身份为命名空间；Profile 改变时立即暂停会话并清空跨 Profile 缓存。
14. **授权默认首次询问并永久记住**：授权状态写入插件全局 `config.json`，跨 Profile、跨 Anki 重启共享；设置页可撤销并轮换会话 token；同一 Anki 启动内的并发请求只弹一次确认。

---

## 3. 当前实现审查

以下是 v2 立项时对旧 M3 复习流的审查。P3–P5 已另建正式学习流解决这些冲突；旧 M3 仅作为兼容视图保留，不能重新成为 v2 正式背词入口：

| 当前行为 | 与 v2 的冲突 | v2 处理 |
|---|---|---|
| findCards 查询 is:due | 只能搜索卡片，不能取得完整原生调度会话 | 配套插件直接调用 Anki scheduler |
| 本地 shuffle 队列 | 改变 Anki 原生顺序 | 正式背词流删除本地重排 |
| MAX_QUEUE=300 本地截断 | 不是原生每日限额 | 使用 scheduler 剩余计数 |
| answerCards 直接评分 | 无准确间隔、完整下一张和原生撤销 | 插件 session.answer / session.undo |
| CardRenderer iframe | 依赖模板 HTML/JS，不是原生词条界面 | 新增 Lapis adapter 与原生组件 |
| buriedToday 本地过滤 | 不属于精确原生调度 | 不作为 v2 正式流程的调度能力 |
| 无测试脚本与测试文件 | 调度变更缺少安全网 | P0 先建立测试体系和 QA Profile |

现有牌组浏览、笔记编辑、媒体管线、主题、SQLite 统计与 AnkiConnect actions 继续保留。

---

## 4. 推荐架构

采用 **AnkiConnect + Reasonix 配套插件** 的混合架构。

| 方案 | 结论 | 原因 |
|---|---|---|
| AnkiConnect + 配套插件 | **采用** | 通用读写继续复用成熟接口，插件只补精确调度缺口 |
| 所有功能改走配套插件 | 不采用 | 会重复实现大量 AnkiConnect 能力，维护面过大 |
| 继续只用 AnkiConnect | 淘汰 | 无法满足原生队列、预计间隔和撤销 |

~~~text
Reasonix React UI
  ├─ lib/anki                 → AnkiConnect :8765 → 通用 CRUD / 媒体 / 历史统计
  ├─ lib/reasonix-addon       → Reasonix 插件 :8766 → scheduler / interval / undo / sync
  └─ lib/db                   → 本地 SQLite → 字段映射 / UI 偏好 / 派生报告

Anki Collection + Scheduler 始终是唯一业务真源
~~~

### 4.1 数据所有权

- **Anki**：卡片、笔记、媒体、标签、牌组、调度、revlog、同步状态。
- **Reasonix 插件**：当前会话的短生命周期锁与请求幂等记录。
- **Reasonix SQLite**：Profile/Model 字段映射、界面偏好、派生统计缓存。
- **Profile 命名空间**：插件返回稳定 `profileKey`；TanStack Query key、媒体目录缓存、统计表和 mapping 均包含该 key。Anki 官方说明每个 Profile 拥有独立 collection，而插件在 Profile 间共享，因此只按 deckId/cardId 隔离不安全。
- **禁止**：在本地 SQLite 保存或覆盖 due、interval、ease、queue 等调度真源。
- **离线策略**：不支持离线评分；失去 Anki 连接时暂停会话。

---

## 5. Reasonix 配套插件

### 5.1 运行边界

- Anki Python addon，默认只监听 127.0.0.1:8766。
- HTTP 监听器运行在后台线程，不直接读取 `mw.col` 或调用 Qt。
- 调度请求先回到 Anki 主线程创建 `QueryOp` / `CollectionOp`；实际 collection 访问由 Anki 官方 operation 队列在后台串行执行，UI 回调留在主线程。不得在 HTTP 线程直接访问 collection，也不得把耗时 scheduler 写操作塞在 UI 主线程。
- 适配 Anki 25.09.2 的 operation 构造差异：`QueryOp` 通过构造函数接收 `success`，`CollectionOp` 通过链式回调接收 `success/failure`；CollectionOp 返回值必须保留原生 `OpChanges`（协议响应由桥接结果包装），不能直接返回 JSON。
- `session.start` 使用 `DeckManager.set_current(deckId)` 保留牌组选择的 `OpChanges`，与 answer/undo 一样进入 `CollectionOp`；undo 的 `OpChangesAfterUndo` 在包装层展开为基础 changes 后再触发 Anki UI hooks。
- 插件加载早于 Profile/collection；使用 `profile_did_open`、`profile_will_close`、`collection_will_temporarily_close`、`collection_did_temporarily_close` 与同步 hooks 驱动可用状态。
- 使用版本化 JSON RPC；请求与响应均有 schema。
- 首次连接在 Anki 侧确认权限，并签发会话令牌。
- 能力协商返回插件版本、Anki 版本、Profile 标识和支持的 action。
- 同一时刻只允许一个正式 Reasonix 学习会话。

当前代码已提供可安装插件根入口、loopback HTTP 服务、Anki 生命周期 hooks、
Profile 命名空间 key、主线程 `QueryOp`/`CollectionOp` 桥接、权限确认和
status/capability 响应。真实 Profile 的评分闸门只允许在用户手动创建并打开的
`Reasonix QA` Profile 中执行；其他活动 Profile 下继续 fail-closed。

### 5.2 协议 v1

统一请求：

~~~json
{
  "version": 1,
  "action": "session.answer",
  "requestId": "uuid",
  "token": "session-token",
  "params": {}
}
~~~

统一响应：

~~~json
{
  "result": {},
  "error": null
}
~~~

核心 action：

| Action | 作用 |
|---|---|
| status | 插件版本、Anki 版本、当前 profileKey/profileName、collection 状态、同步状态、能力列表 |
| requestPermission | 首次授权与会话令牌 |
| decks.today | 返回牌组准确的新卡、学习中、复习到期与预计用时 |
| session.start | 仅以 deckId 启动该牌组的原生调度会话 |
| session.next | 获取 scheduler 指定的下一张 |
| session.reveal | 返回四档预计间隔 |
| session.answer | 对当前卡提交 ease 1–4 |
| session.undo | 使用 Anki 原生撤销恢复上一张 |
| session.finish | 释放会话锁并返回摘要 |
| sync.start | 启动 Anki 同步 |
| sync.status | 返回同步进度或错误 |

`session.reveal` 的 UI 真源是 scheduler `describe_next_states()` 返回的四档标签；若协议同时返回秒数，秒数只能从同一组 scheduling states 推导并作为诊断字段，前端不得自行换算间隔。

### 5.3 卡片载荷

session.next 至少返回：

- cardId、noteId、deckId
- modelId、modelName
- templateOrd、templateName
- queue/type
- fields、tags
- question、answer（仅诊断回退）
- 媒体文件名
- 识别后的 cardKind
- 剩余 new/learning/review 数量

### 5.4 正确性保护

- session.answer 必须携带 expectedCardId。
- requestId 幂等：网络重试不得重复评分。
- 回答未确认时前端锁定评分按钮。
- Profile 切换、同步或数据库维护时暂停会话。
- collection 临时关闭（全量同步、导入导出）时拒绝新请求；恢复后重新核对 profileKey 与活动卡。
- 应用崩溃后，插件能识别未完成会话并安全恢复或结束。

---

## 6. 原生学习队列

Anki 25.09.2 官方 `get_queued_cards()` 只有 `fetch_limit` 和 `intraday_learning_only`，没有“只新卡/只旧卡”参数。Reasonix 不再抽象学习模式，协议与界面统一采用以下唯一语义：

1. `session.start.params` 严格为 `{ deckId }`；旧的 `mode` 参数无效并应被协议校验拒绝。
2. 插件从 Anki scheduler 获取已应用每日限额、牌组选项、兄弟卡处理、收集和排序规则的原生队列。
3. `session.next` 返回 scheduler 指定的队首卡；Reasonix 不按 new/learning/review 分类筛选，也不改变相对顺序。
4. `session.answer` 提交当前卡后，再由 scheduler 决定下一张；新卡进入学习步骤后的再次出现自然留在同一原生流程中。
5. new/learning/review 计数只用于首页和会话进度展示，不是可选过滤条件。
6. 禁止用 filtered deck 模拟模式：官方文档明确它会临时移动卡片，并使用独立的收集与复习顺序设置。

P1 原型必须在克隆的 QA collection 中逐步比对 Reasonix 会话与 Anki 原生队列、四档间隔、评分后下一张及撤销恢复结果。任何一步不一致都停止 UI 扩建并修正适配层，不允许以本地筛选或重排掩盖差异。

---

## 7. Lapis 字段适配

内部统一为 JapaneseWordRecord，但不要求用户修改原笔记模型。

### 7.1 标准字段

| 语义 | Lapis 字段 |
|---|---|
| 词条 | Expression |
| 振假名 | ExpressionFurigana |
| 纯读音 | ExpressionReading |
| 词条音频 | ExpressionAudio |
| 主释义 | MainDefinition |
| 完整词典 | Glossary |
| 例句 | Sentence |
| 例句振假名 | SentenceFurigana |
| 例句音频 | SentenceAudio |
| 图片 | Picture / DefinitionPicture |
| 音调 | PitchPosition / PitchCategories |
| 频率 | Frequency / FreqSort |
| 补充 | SelectionText / Hint / MiscInfo / Tags |
| 卡型开关 | IsWordAndSentenceCard / IsClickCard / IsSentenceCard / IsAudioCard |

### 7.2 自动识别与映射向导

1. 先按标准字段名一对一匹配。
2. 结合 templateName、templateOrd 和 Is...Card 字段识别卡型。
3. 标准 Lapis 命中后直接进入学习，无需向导。
4. 非标准模型要求映射“词条”和“主释义/完整词典”至少一组。
5. 自定义模板还需确认每个模板的卡型语义。
6. 映射以 Profile ID + Model ID + schemaVersion 为键存入 SQLite。
7. 模型字段发生变化时旧映射失效，要求重新确认。

### 7.3 安全

- MainDefinition、Glossary、Sentence 等 HTML 均经 DOMPurify。
- 原生词条模式不执行卡片脚本。
- 媒体继续复用 Rust 直读 → Blob URL → AnkiConnect 兜底管线。
- 原始 CardRenderer 仅作为诊断或非词汇卡兼容视图。

---

## 8. 产品界面

### 8.1 今日学习首页

连接成功后自动同步，随后按牌组展示：

- 新词
- 学习中
- 到期复习
- 今日完成数
- 预计学习时间
- 最近一次学习时间
- 当前同步状态

点击牌组后显示准确计数与单一“开始学习”入口，直接启动该牌组的 Anki 原生调度会话；不显示模式选择，也不提供只新卡、只旧卡、自定义重排或随机选项。

插件未安装、未授权或版本不兼容时，精确学习入口必须禁用并说明原因；不得静默降级到本地随机队列。

### 8.2 沉浸式学习界面

- 进入学习后隐藏侧栏与常规标题内容。
- 顶部只保留牌组名、进度、剩余量、连接状态。
- 中央显示当前词条。
- Space / Enter：显示背面。
- 1–4：忘记、困难、良好、简单。
- 四档按钮始终显示 Anki 预计间隔。
- Ctrl+Z：撤销上一张。
- R：重播当前主音频。
- 所有动效走 --rx-* 令牌并支持 prefers-reduced-motion。

### 8.3 正面卡型语义

- 词汇卡：显示词条。
- 词句卡：显示词条与原模板要求的句子线索。
- 句子卡：显示例句并保留原有遮挡语义。
- 听力卡：按卡型自动播放音频，不提前泄露文本。
- 点击卡：用原生组件保留点击揭示逻辑。

### 8.4 背面信息层级

1. 词条、振假名、读音、音调。
2. 词条音频与句子音频。
3. 主释义。
4. 例句与图片。
5. 折叠的完整词典。
6. 折叠的频率、标签、来源和其他信息。

### 8.5 UI 基础设施纪律

- 优先使用 `@reasonix/ui` 的 shadcn 风格组件和语义令牌；宿主必须加载 `shadcn/tailwind.css`、`@reasonix/ui/styles.css` 与对应 `@source`，不得让 `data-open` / `data-closed` 状态类静默失效。
- Dialog、Sheet、Popover、Dropdown、Tooltip 统一使用 `@reasonix/ui` 底层的 Radix primitive，保留 Portal、焦点圈定、Esc、外部交互和碰撞处理；不得手写可交互弹层。
- 菜单触发的 Dialog 必须与菜单内容解耦，避免两个 modal/focus scope 同时保持打开。
- 图标统一使用 Lucide 的按需命名导入；纯图标按钮把可访问名称放在按钮上，装饰图标保持 `aria-hidden` 默认行为。

---

## 9. 学习状态机

主流程：

~~~text
idle → starting → front → revealing → back → answering → front / done
~~~

异常分支：

~~~text
answering → error → back
front/back → disconnected → paused
front/back → undoing → restored
done → syncing → report
~~~

规则：

- 评分请求未确认前不得前进。
- 断线时不在本地推进索引。
- 恢复连接后先向插件询问当前 active card。
- session.finish 之后才能触发结束同步。

---

## 10. 自动同步与报告

### 10.1 同步

- 连接成功且当前无学习会话时自动同步。
- 会话完成后自动同步。
- 学习过程中不自动同步。
- 同步期间禁止开始新会话。
- 同步失败不回滚已经由 Anki 接受的评分。
- 登录、冲突与服务端错误由 Anki 返回，Reasonix 负责清晰呈现。
- 若首次同步或全量同步需要 Upload/Download 决策，必须交回 Anki UI 明确确认，Reasonix 不代选。
- `Reasonix QA` Profile 永不自动同步，也不得绑定用户的 AnkiWeb 账户。

### 10.2 插件设置

- `工具 → Reasonix 设置…` 与附加组件管理器的“配置”按钮打开同一个中文 Qt 页面。
- 默认策略为“首次询问并永久记住”；可切换为“每次启动 Anki 询问一次”或“始终拒绝”。
- 授权范围是整个 Anki 安装，不按 Profile 分开；撤销后立即轮换 token，下一次学习重新确认。
- 设置页只管理授权和连接诊断，不暴露只新卡/只旧卡、间隔或每日上限等调度参数。

### 10.3 学习报告

结束页显示：

- 作答张数
- 总用时与平均每张耗时
- 忘记、困难、良好、简单分布
- 忘记率
- 本次薄弱词条
- Anki 预测的明日复习量
- 同步结果

---

## 11. 实施阶段与风险闸门

| 阶段 | 工作内容 | 验收出口 |
|---|---|---|
| P0 基线与安全网 | Vitest、RTL、独立 Anki QA Profile、可重复播种的 Lapis 样本牌组、跨 TS/Python 协议 fixtures、活动 Profile 写保护 | 测试不触碰用户库；QA Profile 不同步；现有构建通过 |
| P1 调度原型 | 最小插件：next/reveal/answer/undo；逐步验证原生队列一致性 | 克隆测试库中队首、间隔、评分后下一张和撤销均与 Anki 一致；不创建 filtered deck |
| P2 协议与传输 | 协议 v1、授权、能力协商、幂等、Rust 固定目标代理、TS zod 客户端 | 错误统一；重复 answer 不重复评分；版本不兼容可诊断 |
| P3 Lapis 适配 | 字段归一化、卡型识别、映射向导、SQLite 持久化、HTML 消毒 | 标准 Lapis 零配置；自制模型映射后可用 |
| P4 今日首页 | 新默认视图、准确计数、同步状态、牌组选择和单一开始入口 | 计数与 Anki 一致，启动请求仅含 deckId，入口不筛选或排序 |
| P5 沉浸式学习 | 插件状态机、原生正反面、四档间隔、自动音频、快捷键、撤销 | 完成整轮；评分和撤销可在 Anki 核实 |
| P6 同步与报告 | 自动同步、同步锁、断线恢复、报告和明日预测 | 失败不丢评分；报告与 revlog 一致 |
| P7 稳定性与性能 | 长词典懒渲染、媒体缓存、崩溃恢复、Profile 切换、无障碍 | 万卡牌组可用，异常可恢复 |
| P8 发布 | 插件包、首次连接向导、诊断页、build/commit 信息、重新打包 | 新机器完成安装并成功学习；不再混淆旧 release |

依赖顺序：

~~~text
P0 → P1 → P2 → P3/P4 → P5 → P6 → P7 → P8
~~~

**P1 是硬风险闸门**：精确调度未通过真实 Anki 验证前，不开始大规模 UI 实现。
该闸门已于 2026-08-10 通过，P3/P4/P5/P6 也已按依赖顺序完成；当前进入 P7。P6 已完成自动化协议、锁、恢复和报告验证；本轮 P7 已加入服务启动回滚、健康状态、同步延迟确认、有限退避重试和迟到权限回调隔离。跨插件重启的会话持久化、长内容性能和真实 Anki 同步结果细分仍待后续验收，真实 Anki 同步验收按用户要求暂不执行。实机步骤与安全边界见 [`qa-runbook.md`](qa-runbook.md)。

---

## 12. 现有代码迁移

### 12.1 保留复用

- src/lib/anki：通用 CRUD
- TanStack Query 查询层
- src/lib/media.ts：媒体直读与缓存（P7 补 profileKey 隔离和切换失效）
- src/lib/db/stats.ts：revlog 增量统计基础（P7 迁移为 profileKey 复合主键）
- 主题系统、侧栏、浏览器、编辑器
- CardRenderer：兼容与诊断视图

### 12.2 替换或退出正式路径

- findCards + shuffle 正式复习队列
- MAX_QUEUE=300 本地截断
- buriedToday 作为正式调度行为
- 直接 answerCards 驱动的正式学习会话
- iframe 模板作为 Lapis 主界面
- 本地估算的正式今日队列数字

### 12.3 已落地目录

~~~text
reasonix-addon/                 # Anki Python 配套插件
src/lib/reasonix-addon/         # 协议、schemas、transport
src/features/today/             # 今日首页
src/features/vocabulary/        # Lapis adapter、映射向导、原生组件
src/features/study/             # 沉浸式学习界面
src/stores/studySession.ts      # 插件驱动状态机
src/lib/db/mappings.ts          # Profile/Model 字段映射
~~~

旧 ReviewView 当前作为明确标注的兼容入口保留；P7 稳定性验证和 P8 发布前再决定是否移除，禁止让它静默接管正式学习入口。

---

## 13. 测试与数据安全

### 13.1 自动测试

- 单元：字段识别、卡型识别、HTML 消毒、状态机、时间格式。
- 组件：映射向导、正反面、评分锁、撤销、折叠词典。
- 协议：TypeScript 与 Python 使用同一组 golden JSON fixtures。
- 插件：队列、间隔、回答幂等、撤销、同步锁。
- 集成：标准 Lapis、自定义字段、缺媒体、长词典、子牌组。
- 故障：插件缺失、Anki 断开、Profile 切换、同步失败、重复点击。
- 发布：Tauri 窗口冒烟、插件安装与首次授权。

### 13.2 写操作安全

- 所有调度测试只使用独立“Reasonix QA”Anki Profile。
- 不在用户真实牌组上自动评分、撤销、重建或清理。
- 队列一致性测试使用克隆的 collection 快照。
- 真实用户库测试仅限只读检查，写操作必须由用户明确触发。
- 集成测试启动前必须通过 `getActiveProfile` 精确匹配 `Reasonix QA`；名称缺失、近似或连接异常一律 fail closed。
- QA Profile 禁止调用 `sync` / `sync.start`，样本牌组由可重复播种脚本创建并可从 collection 快照恢复。

### 13.3 验证命令目标

P0 落地后，完成声明前至少执行：

~~~text
npm test
npx tsc --noEmit
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
插件单元/协议测试
Tauri + Anki QA Profile 冒烟测试
~~~

---

## 14. 主要风险与对策

| 风险 | 对策 |
|---|---|
| Anki 内部 scheduler API 随版本变化 | 协议能力协商 + 版本适配层；首发支持明确的 Anki 版本范围 |
| 插件会话与 Anki 原生队列状态漂移 | P1 逐步快照对照 + expectedCardId；不一致时拒绝评分并重新同步会话状态 |
| 重复请求造成二次评分 | requestId 幂等 + expectedCardId |
| 同步与学习并发 | 插件会话锁和同步锁 |
| Profile 切换导致缓存、媒体或统计串库 | status 返回 profileKey；Query、媒体、stats、mapping 和 session 全部按 profileKey 隔离，切换即暂停与失效 |
| 自制 Lapis 字段不一致 | 自动识别后必须由用户确认一次性映射 |
| 大 Glossary 导致卡顿 | 折叠、懒挂载、限制重排与图片解码 |
| 卡片 HTML/脚本攻击主应用 | 原生视图消毒且不执行脚本 |
| 本地端口被其他程序调用 | 仅 localhost + Anki 授权 + 会话令牌 |
| 构建产物过期造成误开旧版 | P8 显示 commit/build time，并统一发布脚本与产物目录 |

### 14.1 官方依据（2026-08-10 复审）

逐站阅读记录、官方事实、版本边界和对本计划的影响见 [`official-docs-review.md`](official-docs-review.md)。本节不复制该报告，实施决策仍以本文件为唯一详细真源。

---

## 15. 后续完整替代路线

日常背词闭环完成后，后续单独设计并分期实现：

1. 现代牌组与标签管理。
2. 批量笔记编辑和高级搜索。
3. Lapis/Yomitan 制卡工作流。
4. 牌组选项与 FSRS 设置。
5. 导入导出、媒体检查和备份。
6. Profile 管理与同步冲突处理。
7. 模板编辑器和非日语卡片兼容。

这些能力不阻塞 v2 第一阶段，也不得提前混入 P0–P5。
