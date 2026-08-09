# AGENTS.md — Reasonix Anki 工作台：项目指南 · 规范 · API 参考

> 本文件是 AI 编程代理（QoderWork / Reasonix / Cursor / Copilot 等）在本仓库工作的**唯一权威指南**。
> 每次新增、修改、重构、测试前，先读本文件并严格遵守。
> 设计决策全过程见 `../reasonix-anki-tech-plan.md`（v1.2，含评审记录与 M0–M5 实施日志）。

---

## 0. 项目介绍

### 0.1 这是什么

**Reasonix Anki** 是基于 [AnkiConnect](https://git.sr.ht/~foosoft/anki-connect) 的 Anki 桌面工作台——给"嫌 Anki 原生界面丑"的人做的现代客户端。它不替代 Anki，而是作为前端连接**本机运行中的 Anki**（HTTP `127.0.0.1:8765`），所有数据读写都真实落到 Anki 数据库。

Tauri 2（Rust 薄层）· React 19 · TypeScript strict · Vite 7 · Tailwind CSS v4 · TanStack Query v5 · Zustand v5 · SQLite（tauri-plugin-sql）· `@reasonix/ui`（vendor/ 本地 tgz，38 组件 + 6 主题方向）。

### 0.2 四大功能视图（侧栏切换，无路由库）

| 视图 | 能力 | 关键实现 |
|---|---|---|
| **牌组浏览**（默认） | 三栏：牌组树（"新卡 已学/上限"口径 Badge）→ 卡片列表（Anki 搜索语法 + 分页）→ 笔记预览；行操作：暂停/恢复、改期（确认弹窗）、编辑、删除（确认弹窗） | ResizablePanelGroup v4（`orientation`）；getDeckStats + getDeckConfig 双口径 |
| **笔记编辑** | 新建笔记（选牌组 + 模板 → modelFieldNames 动态表单 → addNote）；按 id 编辑（Sheet 面板，字段源码/预览双态，updateNote 一次提交）；图片粘贴上传（storeMediaFile） | 编辑面板全局单实例挂载在 App，由 editor store 驱动 |
| **复习** | 自建复习流：选牌组 → 到期队列（is:due，乱序，上限 300）→ 问题面/答案面（沙箱渲染 + 媒体管线）→ 键盘评分（Space/1-4/B）→ 完成页统计；"今天不看"= 会话内 bury（零调度副作用）；**脚本模式**开关渲染 JS 驱动的重模板 | Zustand 状态机；CardRenderer（DOMPurify + iframe sandbox + 媒体解析） |
| **统计概览** | 汇总卡（今日已复习/总卡片/今日到期/新卡剩余）；热力图（全局接口 or 单牌组 SQLite 聚合，26 周）；牌组汇总表；增量同步/重建控制 | SQLite 三表 + cardReviews(startID) 水位线增量 |

### 0.3 仓库地图

```
reasonix-anki/
├── src/
│   ├── main.tsx                  # createRoot + QueryClientProvider
│   ├── App.tsx                   # 外壳：Sidebar + currentView 切换 + 全局挂载层
│   ├── index.css                 # tailwind + tw-animate + @reasonix/ui/styles.css + @source
│   ├── components/               # ConnectionIndicator / DisconnectedScreen / Sidebar
│   │                             # ToasterLite（M0–M3 通知方案）/ PlaceholderView
│   ├── features/
│   │   ├── BrowseView.tsx        # M1 三栏浏览器（ResizablePanelGroup）
│   │   ├── EditorView.tsx        # M2 入口（新建/按 id 编辑）
│   │   ├── ReviewView.tsx        # M3 入口：选牌组开场 / 完成页
│   │   ├── StatsView.tsx         # M4 汇总卡 + 热力图 + 同步控制
│   │   ├── browse/               # DeckTree / CardTable / NotePreview / RowActions / browseUtil
│   │   ├── editor/               # FieldEditor / NewNoteDialog / NoteEditorSheet
│   │   └── review/               # CardRenderer（渲染核心）/ ReviewSession
│   ├── lib/
│   │   ├── anki/
│   │   │   ├── transport.ts      # ★ 双通道：Tauri invoke / 浏览器 fetch /anki
│   │   │   ├── actions.ts        # ★ 类型化 action 客户端（唯一 AnkiConnect 入口，24 个函数）
│   │   │   ├── schemas.ts        # zod schemas（字段名已按官方 README 逐条核对）
│   │   │   ├── query.ts          # queryKeys + useQuery 工厂（6 个 hooks）
│   │   │   └── useConnection.ts  # 连接状态机（3s 轮询）
│   │   ├── db/stats.ts           # SQLite 三表 + cardReviews 增量同步
│   │   └── media.ts              # 媒体解析：read_media_file → blob，LRU 缓存
│   └── stores/                   # zustand：app（视图/主题）/ editor / review（会话状态机）
├── src-tauri/
│   ├── src/commands.rs           # anki_request + read_media_file（刻意做薄）
│   ├── src/lib.rs                # 插件/state 注册（opener + sql + MediaDir）
│   ├── capabilities/default.json # 最小权限：core + opener + sql
│   └── tauri.conf.json           # NSIS currentUser 打包；图标已自定义
├── vendor/reasonix-ui-0.2.0.tgz  # @reasonix/ui 本地包（file: 安装）
├── app-icon.png                  # 图标源（已去生成水印）
└── AGENTS.md                     # 本文件
```

---

## 1. 架构红线（违反即破坏设计）

1. **Rust 层保持薄**：只做 HTTP 转发、超时、`{result, error}` 解包、媒体直读。一切业务逻辑在 TS 层（可测、可热更新）。新增 Rust command 前先问：能不能放 TS？
2. **AnkiConnect 唯一入口是 `lib/anki/actions.ts`**：禁止在组件里直接 `invoke("anki_request")` 或 `fetch("/anki")`。新 action 先在 actions.ts 加类型化函数。
3. **状态分层**：查询型数据（牌组/卡片/笔记/模型）→ TanStack Query；命令式会话状态（复习流程）→ Zustand `stores/review.ts`。复习流进 Query 是明确拒绝的反模式（评审定稿）。
4. **卡片 HTML 是不可信输入**：默认安全模式 = DOMPurify 消毒 + iframe `sandbox="allow-same-origin"`（无脚本）。脚本模式仅在用户显式开启时使用（`allow-scripts allow-same-origin`，等同 Anki 原生信任级别）——不要默认开。
5. **调度数据敬畏原则**：`setDueDate` 只允许在带确认弹窗的明确操作后调用（官方文档明示它把 new 卡转成 review 卡）；复习流的"今天不看"必须走会话内 bury（`buriedToday`），零 Anki 副作用。
6. **样式纪律**（继承 reasonix-design-kit）：无硬编码色值/圆角/时长，一律 `var(--rx-*)` 或 tailwind 语义令牌；动效时长取 `--rx-dur-*`，缓动取 `--rx-ease*`。
7. **视图切换不用路由库**：`stores/app.ts` 的 `currentView` + 条件渲染（评审定稿的 YAGNI 决策），出现深层链接需求再评估 react-router。

---

## 2. API 参考

### 2.1 数据流总览

```
┌─ 视图层 features/* ─────────────────────────────────────────────┐
│  查询型：useDeckTree / useCardSearch / …（TanStack Query 缓存）   │
│  会话型：useReviewStore / useEditorStore / useAppStore（Zustand） │
└──────────────┬───────────────────────────────────────────────────┘
               ▼
┌─ 服务层 lib/anki/actions.ts（anki.* 24 个类型化函数）────────────┐
│  zod 解析入口；写操作成功后按 §5.1 失效缓存                        │
└──────────────┬───────────────────────────────────────────────────┘
               ▼
┌─ 传输层 lib/anki/transport.ts（ankiCall，双通道）────────────────┐
│  Tauri：invoke("anki_request") → Rust reqwest → 127.0.0.1:8765  │
│  浏览器：fetch("/anki") → Vite dev proxy → 127.0.0.1:8765        │
└──────────────┬───────────────────────────────────────────────────┘
               ▼
        Anki + AnkiConnect 插件（本地唯一数据源）
```

媒体旁路：CardRenderer → `lib/media.ts resolveMediaUrl` → Tauri `read_media_file`（Rust `std::fs` 直读媒体目录）→ base64 → Blob URL（LRU 120）；失败/浏览器模式落 `anki.retrieveMediaFile`。

### 2.2 Rust command 层（invoke 契约）

| Command | 入参 | 返回 | 说明 |
|---|---|---|---|
| `anki_request` | `{ action: string, params: Value }` | `Result<Value, String>` | POST 8765，15s 超时；body 自动带 `version: 6`；响应 `error` 非 null → Err(错误信息)，否则返回 `result`。apiKey 注入点（未来） |
| `read_media_file` | `{ filename: string }` | `Result<String(base64), String>` | 媒体目录路径首次调用时经 `getMediaDirPath` 获取并缓存（`MediaDir` state）；文件名校验：拒绝空名与 `.. / \ :`（防目录穿越）；`std::fs` 直读。**注意**：锁守卫不可跨 await（future 非 Send） |

权限（capabilities/default.json）：`core:default` + `opener:default` + `sql:default`——最小化，勿随意扩。

### 2.3 AnkiConnect action 目录

**A. 本项目已用（actions.ts 封装）**

| 分类 | Action | 参数 → 返回 | 调用方 |
|---|---|---|---|
| 连接 | `version` | — → number | useConnection |
| 连接 | `requestPermission` | — → `{permission, requireKey?}`（幂等不弹窗） | useConnection |
| 连接 | `sync` | — → null | 预留（工具栏同步按钮未接线） |
| 牌组 | `deckNamesAndIds` | — → **Record<牌组名, deck_id>** | useDeckTree |
| 牌组 | `getDeckStats` | `{decks[]}` → Record<deck_id, DeckStats>（额度口径！） | useDeckTree |
| 牌组 | `getDeckConfig` | `{deck}` → DeckConfig（`new.perDay`/`rev.perDay`） | useDeckConfigs |
| 检索 | `findCards` | `{query}` → cardId[]（Anki 搜索语法） | useCardSearch / review.start / StatsView |
| 检索 | `cardsInfo` | `{cards[]}` → CardInfo[] | useCardSearch / review.start |
| 检索 | `notesInfo` | `{notes[]}` → NoteInfo[] | useNotePreview / NoteEditorSheet |
| 卡片 | `suspend` / `unsuspend` | `{cards[]}` → boolean[] | RowActions |
| 卡片 | `setDueDate` | `{cards[], days: "1"/"3-7"/"1!"}` → null（⚠️ new 卡转 review） | RowActions（确认弹窗） |
| 卡片 | `forgetCards` | `{cards[]}` → null | 预留 |
| 卡片 | `answerCards` | `{answers: [{cardId, ease 1-4}]}` → boolean[] | review.answer |
| 笔记 | `addNote` | `{note: NewNote}` → noteId \| null（null=拒绝，多为重复） | NewNoteDialog |
| 笔记 | `updateNote` | `{note: {id, fields?, tags?}}` → null | NoteEditorSheet |
| 笔记 | `deleteNotes` | `{notes[]}`（note id！）→ null | RowActions（确认弹窗） |
| 模型 | `modelNames` | — → string[] | useModelNames |
| 模型 | `modelFieldNames` | `{modelName}` → string[] | useModelFields |
| 统计 | `cardReviews` | `{deck, startID}` → RevlogRow[9 元组]（startID 后增量） | db/stats.syncDeck |
| 统计 | `getNumCardsReviewedToday` | — → number | StatsView 汇总卡 |
| 统计 | `getNumCardsReviewedByDay` | — → [date, count][]（稀疏，全局） | StatsView 全局热力图 |
| 媒体 | `storeMediaFile` | `{filename, data(base64)}` → filename | FieldEditor 粘贴上传 |
| 媒体 | `retrieveMediaFile` | `{filename}` → base64 \| null | lib/media 兜底 |
| 媒体 | `getMediaDirPath` | — → 媒体目录绝对路径 | Rust read_media_file 内部 |

**B. 可用未用（扩展功能/M7 插件前查这里）**

| Action | 用途 |
|---|---|
| `findNotes` / `cardsToNotes` / `cardsModTime` | 笔记级搜索、卡→笔记映射、修改时间 |
| `getReviewsOfCards` | 按卡片查全量复习记录（与牌组级 cardReviews 勿混） |
| `getTags` / `addTags` / `removeTags` / `updateNoteTags` / `getNoteTags` | 标签批量管理（M2 目前仅整组提交 tags） |
| `canAddNotes` / `canAddNotesWithErrorDetail` | 添加前查重 |
| `createDeck` / `deleteDecks` / `changeDeck` / `deckNames` | 牌组管理（UI 未做） |
| `exportPackage` / `importPackage` | .apkg 导入导出 |
| `getProfiles` / `getActiveProfile` / `loadProfile` | 多 profile 支持 |
| `multi` | 批量执行减往返 |
| `apiReflect` | 运行时探测可用 action（M7 插件探测机制依赖它） |
| `getEaseFactors` / `setEaseFactors` / `relearnCards` / `removeEmptyNotes` | 细粒度调度 |
| `gui*` 系列（guiBrowse/guiDeckOverview/guiAnswerCard/guiUndo/…） | 操作 Anki 原生界面——自建客户端刻意不用（guiUndo 等只作用于原生窗口） |

### 2.4 服务层：`anki.*` 完整签名（lib/anki/actions.ts）

```ts
anki.version(): Promise<number>
anki.requestPermission(): Promise<PermissionInfo>        // {permission, requireKey?}
anki.sync(): Promise<null>
anki.deckNamesAndIds(): Promise<DeckMap>                 // Record<牌组名, deck_id>（zod 解析）
anki.getDeckStats(decks: string[]): Promise<Record<string, DeckStats>>
anki.getDeckConfig(deck: string): Promise<DeckConfig>
anki.findCards(query: string): Promise<number[]>
anki.cardsInfo(cards: number[]): Promise<CardInfo[]>     // zod 解析
anki.notesInfo(notes: number[]): Promise<NoteInfo[]>     // zod 解析
anki.suspend(cards: number[]): Promise<boolean[]>
anki.unsuspend(cards: number[]): Promise<boolean[]>
anki.setDueDate(cards: number[], days: string): Promise<null>   // ⚠️ 需用户确认
anki.forgetCards(cards: number[]): Promise<null>
anki.answerCards(answers: {cardId: number; ease: number}[]): Promise<boolean[]>
anki.deleteNotes(notes: number[]): Promise<null>
anki.modelNames(): Promise<string[]>
anki.modelFieldNames(modelName: string): Promise<string[]>
anki.addNote(note: NewNote): Promise<number | null>
anki.updateNote(note: {id: number; fields?: Record<string,string>; tags?: string[]}): Promise<null>
anki.cardReviews(deck: string, startID: number): Promise<RevlogRow[]>
anki.getNumCardsReviewedToday(): Promise<number>
anki.getNumCardsReviewedByDay(): Promise<[string, number][]>
anki.storeMediaFile(filename: string, data: string): Promise<string>
anki.retrieveMediaFile(filename: string): Promise<string | null>

interface NewNote { deckName: string; modelName: string; fields: Record<string,string>; tags?: string[] }
type RevlogRow = [reviewTime, cardID, usn, buttonPressed, newInterval,
                  previousInterval, newFactor, reviewDuration, reviewType]  // 全 number
```

传输层（transport.ts）：`ankiCall<T>(action: string, params?: unknown): Promise<T>`（错误统一 throw Error）；`inTauri: boolean` 判定运行形态。

### 2.5 核心类型速查（lib/anki/schemas.ts，zod）

| 类型 | 关键字段 | 注意 |
|---|---|---|
| `DeckMap` | `Record<string, number>` | 牌组名 → deck_id，**不是数组** |
| `DeckStats` | `deck_id, name, new_count, learn_count, review_count, total_in_deck` | counts = 今日剩余额度；total 才是总数 |
| `DeckConfig` | `id?, name?, new?{perDay}, rev?{perDay}` | 其余字段 passthrough 未解析 |
| `CardInfo` | `cardId, question, answer, deckName, modelName, fields: Record<名,{value,order}>, css?, interval?, note, ord?, type, queue, due, reps?, lapses?, mod?` | fields 键是 **value**；queue：-1 暂停/-2、-3 埋没/0 新/1 学/2 复/3 跨天学 |
| `NoteInfo` | `noteId, tags[], fields: Record<名,{order,value}>, modelName, cards[]` | |

### 2.6 查询层 hooks（lib/anki/query.ts）

| Hook | queryKey | 说明 |
|---|---|---|
| `useDeckTree()` | `decks` | deckNamesAndIds + getDeckStats 合并 → `{decks: DeckMap, stats}` |
| `useDeckConfigs(names)` | `deckConfigs(名字 join)` | 并行 getDeckConfig，staleTime 5min，失败跳过 |
| `useCardSearch(query, page)` | `cards(query, page)` | findCards 全量 id → `PAGE_SIZE=50` 切片 → 仅当页 cardsInfo → `{cards, total, page}` |
| `useNotePreview(noteId \| null)` | `note(id)` | notesInfo 单条 |
| `useModelNames()` | `models` | staleTime 10min |
| `useModelFields(modelName \| null)` | `modelFields(名)` | enabled 受控 |
| `useAnkiConnection()`（useConnection.ts） | `anki.status` | version + requestPermission，3s 轮询 → `{status: 'checking'\|'connected'\|'disconnected', version?, error?, refetch}` |

**失效规则**：写操作成功后统一失效 `decks` + `cardsPrefix`；复习会话结束（phase→done）同样处理。

### 2.7 Zustand stores

**stores/app.ts**（应用级）

```ts
type View = "browse" | "editor" | "review" | "stats";
type Direction = "graphite" | "aurora" | "slate" | "carbon" | "nocturne" | "amber";
state: { view, direction, dark, sidebarCollapsed }   // 持久化 ra.direction / ra.dark / ra.sidebarCollapsed
actions: setView / setDirection / toggleDark / toggleSidebar
helpers: applyTheme(direction, dark)    // 操作 <html> data-direction + .dark
         DIRECTIONS（显示名映射）/ viewTitle(view)
```

**stores/editor.ts**（全局编辑面板）

```ts
state: { editingNoteId: number|null, newNoteOpen: boolean, newNoteDefaultDeck: string|null }
actions: openEditor(noteId) / closeEditor() / openNewNote(defaultDeck?) / closeNewNote()
```

**stores/review.ts**（复习会话状态机）

```ts
type ReviewPhase = "idle" | "question" | "answer" | "done";
type Ease = 1 | 2 | 3 | 4;
const MAX_QUEUE = 300;
state: { deck, queue: CardInfo[], index, phase, answered: AnsweredRecord[],
         buriedSession: number[], starting, error }
actions:
  start(deck)   // findCards(deck + is:due) → cardsInfo → 过滤 buriedToday → shuffle → 队列
  reveal()      // question → answer
  answer(ease)  // answerCards 即时提交；失败停留原卡
  bury()        // 加入 buriedToday（localStorage ra.buried.YYYY-MM-DD）并推进，零调度副作用
  exit()        // 回 idle
selector: selectCurrentCard(s)
```

### 2.8 工具库 API

**lib/media.ts**（媒体管线）

```ts
resolveMediaUrl(filename: string): Promise<string | null>
// Tauri：invoke read_media_file → base64 → Blob URL；失败/浏览器：retrieveMediaFile 兜底
// LRU 缓存 MAX_CACHE=120（淘汰时 revokeObjectURL）；按扩展名映射 MIME
isLocalMediaSrc(src: string): boolean  // 排除 http(s):/data:/blob:/anki:/file:
```

**lib/db/stats.ts**（SQLite 统计层，仅 Tauri 模式；库文件 `sqlite:reasonix-stats.db`）

```ts
localDate(ms: number): string                                  // 本地时区 YYYY-MM-DD
syncDeck(deckId, deckName): Promise<{inserted, watermark}>     // 读水位线 → cardReviews 增量 → 批量 INSERT OR IGNORE（200/批）→ 更新水位线 → 重算受影响日期的 deck_daily
getDaily(deckId): Promise<DailyRow[]>                          // {date, reviews, time_ms}
getWatermark(deckId): Promise<number | null>
rebuildDeck(deckId, deckName): Promise<void>                   // 清三表数据重拉（同步回滚兜底）
```

表结构：

```sql
revlog(review_time, card_id, deck_id, ease, ivl, duration, type,
       PRIMARY KEY(review_time, card_id))                    -- 原始日志，幂等插入
deck_daily(deck_id, date, reviews, time_ms, again, hard, good, easy,
       PRIMARY KEY(deck_id, date))                           -- 聚合表，UI 只读它
watermark(deck_id PRIMARY KEY, last_ts)                       -- 增量水位线
```

日期聚合 SQL 用 `date(review_time/1000, 'unixepoch', 'localtime')`，与 JS `localDate` 一致。

### 2.9 UI 组件库

`@reasonix/ui`（vendor tgz，38 组件 + cn）：Button/Badge/Card/Dialog/Sheet/Select/Table/Tabs/Alert/Skeleton/Progress/ScrollArea/Resizable*/DropdownMenu/InputGroup/Textarea/Input/Label/Separator/Pagination/Tooltip/Toaster…（完整导出面见 design-kit `packages/ui/src/index.ts`）。图标 `lucide-react` 已随依赖安装。主题令牌与动效类见 `../reasonix-design-kit/apps/showcase/src/index.css` 同款映射（已打包进 styles.css）。

---

## 3. AnkiConnect 实测陷阱速查（改代码前必查）

| Action | 陷阱 | 正确姿势 |
|---|---|---|
| `deckNamesAndIds` | **返回对象不是数组** | `Object.keys()` 遍历；曾按数组解析直接崩 |
| `getDeckStats` | counts 是**今日剩余额度**不是总数；个别牌组可能不返回（如"系统默认"） | 总数用 `total_in_deck`；"已学/上限" = `perDay − count`；UI 对缺失 stats 防御 |
| `cardsInfo` | fields 键是 **value 不是 text**；复习卡 `due` 是**绝对天数**（无 crt 接口换算日期） | 摘要取 order 最小字段的 value；due 只显示语义状态 |
| `cardReviews` | **牌组级**增量；按卡片查用 `getReviewsOfCards`，两者勿混 | startID=上次水位线（不含） |
| `answerCards` | ease 1–4，提交失败需可重试 | 停留原卡，不推进队列 |
| `deleteNotes` | 吃 **note id**，删笔记全部卡片 | 确认弹窗说明影响范围 |
| `addNote` | 返回 null=失败（多为重复） | 提示"常见原因：重复" |
| `storeMediaFile` | 同名覆盖 | 文件名带时间戳+随机后缀 |
| 统计两接口 | **全局口径**（跨牌组） | 单牌组走 SQLite deck_daily |
| `multi` | 未使用 | 列表聚合减往返时可引入 |

---

## 4. 卡片渲染规则（CardRenderer，M3 核心）

渲染管线顺序（`features/review/CardRenderer.tsx` 的 `processHtml`）：

1. **收集媒体名**：字段值里的 `[sound:]`（按字段顺序，供 `[anki:play]` 映射）+ HTML 内 `[sound:]` + `[src]` 属性 + **`<style>` 里的 `url()`**（@font-face 字体、背景图）。
2. **并行解析**：`resolveMediaUrl`（§2.8）。
3. **标记替换**：
   - `[anki:play:q/a:N]` → `<audio controls>`：从字段声音列表按索引取（单音频卡精确；多音频按字段顺序近似）。**注意**：Anki 渲染后的 HTML 里音频是 `[anki:play:X:N]`，`[sound:]` 只存在于字段原始值。
   - 裸 `[sound:x]` → `<audio controls>`。
4. **DOM 替换**：`src` 属性与 `<style>` 内 `url()` 换 blob URL。
5. **消毒**：安全模式走 `DOMPurify.sanitize` 收尾；脚本模式跳过消毒（用户显式信任）。
6. **iframe**：`srcDoc` 注入模板 CSS + 主题色；暗色时 body 挂 `nightMode` 类（重模板自带夜览样式）；脚本模式额外注入按键转发脚本（`__reasonixKey` postMessage → ReviewSession 监听，否则焦点在卡片内时评分键失效）。

**新发现媒体形态时**：先 `cardsInfo` 拉真实样本卡诊断（question/answer HTML + 字段扫描），再改管线——不要凭空猜模板行为。用户的 KenJapaneseMining 是 JS 全驱动模板（问题面静态 HTML 无任何 img/audio），是脚本模式存在的理由。

---

## 5. 状态与缓存约定

- queryKeys 目录见 §2.6；**新增查询必须走 queryKeys 工厂**，勿手写裸 key。
- 写操作成功 → 失效 `decks` + `cardsPrefix`（见 §2.6 失效规则）。
- 复习/编辑面板的状态不进 Query（§1.3）。
- 主题切换只操作 `<html>` 属性，不重挂载组件树；localStorage 键前缀统一 `ra.*`（ra.direction / ra.dark / ra.sidebarCollapsed / ra.buried.YYYY-MM-DD / ra.reviewScripts）。

---

## 6. 样式规范

- 入口 `src/index.css`：`@import "tailwindcss"` + `"tw-animate-css"` + `"@reasonix/ui/styles.css"`，**必须保留** `@source "../node_modules/@reasonix/ui/dist"`（否则组件类名不生成，样式全丢）。
- `@reasonix/ui/styles.css`（dist/index.css）自包含全部主题映射与 32 keyframes，无需 shadcn/tailwind.css。
- 组件类名用 reasonix 语义：`rx-accent-soft` / `rx-press` / `rx-anim-*` / `rx-pulse` 等。
- react-resizable-panels 是 **v4**：`ResizablePanelGroup` 属性名 `orientation`（不是 direction）。
- 通知：M0–M3 用 `ToasterLite`（zustand 驱动）；sonner 虽已随 peer 安装但刻意未启用（评审决策），M4+ 再评估。
- **无边框圆角窗口**（Win10 无原生圆角，刻意设计）：`decorations:false + transparent:true + shadow:false`；html/body 透明，应用背景由 App 根容器 `rounded-[var(--rx-r-l)]` 提供；header 是自绘标题栏 + `WindowControls`。**勿恢复 decorations、勿给 html/body 加回不透明背景、勿开 shadow**。方案对比、决策依据与实现细节见 **§11**。

---

## 7. 开发命令与验证纪律

### 7.1 命令

```bash
npm run tauri dev      # Tauri 窗口（改 Rust 会自动重编译重启）
npm run dev            # 纯浏览器调试：localhost:1420，/anki → vite proxy → 8765
npm run tauri build    # NSIS 安装包 → src-tauri/target/release/bundle/nsis/
npx tsc --noEmit       # 类型检查
npm run build          # tsc + vite 生产构建
```

前置：Anki 运行中 + AnkiConnect 插件（代码 2055492159）。

### 7.2 验证纪律（每条都有过教训）

1. **调用 AnkiConnect 一律用 Node fetch，禁用 curl**：Windows Git Bash 的 curl 会把中文变 GBK，AnkiConnect 报 utf-8 解码错误（假故障）。
2. **大文档抓取**：WebFetch 对巨型 README 会截断——`curl` 下载 HTML 后用 node 正则提取目标段落。
3. **SQL 验证**：用 `node:sqlite`（Node 25 内置 DatabaseSync）跑与 `lib/db/stats.ts` 完全一致的 DDL/DML + 真实 revlog 数据，禁止只靠读代码判断 SQL 正确性。
4. **写操作测试不污染用户库**：测试笔记放 `ceshi` 牌组、打 `reasonix-*-test` 标签，回路测完立即 deleteNotes 并 findNotes 确认零残留；复习测试用 B（会话内 bury）滑过，不真评分。
5. 改动后链路：`tsc` → `vite build` → （改了 Rust 则 `cargo check`）→ 窗口/HMR 实测。
6. pip 连不上 pypi（镜像也不行）——图像处理用 ffmpeg（本机已装），别指望临时装 Python 包。

---

## 8. 更新 @reasonix/ui

```bash
cd ../reasonix-design-kit/packages/ui && npm run pack   # 重打 tgz
cp reasonix-ui-*.tgz ../../reasonix-anki/vendor/
cd ../../reasonix-anki && npm i ./vendor/reasonix-ui-*.tgz
```

UI 库 API 参考 design-kit 的 AGENTS.md 与 `docs/DESIGN.md`；组件导出面见其 `packages/ui/src/index.ts`。

---

## 9. 常见陷阱速查

| 陷阱 | 正确做法 |
|---|---|
| features/ 直属组件导入写成 `../../lib/...` | 上溯一级：`../lib/...`（子目录才是 `../../`） |
| 组件里直接 invoke/fetch 调 Anki | 走 actions.ts 类型化函数 |
| 复习流加进 TanStack Query | Zustand 状态机（§1.3） |
| 默认允许卡片脚本 | 安全沙箱为默认，脚本模式需用户显式开关 |
| 静默调用 setDueDate | 必须确认弹窗 + 文案说明调度影响 |
| curl 测中文牌组名报 utf-8 错 | 换 Node fetch（§7.2.1） |
| 新组件样式没生效 | 检查 `@source` 还在不在 index.css |
| Rust async command 持 MutexGuard 跨 await | 报 future 非 Send：读写分开加锁（commands.rs 有范例） |
| 媒体文件名含日文/空格 | 合法，PathBuf 直读正常；只拦 `.. / \ :` |
| 统计热力图用全局接口查单牌组 | 单牌组走 SQLite deck_daily；全局才用 getNumCardsReviewedByDay |
| Tauri 窗口内 fetch 直连 8765 | CORS 拦截——必须走 invoke（transport 已处理，别绕过） |
| 改了 tauri.conf.json / capabilities 但窗口行为没变 | 配置经 generate_context! 编译期内嵌；cargo 指纹偶尔不触发重建——`touch src-tauri/src/lib.rs` 强制 watcher 重编译重启 |

---

## 10. 项目状态与后续路线（2026-08-09）

- **已完成**：M0 脚手架 → M1 牌组浏览器 → M2 笔记编辑 → M3 复习（含脚本模式补丁）→ M4 统计（SQLite 增量）→ M5 打包（NSIS 3.1MB，自定义图标）。全部经真实 Anki 数据联调。
- **git**：仓库已 init、文件已暂存、**无 commit**（用户机器未配 git 身份；代理不得擅自改 git config）。
- **M6（可选）**：sonner 复杂通知 / react-router（若出现深层链接）/ 动效打磨。
- **M7（可选）**：自写 Anki 配套插件（addon-docs.ankiweb.net），补接口缺口：真 bury（`col.sched.bury_cards`）、全库复习日志（直查 revlog 表）、集合变更推送、due 日期换算（集合创建时间）。启动时用 `apiReflect` 探测，装了增强、没装自动降级。

---

## 11. 窗口圆角方案（Windows 10）：决策依据与实现细节

### 11.1 背景与问题

Win10 的 DWM 窗口边框**永远是直角**——只要保留原生标题栏（`decorations`）就无法圆角。Win11 会由 DWM 自动给窗口圆角，但本项目目标环境是 Win10（10.0.19045），必须自行实现。用户诉求：现代应用的圆角窗口效果。

### 11.2 方案调研对比（2026-08-10 联网核实，死路均已验证）

| 方案 | 适用 | 结论 |
|---|---|---|
| `decorations:false + transparent:true + CSS 圆角 + 自绘标题栏` | 全平台 Web 系 | ✅ **社区标准答案，本项目采用**（SO 76180922 两个高票答案、Tauri 官方 window-customization 文档同此路线） |
| winapi `DwmEnableBlurBehindWindow` | 仅 Win7/Vista | ❌ Win8+ 失效（SO 77896185 实测） |
| winapi `CreateRoundRectRgn` + `SetWindowRgn` | Windows | ❌ 产生大白边 |
| `window-vibrancy` 的 `apply_vibrancy(..., Some(16.0))` | 仅 macOS | ❌ 平台不符 |
| `macOSPrivateApi: true` | 仅 macOS | ❌ 平台不符，且私有 API 不稳定 |
| Qt 框架（如 QRoundedFrame） | Qt/QML 应用 | ❌ 与 Tauri + React 技术栈不符 |

### 11.3 采用实现（三层）

1. **窗口层**（tauri.conf.json）：`decorations: false`（去原生标题栏）+ `transparent: true`（四角可透出）+ `shadow: false`（**必须 false**，见 §11.4）。
2. **样式层**：html/body 背景透明（index.css 无层规则覆盖 reasonix `@layer base` 的 body 背景 + index.html 内联防启动闪白）；应用背景由 App.tsx 根容器 `rounded-[var(--rx-r-l)]`（11px 设计令牌）+ `overflow-hidden` 提供，四角透出成圆角。
3. **交互层**：App 的 header 升级为自绘标题栏——`onMouseDown` → `startDragging()`、`onDoubleClick` → `toggleMaximize()`、`select-none`；右侧挂 `components/WindowControls.tsx`（最小化/最大化/关闭，关闭悬停 `--rx-danger`，容器 `stopPropagation` 防误触拖拽）；capabilities 加 `core:window:allow-{minimize,toggle-maximize,close,start-dragging,is-maximized}`；浏览器调试模式 `inTauri` 门控隐藏控制按钮。

### 11.4 关键坑（均已踩过或经 issue 验证）

1. **shadow 必须 false**：Win10 上透明圆角窗口开原生阴影，会渲染成圆角周围的**矩形边框残留**（Win11 无此问题）。tauri issue #11321（已关闭，报告者以 `setShadow(false)` 解决）与 #9287（多位开发者确认 `"shadow": false` 去除边框状阴影）。
2. **配置编译期内嵌**：tauri.conf.json / capabilities 经 `generate_context!` 打进二进制；改配置后 cargo 指纹偶尔不触发重建——`touch src-tauri/src/lib.rs` 强制 watcher 重编译重启（同 §9）。
3. **html/body 必须保持透明**：加回不透明背景 → 圆角立即失效。
4. **勿恢复 decorations**：原生标题栏回来 = 直角回来。
5. **启动闪白**：index.html 内联 `html,body{background:transparent}` 兜底（CSS 加载前）。

### 11.5 已知取舍与后续可选项

- 关闭原生阴影后窗口无投影、偏"平面"。社区补偿做法是 CSS 假阴影（窗口内缩 ~8px + box-shadow），但需处理最大化态去除内缩、Radix 模态 portal 位置——**当前未采用**，用户明确要求再实现。
- 自绘拖拽基于 JS（mousedown），仅覆盖鼠标；触屏/手写笔可补 `[data-tauri-drag-region] { app-region: drag }`（Tauri 官方提示）。
- 官方推荐的拖拽写法是单 handler 内判 `e.buttons === 1` + `e.detail === 2 ? toggleMaximize : startDragging`，本项目用等价的双 handler 实现，行为一致。

### 11.6 参考出处

- Tauri 官方：https://v2.tauri.app/learn/window-customization/
- Stack Overflow 76180922（tauri 窗口圆角，CSS 透明方案共识）
- Stack Overflow 77896185（winapi/DWM 路线死路验证）
- tauri-apps/tauri issue #11321（Win10 圆角阴影残留，解法 shadow:false）
- tauri-apps/tauri issue #9287（圆角与阴影问题讨论，shadow:false 共识）
