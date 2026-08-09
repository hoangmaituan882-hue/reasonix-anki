# Reasonix Anki 工作台 — 技术方案

> 定位：基于 AnkiConnect 的综合 Anki 桌面工作台（牌组浏览 / 笔记增删改 / 自定义复习 / 统计概览）
> 形态：Tauri 2 桌面应用 · React 19 SPA 前端 · 消费 `@reasonix/ui` 组件库
> 日期：2026-08-09 · 状态：评审修订 · v1.2（吸收评审意见：stats 口径 / 复习会话状态机 / 会话内 bury / SQLite 增量统计 / API 双通道 / YAGNI 裁剪；接口签名已按 AnkiConnect 原文核实，参考资料见 §12）

---

## 1. 选型总览

| 层 | 选型 | 版本 | 理由 |
|---|---|---|---|
| 桌面壳 | **Tauri** | 2.x | 无 CORS 问题（Rust 层转发请求）、产物小（~10MB vs Electron ~150MB）、Rust 1.94 本机已就绪 |
| 前端框架 | **React** | 19 | `@reasonix/ui` 仅支持 React（peerDeps 声明 18/19），无替代 |
| 语言 | **TypeScript** | 5.x strict | AnkiConnect 响应无类型，靠 zod 运行时校验 + 生成的 TS 类型兜底 |
| 构建 | **Vite** | 7 | Tauri 官方推荐前端构建器，HMR 快，`tauri dev` 直接挂接 |
| 样式 | **Tailwind CSS** | v4（@tailwindcss/vite） | reasonix-ui 的 peer 要求 v4；`styles.css` 提供 `--rx-*` 令牌与 6 主题方向 |
| UI 组件 | **@reasonix/ui** | 0.2.0（本地 tgz） | 按约定走独立项目 + `file:` 安装 |
| 查询层状态 | **TanStack Query** | v5 | 只用于查询型数据（牌组树 / stats / 搜索结果）的缓存与失效 |
| 会话层状态 | **Zustand** | v5 | 复习会话状态机、视图切换、主题、连接状态——命令式流程不进 Query |
| 本地持久化 | **tauri-plugin-sql**（SQLite） | — | M4 统计：复习日志聚合表 + 增量水位线（见 §5.4） |
| 响应校验 | **zod** | v4 | AnkiConnect 返回是裸 JSON，入口统一 parse，错误提前暴露 |
| 卡片渲染安全 | **DOMPurify** + iframe sandbox | — | 卡片 HTML 来自用户模板，必须消毒（见 §6） |
| 视图切换 | **Zustand `currentView`** | — | 桌面单窗口无地址栏、无分享/后退需求，react-router 推迟到出现深层链接需求再评估（YAGNI） |
| 通知 | **sonner → M4 再启用** | — | 前期用 reasonix `Alert` + 内联反馈顶住；注意 sonner 是 @reasonix/ui 的 peer 依赖，npm 会自动安装，"延迟"指的是延迟使用而非省安装 |
| 图标 | **lucide-react** | 随 reasonix-ui | 已是 `@reasonix/ui` 的 dependency；图标名在 lucide.dev 查，无需额外安装 |
| API 通道 | **双通道抽象** | — | Tauri 内走 Rust command，浏览器调试走 Vite proxy fetch——核心逻辑不绑死壳（见 §2.1） |

本机环境已核验：Node v25.8.1 / npm 11.11.0 / rustc & cargo 1.94.0，满足 Tauri 2 要求（Windows 另需 WebView2，Win10 21H2+ 系统自带）。

---

## 2. 总体架构

```
┌─────────────────────────── Tauri 窗口 (WebView2) ───────────────────────────┐
│  React SPA                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ 牌组浏览器  │  │ 笔记编辑器  │  │ 复习视图    │  │ 统计概览    │            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
│        └───────────────┴───────┬───────┴───────────────┘                    │
│        lib/anki（transport 双通道 + 类型化 action + zod 校验）               │
│        ┌───────────────────────┴───────────────────────┐                    │
│        │ 查询层 TanStack Query      会话层 Zustand       │                    │
│        │ （牌组/stats/搜索结果）    （复习状态机/视图/主题）│                    │
│        └───────────────────────┬───────────────────────┘                    │
│                     tauri-plugin-sql（统计聚合表，M4）                       │
└──────────────────────────────┬──────────────────────────────────────────────┘
              Tauri 环境：invoke("anki_request", …)│浏览器环境：fetch("/anki", …)
┌──────────────────────────────▼──────────────────────────────────────────────┐
│  Rust core (src-tauri)                    Vite dev server（仅浏览器调试）     │
│  commands/anki.rs — reqwest POST          proxy: /anki → 127.0.0.1:8765     │
│  · 超时/重试 · apiKey 注入 · 统一解包                                        │
│  媒体直读 — getMediaDirPath + Rust std::fs 直读（见 §6）                     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTP (仅 localhost)
                        Anki + AnkiConnect 插件
```

