# 学习轨迹（Learning History）功能规格

> 用途：本文件是「学习轨迹」视图的**完整功能规格**，供 AI Studio / 其他 AI
> 重写 UI 时参考。**数据层与纯函数是稳定的契约，UI 层可自由重写**——重写时
> 不得改动：`lib/db/stats.ts` 的 `getDayTimeline`、`features/history/historyUtil.ts`
> 的全部导出、`stores/app.ts` 的 `history` 视图与 `historyDate`、路由接线方式。

## 1. 功能定位

按日/按范围查看「复习历史」的视图：用户某天（或近 7/30 天）在 Anki 里复习了
哪些卡片、答得怎么样（Again/Hard/Good/Easy）、间隔如何变化、耗时多少。
解决旧「检索这天复习的所有卡片」跳浏览表格的语境断裂与 `rated:N` 相对语法
跨天漂移问题——本视图用**绝对日期**数据（SQLite revlog / cardReviews），跨天稳定。

## 2. 入口

- 侧边栏第 7 项「学习轨迹」（`stores/app.ts` 的 `View = "history"`，图标 AnimatedClock）
- 统计热力图右键「查看当天学习轨迹」→ `setHistoryDate(date)` + `setView("history")`
  （日期注入，HistoryView 挂载时消费为初始日期）
- 视图切换无路由库：`App.tsx` 条件渲染 `{view === "history" && <HistoryView />}`

## 3. 数据模型（契约，不可改）

```ts
// features/history/historyUtil.ts 导出（全部纯函数，UI 层 import 使用）
TimelineEntry {
  reviewTime: number;   // 毫秒时间戳
  cardId: number;
  deckId: number;
  ease: 1|2|3|4;        // Again/Hard/Good/Easy（0=手动）
  ivl: number;          // 新间隔（天；0=10 分钟内）
  previousIvl: number|null; // 前间隔（旧库数据可能 null）
  duration: number;     // 耗时（秒）
  type: 0|1|2;          // 学习/复习/重学
  front: string;        // 正面摘要（纯文本，前端已截断）
  deckName: string;
}

DaySummary { total, again, hard, good, easy, timeMs, learn, review, relearn,
             correctRate: number, avgIvlGain: number|null, avgDuration: number }

// 纯函数：summarizeDay / groupIntoSessions / collapseAdjacentSameCard /
// filterEntries / compareDays / aggregateRange / cardChain / shiftDate /
// todayString / formatIvl / formatTime / formatDuration / easeLabel /
// easeColor / typeLabel / emptySummary
```

- 数据获取（HistoryView 内）：Tauri 走 `getDayTimeline(date)`（SQLite revlog）；
  浏览器/演示模式走 `anki.cardReviews(deck, dayStart)` 遍历牌组按日过滤。
  Query 键 `["history","timeline",date]`、`["history","range",mode]`，**staleTime: 0**（实时刷新）。
- 卡片摘要：`cardsInfo` 批量 → `frontText()`（order 最小字段剥 HTML 截断）。

## 4. UI 结构（自上而下）

### 4.1 范围切换 + 日期选择（顶部一行）
- 三段切换：**今天 | 近 7 天 | 近 30 天**（`rangeMode: "day"|"7d"|"30d"`，分段按钮，选中高亮）
- 单日模式附：前一天/后一天图标按钮 + `<input type="date">`（max=今天）+「今天」快捷按钮

### 4.2 筛选行（仅单日模式）
- 评分筛选：全部 / Again / Hard / Good / Easy（分段按钮，选中 accent 高亮）
- 类型筛选：全部类型 / 学习 / 复习 / 重学
- 牌组筛选：下拉 `<select>`（全部牌组 + useDeckTree 各牌组）
- 筛选作用于**汇总卡与时间线**（`filterEntries`）；筛选激活时隐藏"对比昨天"（语义一致）

### 4.3 汇总卡（单日）
- 标题：「{date} · 复习记录」（Clock3 图标 + accent）
- 行 1：共 **N** 次 · 总耗时（分秒）· 学习/复习/重学构成
- 行 2（质量指标）：**正确率 N%**（≥60 绿 / ≥40 橙 / <40 红，--rx-ok/warn/err）·
  平均间隔涨幅 **×N.N**（无前间隔数据时隐藏）· 平均耗时
- 行 3：四档占比条（h-2 圆角条，Again 红 --rx-err / Hard 橙 --rx-warn / Good 绿 --rx-ok / Easy 主题色 --rx-accent，宽度=占比）
- 行 4：四档图例（色块 + label + 计数）
- 对比昨天（无筛选时）：胶囊「对比昨天：**+N 次** · 正确率 **±N%** · **±N 分**」（正绿负红）

### 4.4 时间线（单日，核心）
- **会话分组**：相邻记录 >20 分钟切分（`groupIntoSessions`）。每个会话一个 section：
  标题行「会话 N · HH:mm–HH:mm · X 次复习 · 正确率 Y%」（≥60 绿 / 否则橙）+
  右侧分隔线