### 2.1 API 双通道：核心逻辑不绑死 Tauri

生产路径走 Rust command（无 CORS、统一超时重试、apiKey 集中注入）；但前端入口做 transport 抽象，开发期可直接在 Chrome 里开 DevTools 调试（Tauri 的 DevTools 体验差一截），也保留了将来发网页 demo 的可能：

```ts
// lib/anki/transport.ts
import { invoke } from '@tauri-apps/api/core'

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function ankiCall(action: string, params: unknown) {
  if (inTauri) {
    return invoke('anki_request', { action, params })       // 生产路径
  }
  const res = await fetch('/anki', {                        // 浏览器调试路径
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params, version: 6 }),
  })
  const body = await res.json()
  if (body.error) throw new Error(body.error)
  return body.result
}
```

浏览器通道的 CORS 由 Vite dev proxy 解决（服务端转发，§3.4）。两条通道返回同构的 `result`，上层 action 函数完全无感。**发布形态仍是纯 Tauri**，浏览器模式只服务开发调试。

### 2.2 Rust 侧只需两个 command（已对照 Tauri v2 官方文档核实）

```rust
// src-tauri/src/commands/anki.rs —— 独立模块中的 command 必须 pub
#[tauri::command]
async fn anki_request(action: String, params: serde_json::Value) -> Result<serde_json::Value, String>
// POST http://127.0.0.1:8765 {"action", "version": 6, "params", "key"?}
// 解析响应：error != null → Err(error)；否则返回 result

#[tauri::command]
async fn anki_status() -> Result<AnkiStatus, String>
// 组合 version + requestPermission，供连接指示器轮询

// builder 注册：.invoke_handler(tauri::generate_handler![anki_request, anki_status])
```

前端用 `@tauri-apps/api/core` 的 `invoke` 调用（参数名 camelCase 自动映射），`Result<T, String>` 对应 Promise 的 resolve/reject。Rust 层刻意做薄——90% 的代码留在 TS 里，可测、可热更新。

### 2.3 数据状态分层：查询层与会话层分治

TanStack Query 只负责**查询型数据**（牌组树、getDeckStats、搜索结果、笔记详情）：缓存、重试、`invalidateQueries` 失效重取。

复习流程是**命令式状态机**（拉队列 → 逐张出卡 → 评分 → 下一张），`findCards` 只在会话开始调一次，之后全是 `answerCards` 这类 mutation——放进 Query 只会陷入手动维护缓存失效的泥潭。因此会话层由 Zustand 单 store 管理（队列、当前索引、已答记录、buried 集合、完成状态），评分直接 async 调用，会话结束后统一 `invalidateQueries(deckStats)` 刷新查询层。

---

## 3. 前端工程结构

```
reasonix-anki/                    # 独立项目，与 reasonix-design-kit 平级
├── vendor/
│   └── reasonix-ui-0.2.0.tgz     # 从 design-kit 打包后拷入
├── src/
│   ├── main.tsx                  # createRoot + QueryClientProvider
│   ├── app/
│   │   └── App.tsx               # 布局：侧栏导航（currentView 切换）+ 连接指示器 + 主题切换
│   ├── lib/
│   │   ├── anki/
│   │   │   ├── transport.ts      # 双通道（invoke / fetch，见 §2.1）
│   │   │   ├── actions.ts        # 类型化 action 函数（见 §4.2）
│   │   │   ├── schemas.ts        # zod：CardInfo / NoteInfo / DeckStats / RevlogRow…
│   │   │   └── query.ts          # queryKeys + 查询层 useQuery 工厂
│   │   └── db/
│   │       └── stats.ts          # tauri-plugin-sql：聚合表读写（M4）
│   ├── features/
│   │   ├── browse/               # M1 牌组浏览器
│   │   ├── editor/               # M2 笔记增删改
│   │   ├── review/               # M3 复习（含 CardRenderer）
│   │   └── stats/                # M4 统计
│   ├── stores/
│   │   ├── app.ts                # currentView / theme / connection
│   │   └── review.ts             # 复习会话状态机（见 §5.3）
│   └── styles/
│       └── app.css               # @import "tailwindcss"; @import "@reasonix/ui/styles.css";
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── commands/anki.rs
│   ├── capabilities/default.json # 最小权限 + sql 插件权限（见 §3.3）
│   └── tauri.conf.json
├── index.html
├── vite.config.ts                # 含 /anki dev proxy（见 §3.4）
└── package.json
```

### 3.1 安装 @reasonix/ui（file: 链接流程）

```bash
# 1) 在 design-kit 里打 v0.2.0 包（现有 tgz 是 0.1.0，需重打）
cd F:\2028\ces\reasonix-design-kit\packages\ui
npm run pack                     # typecheck + test + build + pack → reasonix-ui-0.2.0.tgz

# 2) 拷入新项目并安装
cp reasonix-ui-0.2.0.tgz F:\2028\ces\reasonix-anki\vendor\
cd F:\2028\ces\reasonix-anki
npm i ./vendor/reasonix-ui-0.2.0.tgz

# 3) 安装 peerDependencies（按 package.json 实际声明；sonner 为必需 peer，M4 前不使用其 UI）
npm i react react-dom radix-ui vaul sonner cmdk react-day-picker \
      react-resizable-panels embla-carousel-react tailwindcss tw-animate-css
```

> 注意：README 安装行里写了 `next-themes`，但 0.2.0 的 peerDeps 里没有它；主题切换用 zustand 直接操作 `data-direction` 属性即可，不必引入 next-themes。
>
> 组件库更新后需重新 `npm run pack` + `npm i ./vendor/…`（package.json 里建议固定 `"@reasonix/ui": "file:vendor/reasonix-ui-0.2.0.tgz"`）。

### 3.2 主题接入

```tsx
// stores/app.ts —— 默认 graphite（暗），跟随 reasonix 设计规范
document.documentElement.setAttribute('data-direction', dir)  // 6 方向
document.documentElement.classList.toggle('dark', isDark)
```

默认推荐 **graphite 石墨方向 + 暗色**：终端风格、单一暖橙焦点色，与 Anki"专注学习工具"的气质最贴合，也是 DESIGN.md 的默认方向。设置页提供 6 方向 × 明暗切换。

### 3.3 权限配置（Tauri v2 capabilities）

```json
// src-tauri/capabilities/default.json
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": ["core:default", "sql:default"]
}
```

刻意保持**最小权限面**：HTTP 请求走 Rust reqwest（不需要 http 插件权限）；媒体目录由 Rust `std::fs` 直读（不需要 fs 插件权限，也回避了"媒体目录路径运行时才已知、动态 scope 配置麻烦"的问题）；sql 权限仅供统计聚合库。将来若确需前端直读文件，再按 v2 capabilities 机制追加带 scope 的 fs 权限。

### 3.4 Vite dev proxy（浏览器调试通道）

```ts
// vite.config.ts
export default defineConfig({
  server: { proxy: { '/anki': { target: 'http://127.0.0.1:8765', changeOrigin: true, rewrite: p => '/' } } },
  // tauri dev 时前端同样跑在这个 dev server 上，Tauri 窗口内走 invoke，不受影响
})
```

---

## 4. AnkiConnect 服务层设计

### 4.1 协议要点（已对官方文档逐条核对）

- 请求：`POST http://127.0.0.1:8765`，body `{"action", "version": 6, "params": {...}}`；若 AnkiConnect 配置了 `apiKey`，需带 `"key"` 字段
- 响应：`{"result": ..., "error": null}`；`error` 非 null 即失败（前端统一转成 Error + Alert/toast）
- 首次连接应调 `requestPermission`：确认插件已授权，并探测是否需要 key
- `apiReflect` 可在运行时探测可用 action 列表——用于版本差异兜底（老版 AnkiConnect 缺少新 action 时降级提示，而不是白屏）
- `multi` 支持批量执行，列表页聚合多请求时用它减少往返

### 4.2 类型化 action 客户端（签名已按 README 原文核实）