- **同卡折叠**：会话内连续同卡记录折叠（`collapseAdjacentSameCard`）为一行：
  `[Layers 图标 accent] 摘要 [×N] [首评分徽章] → [末评分徽章]`（accent 左边框，
  点击打开该卡详情弹窗）。单条记录保持普通条目。
- **普通条目**（每条）：
  - 左侧垂直时间轴（细线 + 色点：色点颜色=评分色）
  - 内容卡：时间（mono）· 评分徽章（色底 14% 透明 + 图标 + label）· 类型小徽章 ·
    **「需重学」红条标签**（ease=1 或 type=2 时）· 耗时（右侧）
  - 卡片摘要（button，点击打开详情弹窗，hover accent/下划线）
  - 底部：`前间隔(删除线) → 新间隔(加粗)`（有前间隔时）+ 牌组名（右侧，截断）
  - **失败高亮**：ease=1 或 type=2 时内容卡左边框 `--rx-err`（2px）
  - 入场动画：motion，opacity+x 偏移，delay 随序号递增（≤0.6s）
- 空态：Inbox 图标 +「这天没有复习记录」/「没有符合筛选的记录」

### 4.5 卡片详情弹窗（点击条目/折叠行）
- 标题：卡片正面摘要（完整）+ 副标题「{牌组} · 卡片 #{id} · 当天复习 N 次」
- 内容：**表现链**——该卡当天全部记录时间升序（`cardChain`），每条：
  时间（mono）· 评分徽章 · 类型 · `前间隔 → 新间隔` · 耗时（右侧）
- 底部按钮：「关闭」（outline）+「在浏览中查看」（default，`cid:{id}` 跳浏览）

### 4.6 范围聚合视图（近 7/30 天）
- 标题：「近 N 天学习概况」（CalendarRange 图标）
- 汇总行：共 **N** 次 · 总耗时 · Again/Hard/Good/Easy 分布
- 每日列表（`aggregateRange`，按日期倒序；点击某天 → 切单日模式 + 设该日期）：
  日期 · N 次 · 四档迷你占比条（flex-1）· 正确率%（色标，右对齐 w-12）
- 空态：「近 N 天没有复习记录」

## 5. 视觉与交互纪律

- **颜色只用主题令牌**：`--rx-err`(Again/失败红)、`--rx-warn`(Hard/橙)、`--rx-ok`(Good/绿)、
  `--rx-accent`(Easy/强调)、`--rx-bg-soft`(卡片底)、`--rx-border-soft`(描边)、
  `--rx-fg`/`--rx-fg-dim`/`--rx-fg-faint`(文字层级)。禁止硬编码色值。
- 圆角/间距：`rounded-[var(--rx-r-s)]` 等令牌；卡片用 border + `--rx-bg-soft`。
- 动画：motion/react 入场（轻量，不遮挡内容）；无全局 MotionConfig 污染。
- 图标：lucide-react 按需（Clock3/ChevronLeft/ChevronRight/CalendarRange/Inbox/
  Layers/Sparkles 等；评分四档图标 X/ChevronsDown/Check/ChevronsUp）。
- 可访问性：图标按钮带 aria-label；日期输入 label；摘要按钮有 title。
- 徽章色底：`color-mix(in srgb, {color} 14%, transparent)`。

## 6. 重写边界

| 可重写（UI 层） | 必须保留（契约） |
|---|---|
| HistoryView / HistoryTimeline / CardDetailDialog 的 JSX、样式、布局 | `historyUtil.ts` 全部导出（类型+纯函数） |
| 筛选/范围/对比的 UI 呈现 | `lib/db/stats.ts` `getDayTimeline` |
| 动画与视觉细节 | `stores/app.ts` `history` 视图 + `historyDate` + `setHistoryDate` |
| 日期选择器实现 | App.tsx 条件渲染接线 + StatsView 右键跳转（`setHistoryDate`+`setView("history")`） |
| | `useDeckTree` / `frontText` / `anki.cardsInfo` 使用方式 |
| | Query 键 `["history","timeline",date]` / `["history","range",mode]` + `staleTime: 0` |
| | 演示模式（`isDemoMode()`）下走浏览器降级数据路径 |

## 7. 验收标准（重写后需满足）

1. tsc 零错误；`npx vitest run` 全绿（historyUtil 24 用例不得改坏）
2. 单日模式：汇总卡四行 + 会话分组 + 同卡折叠 + 失败高亮 + 间隔箭头全部渲染
3. 筛选（评分/类型/牌组）即时生效且作用于汇总；筛选时无"对比昨天"
4. 近 7/30 天：每日列表 + 汇总 + 点日回单日
5. 点条目/折叠行 → 详情弹窗表现链 →「在浏览中查看」跳浏览
6. 评分后回到视图自动刷新（staleTime 0）
7. 演示模式（无 Anki）下所有交互可用
8. 控制台零 pageerror/console.error