```ts
// lib/anki/actions.ts —— 每个 action 一个函数，入参出参都有类型
export const anki = {
  // 连接
  version: () => call<number>('version', {}),
  requestPermission: () => call<Permission>('requestPermission', {}),
  sync: () => call<null>('sync', {}),

  // 牌组
  deckNamesAndIds: () => call<Record<string, number>>('deckNamesAndIds', {}),
  // ⚠️ 实测返回 Record<牌组名, deck_id> 对象映射（不是数组），M1 联调修正
  getDeckStats: (decks: string[]) => call<Record<string, DeckStats>>('getDeckStats', { decks }),
  // ⚠️ DeckStats.new/learn/review_count 是"今日剩余额度"（受每日上限约束），
  //    total_in_deck 才是牌组总数；要显示上限口径需再调 getDeckConfig（见 §5.1）
  getDeckConfig: (deck: string) => call<DeckConfig>('getDeckConfig', { deck }),
  createDeck: (deck: string) => call<number>('createDeck', { deck }),
  deleteDecks: (decks: string[], cardsToo = true) => call<null>('deleteDecks', { decks, cardsToo }),

  // 检索
  findCards: (query: string) => call<number[]>('findCards', { query }),
  findNotes: (query: string) => call<number[]>('findNotes', { query }),
  cardsInfo: (cards: number[]) => call<CardInfo[]>('cardsInfo', { cards }),
  notesInfo: (notes: number[]) => call<NoteInfo[]>('notesInfo', { notes }),
  cardsToNotes: (cards: number[]) => call<number[]>('cardsToNotes', { cards }),

  // 笔记增删改
  addNote: (note: NewNote) => call<number>('addNote', { note }),
  updateNoteFields: (id: number, fields: Record<string, string>) =>
    call<null>('updateNoteFields', { note: { id, fields } }),
  updateNoteTags: (id: number, tags: string[]) => call<null>('updateNoteTags', { note: id, tags }),
  getTags: () => call<string[]>('getTags', {}),

  // 复习
  answerCards: (answers: { cardId: number; ease: 1|2|3|4 }[]) =>
    call<null>('answerCards', { answers }),
  suspend: (cards: number[]) => call<boolean[]>('suspend', { cards }),
  unsuspend: (cards: number[]) => call<boolean[]>('unsuspend', { cards }),
  // ⚠️ setDueDate 会把 new 卡转成 review 卡（官方文档明示），只在用户明确确认时调用
  setDueDate: (cards: number[], days: string) => call<null>('setDueDate', { cards, days }),
  forgetCards: (cards: number[]) => call<null>('forgetCards', { cards }),

  // 统计（Statistic Actions，签名与直觉不同，注意区分）
  cardReviews: (deck: string, startID: number) => call<RevlogRow[]>('cardReviews', { deck, startID }),
  //   ↑ 按牌组拉取 startID（unix ms 水位线）之后的复习记录，天然支持增量同步（见 §5.4）
  //   RevlogRow = [reviewTime, cardID, usn, buttonPressed, newInterval,
  //                previousInterval, newFactor, reviewDuration, reviewType]
  getReviewsOfCards: (cards: number[]) => call<Record<number, ReviewDict[]>>('getReviewsOfCards', { cards }),
  //   ↑ 按卡片拉全量复习记录（仅单卡详情页用，不做批量统计）

  // 媒体
  getMediaDirPath: () => call<string>('getMediaDirPath', {}),
  retrieveMediaFile: (filename: string) => call<string>('retrieveMediaFile', { filename }),
  storeMediaFile: (filename: string, data: string) => call<string>('storeMediaFile', { filename, data }),

  // 模型（字段结构）
  modelNames: () => call<string[]>('modelNames', {}),
  modelFieldNames: (modelName: string) => call<string[]>('modelFieldNames', { modelName }),
}
```

`call()` 内部：`ankiCall()（transport）→ zod.parse →` 失败抛带 action 名的错误。查询型读操作包 TanStack Query；写操作用 `useMutation`（M1/M2）或 Zustand action（M3 会话内）+ 成功后 `invalidateQueries`。

### 4.3 功能 → 接口映射

| 功能 | 主要 action | 备注 |
|---|---|---|
| 连接指示器 | `version` · `requestPermission` | 3s 轮询；断开显示引导屏 |
| 牌组树 + 待学数 | `deckNamesAndIds` + `getDeckStats` + `getDeckConfig` | counts 是今日剩余额度，上限从 deck config 取（§5.1） |
| 卡片列表 | `findCards(query)` → 分页取 id → `cardsInfo` | 查询语法即 Anki 搜索语法（`deck:"X" is:due tag:…`） |
| 笔记详情/编辑 | `notesInfo` → `updateNoteFields` | 字段按 `modelFieldNames` 动态渲染表单 |
| 新建笔记 | `modelNames` + `addNote` | 选牌组 + 模型 → 动态字段表单 |
| 删除 | `deleteNotes`（笔记级）| 二次确认 Dialog；同时列出影响的卡片数 |
| 标签管理 | `getTags` · `updateNoteTags` · `addTags`/`removeTags` | 自动补全用 Command 组件 |
| 复习队列 | `findCards('deck:"X" is:due')` → `cardsInfo` | Zustand 本地队列，逐张出卡（§5.3） |
| 作答 | `answerCards([{cardId, ease}])` | ease 1–4 = Again/Hard/Good/Easy |
| 会话内 bury | 不调 Anki 接口 | Zustand `buriedToday` 集合过滤（§5.3） |
| 明确推迟 | `setDueDate` | 仅用户带确认弹窗主动触发 |
| 暂停/改期 | `suspend` · `unsuspend` · `forgetCards` | 卡片右键菜单 / DropdownMenu |
| 统计 | `getDeckStats` + `cardReviews(deck, startID)` | SQLite 聚合 + 增量水位线（§5.4） |
| 单卡复习历史 | `getReviewsOfCards` | 仅卡片详情抽屉使用 |
| 同步 | `sync` | 工具栏按钮，触发 Anki 与 AnkiWeb 同步 |
| 导出 | `exportPackage` | 选牌组 → 保存 .apkg（Tauri 文件对话框给路径） |

---

## 5. 四大功能视图（MVP 范围）

### 5.1 牌组浏览器（M1，主视图）

三栏式 `ResizablePanelGroup`：左牌组树（Accordion 展开子牌组，Badge 显示计数）→ 中卡片列表（Table + Pagination，列：正面摘要 / 模板 / 到期 / 标签）→ 右笔记预览。顶部 InputGroup 搜索框直接吃 Anki 查询语法。reasonix 组件映射：`Resizable` · `Accordion` · `Table` · `Badge` · `Pagination` · `DropdownMenu`（行操作：暂停 / 改期 / 编辑 / 删除）。

**stats 口径（评审重点）**：`getDeckStats` 的 `new_count / learn_count / review_count` 是"今日剩余额度"而非牌组总数——100 张新卡、每日上限 20 的牌组返回的是 `new_count: 20`（官方示例即 new_count:20 vs total_in_deck:1506）。因此：

- 牌组树 Badge 显示格式 **"新卡 已学/上限"**：已学 = `getDeckConfig(deck).new.perDay` − `new_count`，上限 = `perDay`；learn/review 同理取 `rev.perDay` 口径
- `total_in_deck` 直接用于副标题的牌组总量，不需要额外 findCards 计数
- `getDeckConfig` 结果按牌组缓存进 Query（deck config 很少变，staleTime 可放宽）

**M1 验收追加**：牌组树"新卡 已学/上限"数字与 Anki 原生界面一致（上限、剩余额度、总数三口径都对得上）。

### 5.2 笔记编辑（M2）

`Sheet` 侧滑编辑面板：按模型字段动态生成表单（Textarea + 简易富文本先不做，保留 HTML 源码编辑 + 实时预览双栏）。新建走 `Dialog`。图片粘贴上传 → 转 base64 → `storeMediaFile` → 插入字段。

### 5.3 复习视图（M3，核心差异化）

不复用 Anki 原生复习窗口（`guiDeckReview` 只是把 Anki 窗口切过去，没有价值），自建复习流。**会话状态机全部在 Zustand**（`stores/review.ts`），不进 TanStack Query：

```ts
type ReviewState = {
  queue: CardInfo[]            // 会话开始时 findCards + cardsInfo 一次拉取
  index: number                // 当前卡
  answered: AnsweredRecord[]   // 已答记录（cardId, ease, ts）
  buriedToday: Set<number>     // 会话内 bury 的 cardId
  phase: 'question' | 'answer' | 'done'
}
```

1. 进入时 `findCards(deck + is:due)` → `cardsInfo` 构建本地队列（乱序可配）
2. 问题面：`CardRenderer` 渲染 `question` HTML（含模板 CSS）→ 底部"显示答案"（Space）
3. 答案面：渲染 `answer` → 四档评分按钮（键盘 1–4），`answerCards` 单张即时提交
4. 进度条（Progress）+ 剩余计数；队列耗尽出完成页（本次统计：张数 / 各档分布），并 `invalidateQueries(deckStats)`
5. **Bury = 会话内行为，不碰 Anki 调度数据**："明天再看"把 cardId 加入 `buriedToday` 并从队列过滤——明天打开应用卡片自然回到队列。`setDueDate "1"` 仅在用户明确点击"推迟到明天"（带确认弹窗，文案注明会改调度）时才调用——官方文档明示 `setDueDate` 会把 new 卡转成 review 卡，静默调用会污染新卡队列与调度预期
6. 键盘流：Space 显示答案、1–4 评分、B 会话内 bury

### 5.4 统计概览（M4：SQLite 聚合 + 增量同步，根治性能）

**问题量级**：复习日志是全量历史——一张用了两年的卡每天复习就是 700+ 条记录，万卡牌组全量拉取是百万级 JSON，纯内存方案不可行。

**方案**（`cardReviews` 原生支持按水位线增量，签名 `{deck, startID}`，返回该牌组 startID 之后的记录，已按 README 核实）：

1. **本地 SQLite**（tauri-plugin-sql）两张表：
   - `revlog(review_time, card_id, deck_id, ease, ivl, duration, type, PRIMARY KEY(review_time, card_id))`——原始日志
   - `deck_daily(deck_id, date, reviews, time_ms, again/hard/good/easy…)`——按日聚合，UI 只读这张表，毫秒级响应
2. **首装全量**：对每个牌组 `cardReviews(deck, 0)` 拉全量 → 批量写入 → 更新 `watermark(deck_id) = max(review_time)`
3. **日常增量**：进入统计页 / 复习会话结束时，只拉 `cardReviews(deck, watermark)` 的增量合并入库（一次会话产生的增量通常几十~几百条）
4. **兜底**：提供"重建本地统计"按钮（清表重拉），处理 Anki 侧同步/回滚导致的水位线失效；跨牌组全库统计的更高性能版本留给配套插件（§11）

**M4 验收**：万卡级牌组首次全量同步后，统计页打开 < 1s（读本地聚合表）；增量同步正确性用"复习 10 张 → 热力图当日 +10"验证。

---

## 6. 卡片 HTML 渲染与安全

卡片 HTML = 用户模板 + 字段内容，**视为不可信输入**：

1. **DOMPurify 消毒**：白名单标签/属性，剥掉 `on*` 事件、`javascript:` URL、`<script>`
2. **iframe 沙箱渲染**：`<iframe sandbox="allow-same-origin">`（不给 `allow-scripts`），注入模型 CSS 与媒体；彻底隔离页面主运行时
3. **媒体解析**（两档策略）：
   - 首选：启动时 `getMediaDirPath` 取媒体目录缓存进 Rust state，提供 `read_media_file` command 用 `std::fs` 直读返回 base64——图片/音频零中转，且无需任何 fs 插件权限
   - 兜底：`retrieveMediaFile` 返回 base64 → Blob URL（媒体目录不可读时），LRU 缓存避免重复请求
4. **音视频**：替换为 `<audio controls>`/`<video controls>` + blob src；自动播放在 WebView2 需用户手势后放行，复习"显示答案"点击即是手势，问题不大。**M3 实测发现**：Anki 渲染后的 question/answer HTML 里音频是 `[anki:play:q/a:N]` 标记（不是 `[sound:]`，后者只存在于字段原始值中）——渲染器从卡片字段值收集 `[sound:]` 文件列表，按标记索引映射（单音频卡精确对齐）
5. **LaTeX**：Anki 默认把 LaTeX 预渲染成图片（存媒体目录），走上面媒体链路即可覆盖；原生 `\(...\)` 数学公式（mathjax 插件用户）后续按需加 KaTeX

---

## 7. 已知局限与对策（v1.2 修订）

| 局限 | 影响 | 对策 |
|---|---|---|
| stats 是"今日额度"非总数 | UI 数字与直觉不符 | `total_in_deck` + `getDeckConfig` 双口径显示（§5.1），M1 验收强制对齐 Anki |
| 复习日志是全量历史 | 万卡牌组全量拉取不可行 | `cardReviews(deck, startID)` 增量 + SQLite 聚合表（§5.4），从"缓解"升级为根治 |
| 无 bury（搁置）action | 复习中"明天再看"无原生语义 | 会话内 bury（Zustand 过滤，零副作用）；`setDueDate` 仅明确确认后调用（§5.3） |
| `guiUndo` 只作用于 Anki 原生界面 | 自建复习无法走它撤销 | 答错档后提供"重答本卡"（再次 `answerCards`）作为软撤销 |
| Anki 必须运行且装了 AnkiConnect（2055492159） | 应用无法独立工作 | 连接状态机 + 引导屏（含插件安装链接）+ 自动重试 |
| 某些环境配置了 apiKey | 无 key 请求被拒 | 首连 `requestPermission` 探测，设置页可填 key |
| `findCards` 大结果集 | 一次性返回全部 id | 列表固定分页窗口（如 50 张/页），只 `cardsInfo` 当页 |
| 复习卡 `due` 是绝对天数编号 | 自集合创建起的天数，换算日期需集合创建时间，而 AnkiConnect 未提供 | 列表只显示状态语义（新卡/学习中/复习/已暂停），日期列待配套插件（§11）补 |

以上局限中，bury、跨牌组统计、变更推送等若要根治，靠自写配套 Anki 插件（见 §11）；插件未安装时全部有可用降级。

---

## 8. 里程碑与验收（v1.2 修订版）

| 里程碑 | 内容 | 验收标准 | 状态（2026-08-09） |
|---|---|---|---|
| **M0 脚手架**（0.5 天） | Tauri + React + TS + Tailwind v4 + reasonix-ui + **API 双通道抽象** + 连接指示器 | `tauri dev` 起窗；**浏览器 localhost 也能跑**；Anki 开/关时指示器正确切换 | ✅ 完成。实测修正：deckNamesAndIds 返回对象映射；Tailwind 需 `@source` 扫描 ui 包 dist；resizable v4 属性名为 orientation |
| **M1 牌组浏览器**（1–2 天） | 牌组树 + stats（**含每日上限口径**）+ 卡片列表 + 搜索 + 行操作菜单 | 待学数显示"已学/上限"格式且与 Anki 原生数字一致 | ✅ 完成。真实数据验证（ceshi 新 0/20 等）；复习卡 due 为绝对天数、仅显示语义状态（见 §7） |
| **M2 笔记编辑**（1–2 天） | 动态字段表单 / 新建 / 编辑 / 删除 / 标签 / 图片粘贴 | 改动回 Anki 可查；删除有确认 | ✅ 完成。addNote→notesInfo→updateNote→deleteNotes 全回路实测并清理 |
| **M3 复习视图**（2–3 天） | 队列（**Zustand 状态机**）+ 消毒渲染 + 评分提交 + 键盘流 + **会话内 bury** + 完成页 | 评分后 Anki 到期日正确变化；bury 不产生任何调度变更 | ✅ 完成 + 补丁：用户的 JS 驱动背词模板需要执行脚本——新增**脚本模式**开关（默认关=严格沙箱；开=等同 Anki 原生信任），并解析 `<style>` 内 url() 媒体、nightMode 适配、iframe 按键转发 |
| **M4 统计概览**（1.5 天） | 牌组汇总卡 + 选中牌组热力图（**SQLite 聚合 + 增量水位线**） | 数字与 Anki 统计大体一致；万卡级牌组统计页打开 < 1s | ✅ 完成。三表结构 + 水位线增量经 node:sqlite 用真实 revlog 验证，与 getNumCardsReviewedByDay 交叉一致 |
| **M5 打包发布**（0.5 天） | 应用图标 / NSIS 安装包 / 开机连接引导 | 双击安装包可用，无需开发环境 | ✅ 完成。自定义图标（ffmpeg 去生成水印后重制 50 尺寸）；NSIS currentUser 安装包 3.1MB；release exe 独立运行冒烟通过 |
| M6 打磨（可选，1 天） | 引入 sonner 复杂通知 / react-router（若出现深层链接需求）/ 动效打磨 | 按需评估 | 未开始 |
| M7 配套插件（可选） | 自写 Anki 插件补剩余缺口（见 §11） | 启动时探测，装了增强、没装降级 | 未开始 |

质量约定：lib/anki 服务层 vitest 单测（mock transport）；关键交互组件（复习评分流、删除确认）带 RTL 测试；沿用 reasonix 的设计纪律（无硬编码色值、全走 `--rx-*`、键盘可达）。

---

## 9. 风险清单

1. **Windows 构建工具链**：Rust 已就绪，但 Tauri 编译需要 MSVC Build Tools。若 `cargo build` 报 link 错误，需安装 "Desktop development with C++" 工作负载（M0 第一步先跑通空窗口编译，尽早暴露）。
2. **AnkiConnect 版本差异**：动作签名以官方 master 文档为准（本方案已逐条核对），运行时用 `apiReflect` 探测兜底，缺失动作给提示而非崩溃。
3. **大媒体文件**：音频/视频经 base64 通道会明显膨胀（+33% 体积 + 内存），务必优先 Rust fs 直读链路；M3 联调时实测确认。
4. **卡片模板里的自定义 JS**：沙箱禁脚本后，依赖 JS 的交互型模板（如可点击填空）会失效——这是安全换功能的取舍，文档中明示；后续可为"信任的牌组"开放受限脚本。
5. **UI 库同步成本**：file: tgz 方式下 design-kit 更新需手动重打包。建议给 reasonix-design-kit 加一条 `npm run pack:anki` 便捷脚本（pack + 拷贝一步到位）。
6. **双通道一致性**：浏览器 fetch 通道与 Tauri invoke 通道的错误形态、超时行为需保持同构（transport 层统一归一化）；e2e 验证以 Tauri 模式为准，浏览器模式仅用于开发调试。
7. **SQLite 水位线失效**：AnkiWeb 同步回滚 / 换 profile 会让本地 revlog 与水位线失真——提供"重建本地统计"入口（§5.4），并在检测到 deck 卡片数突变时提示重建。

---

## 10. 建议的开工命令（M0）

```bash
cd F:\2028\ces
npm create tauri-app@latest reasonix-anki -- --template react-ts --manager npm
cd reasonix-anki
npm i -D tailwindcss @tailwindcss/vite
npm i @tanstack/react-query zustand zod dompurify \
      radix-ui vaul cmdk react-day-picker react-resizable-panels \
      embla-carousel-react tw-animate-css sonner @tauri-apps/plugin-sql
npm i ./vendor/reasonix-ui-0.2.0.tgz
cd src-tauri && cargo add reqwest -F json -F rustls-tls && cargo add serde_json \
  && cargo add tauri-plugin-sql && cd ..
npm run tauri dev      # 或 npm run dev 纯浏览器调试（走 /anki proxy）
```

评审通过后，我可以按 M0 → M5 逐里程碑实现，或只实现到某个里程碑后交回给你继续。

---

## 11. 配套 Anki 插件（后续演进，对应 M7）

AnkiConnect 是通用桥，§7 列的能力缺口如果要根治，自然的下一步是自写一个 Anki 插件（Python，官方开发文档 addon-docs.ankiweb.net），注册自定义接口：

| 能力 | 插件里怎么做 | 解决什么 |
|---|---|---|
| bury / 精细调度 | 直调 Anki Python API（`col.sched.bury_cards` 等） | §7 "无 bury"缺口（会话内 bury 之外的真 bury） |
| 跨牌组全库复习日志 | 直接查 collection SQLite 库（revlog 表带时间戳索引） | §5.4 按牌组增量的更高性能替代，全库统计一条 SQL |
| 集合变更推送 | 挂 GUI/hooks，主动通知工作台刷新 | 替代 3s 轮询，Anki 侧改动实时可见 |
| 媒体直连 | 插件与 Anki 同进程，可把媒体目录挂成静态路由 | 省去 base64 往返 |

插件定位为**增强层而非依赖**：工作台启动时用 `apiReflect` 探测自定义 action 是否存在，存在则启用增强路径，不存在自动走纯 AnkiConnect——保持"装好 AnkiConnect 即可零配置使用"的底线体验。

---

## 12. 参考资料（官方源）

| 资料 | 链接 | 本项目中的用途 |
|---|---|---|
| AnkiConnect 源码与 API 文档 | https://git.sr.ht/~foosoft/anki-connect | **接口定义权威来源**。注意：GitHub 仓库 README 已替换为迁移声明，完整文档在 sr.ht；§4 已按 sr.ht 原文逐条核对（含 cardReviews/getReviewsOfCards/getDeckStats/setDueDate 签名） |
| AnkiConnect GitHub（旧地址） | https://github.com/FooSoft/anki-connect | 浏览源码历史 / 搜 issue 用，README 无文档 |
| Anki 插件开发文档 | https://addon-docs.ankiweb.net | §11 自写配套插件时参考 |
| Tauri v2 中文官方文档 | https://v2.tauri.app/zh-cn/ | 认准 v2，v1 教程已过期；§2.2 命令机制与 §3.3 capabilities 已按 v2 文档核对 |
| shadcn/ui | https://ui.shadcn.com | Reasonix 组件范式的原型（variants / cn / data-slot），用法互通 |
| Radix UI | https://www.radix-ui.com | 弹层/悬浮层底层行为；交互疑难（焦点陷阱、portal、层叠）的第一排查依据 |
| Lucide 图标 | https://lucide.dev | 图标名查询；lucide-react 已随 @reasonix/ui 安装 |
