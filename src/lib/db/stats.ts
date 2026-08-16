/**
 * 统计聚合层（技术方案 §5.4）：SQLite 三表 + 增量水位线
 * - revlog：原始复习日志（PK = reviewTime+cardId，幂等插入）
 * - deck_daily：按日聚合，UI 只读这张表 → 毫秒级响应
 * - watermark：各牌组增量水位线（max reviewTime）
 *
 * 仅 Tauri 桌面模式可用；浏览器调试模式由 StatsView 降级到全局接口。
 */
import Database from "@tauri-apps/plugin-sql";
import { anki } from "../anki/actions";

let dbPromise: Promise<Database> | null = null;

async function db(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const d = await Database.load("sqlite:reasonix-stats.db");
      await d.execute(`
        CREATE TABLE IF NOT EXISTS revlog (
          review_time INTEGER NOT NULL,
          card_id     INTEGER NOT NULL,
          deck_id     INTEGER NOT NULL,
          ease        INTEGER,
          ivl         INTEGER,
          previous_interval INTEGER,
          duration    INTEGER,
          type        INTEGER,
          PRIMARY KEY (review_time, card_id)
        )
      `);
      await d.execute(`
        CREATE TABLE IF NOT EXISTS deck_daily (
          deck_id INTEGER NOT NULL,
          date    TEXT NOT NULL,
          reviews INTEGER NOT NULL DEFAULT 0,
          time_ms INTEGER NOT NULL DEFAULT 0,
          again   INTEGER NOT NULL DEFAULT 0,
          hard    INTEGER NOT NULL DEFAULT 0,
          good    INTEGER NOT NULL DEFAULT 0,
          easy    INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (deck_id, date)
        )
      `);
      await d.execute(`
        CREATE TABLE IF NOT EXISTS watermark (
          deck_id INTEGER PRIMARY KEY,
          last_ts INTEGER NOT NULL
        )
      `);
      // 迁移：v1 库缺 previous_interval 列（CREATE TABLE IF NOT EXISTS 不会补列）——
      // PRAGMA 检查后 ALTER TABLE 补上，幂等
      const revlogCols = await d.select<{ name: string }[]>(
        "PRAGMA table_info(revlog)",
      );
      if (!revlogCols.some((c) => c.name === "previous_interval")) {
        await d.execute("ALTER TABLE revlog ADD COLUMN previous_interval INTEGER");
      }
      return d;
    })();
  }
  return dbPromise;
}

/** 本地时区日历日（与 SQLite 'localtime' 一致） */
export function localDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface DailyRow {
  date: string;
  reviews: number;
  time_ms: number;
}

export interface DeckSyncResult {
  inserted: number;
  watermark: number;
}

/** 增量同步单个牌组：watermark → cardReviews(deck, startID) → 入库 → 重算受影响日期 */
export async function syncDeck(
  deckId: number,
  deckName: string,
): Promise<DeckSyncResult> {
  const d = await db();
  const wmRows = await d.select<{ last_ts: number }[]>(
    "SELECT last_ts FROM watermark WHERE deck_id = ?",
    [deckId],
  );
  const startID = wmRows.length > 0 ? wmRows[0].last_ts : 0;

  const rows = await anki.cardReviews(deckName, startID);
  if (rows.length === 0) return { inserted: 0, watermark: startID };

  const BATCH = 200;
  let maxTs = startID;
  const affectedDates = new Set<string>();

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const placeholders: string[] = [];
    const values: unknown[] = [];
    for (const r of chunk) {
      // cardReviews 9 元组：[reviewTime, cardID, usn, buttonPressed, newInterval,
      //                     previousInterval, newFactor, reviewDuration, reviewType]
      const [ts, cardId, , ease, ivl, prevIvl, , duration, type] = r;
      placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?)");
      values.push(
        ts,
        cardId,
        deckId,
        ease ?? 0,
        ivl ?? 0,
        prevIvl ?? null,
        duration ?? 0,
        type ?? 0,
      );
      if (ts > maxTs) maxTs = ts;
      affectedDates.add(localDate(ts));
    }
    await d.execute(
      `INSERT OR IGNORE INTO revlog
         (review_time, card_id, deck_id, ease, ivl, previous_interval, duration, type)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT(review_time, card_id) DO UPDATE SET
         previous_interval = COALESCE(excluded.previous_interval, revlog.previous_interval)`,
      values,
    );
  }

  await d.execute(
    `INSERT INTO watermark (deck_id, last_ts) VALUES (?, ?)
     ON CONFLICT(deck_id) DO UPDATE SET last_ts = excluded.last_ts`,
    [deckId, maxTs],
  );

  // 重算受影响日期的聚合（幂等；同步回滚场景也安全）
  for (const date of affectedDates) {
    await d.execute(
      "DELETE FROM deck_daily WHERE deck_id = ? AND date = ?",
      [deckId, date],
    );
    await d.execute(
      `INSERT INTO deck_daily (deck_id, date, reviews, time_ms, again, hard, good, easy)
       SELECT ?, date(review_time / 1000, 'unixepoch', 'localtime'),
              COUNT(*), COALESCE(SUM(duration), 0),
              COALESCE(SUM(CASE WHEN ease = 1 THEN 1 END), 0),
              COALESCE(SUM(CASE WHEN ease = 2 THEN 1 END), 0),
              COALESCE(SUM(CASE WHEN ease = 3 THEN 1 END), 0),
              COALESCE(SUM(CASE WHEN ease = 4 THEN 1 END), 0)
       FROM revlog
       WHERE deck_id = ?
         AND date(review_time / 1000, 'unixepoch', 'localtime') = ?`,
      [deckId, deckId, date],
    );
  }

  return { inserted: rows.length, watermark: maxTs };
}

/** 读取某牌组的每日聚合（UI 数据源） */
export async function getDaily(deckId: number): Promise<DailyRow[]> {
  const d = await db();
  return d.select<DailyRow[]>(
    "SELECT date, reviews, time_ms FROM deck_daily WHERE deck_id = ? ORDER BY date",
    [deckId],
  );
}

/** 最近同步水位线（展示"上次同步到"） */
export async function getWatermark(deckId: number): Promise<number | null> {
  const d = await db();
  const rows = await d.select<{ last_ts: number }[]>(
    "SELECT last_ts FROM watermark WHERE deck_id = ?",
    [deckId],
  );
  return rows.length > 0 ? rows[0].last_ts : null;
}

/** 重建某牌组本地统计（清表重拉，兜底同步回滚/水位线失真） */
export async function rebuildDeck(deckId: number, deckName: string): Promise<void> {
  const d = await db();
  await d.execute("DELETE FROM revlog WHERE deck_id = ?", [deckId]);
  await d.execute("DELETE FROM deck_daily WHERE deck_id = ?", [deckId]);
  await d.execute("DELETE FROM watermark WHERE deck_id = ?", [deckId]);
  await syncDeck(deckId, deckName);
}

export interface DailyDetailRow {
  date: string;
  reviews: number;
  time_ms: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

/** 读取某牌组或全局指定日期的详细评分指标（Again/Hard/Good/Easy） */
export async function getDailyDetail(
  date: string,
  deckId?: number,
): Promise<DailyDetailRow | null> {
  const d = await db();
  if (deckId != null) {
    const rows = await d.select<DailyDetailRow[]>(
      "SELECT date, reviews, time_ms, again, hard, good, easy FROM deck_daily WHERE deck_id = ? AND date = ?",
      [deckId, date],
    );
    return rows[0] ?? null;
  }
  const rows = await d.select<DailyDetailRow[]>(
    `SELECT date,
            SUM(reviews) as reviews,
            SUM(time_ms) as time_ms,
            SUM(again) as again,
            SUM(hard) as hard,
            SUM(good) as good,
            SUM(easy) as easy
     FROM deck_daily
     WHERE date = ?
     GROUP BY date`,
    [date],
  );
  return rows[0] ?? null;
}

/** 时间线单条记录（SQLite snake_case → camelCase 映射后） */
export interface TimelineRow {
  reviewTime: number;
  cardId: number;
  deckId: number;
  /** 评分按钮 1=Again 2=Hard 3=Good 4=Easy（0=手动/无） */
  ease: number;
  /** 新间隔（天；0=10 分钟内） */
  ivl: number;
  /** 前间隔（天；旧库数据为 null） */
  previousIvl: number | null;
  /** 复习耗时（秒） */
  duration: number;
  /** 复习类型 0=学习 1=复习 2=重学 */
  type: number;
}

/** 读取指定日期的复习时间线（按 review_time 升序）；deckId 省略 = 全局跨牌组 */
export async function getDayTimeline(
  date: string,
  deckId?: number,
): Promise<TimelineRow[]> {
  const d = await db();
  const sql = `SELECT review_time, card_id, deck_id, ease, ivl, previous_interval, duration, type
               FROM revlog
               WHERE date(review_time / 1000, 'unixepoch', 'localtime') = ?
               ${deckId != null ? "AND deck_id = ?" : ""}
               ORDER BY review_time`;
  const params: unknown[] = deckId != null ? [date, deckId] : [date];
  const rows = await d.select<
    {
      review_time: number;
      card_id: number;
      deck_id: number;
      ease: number;
      ivl: number;
      previous_interval: number | null;
      duration: number;
      type: number;
    }[]
  >(sql, params);
  return rows.map((r) => ({
    reviewTime: r.review_time,
    cardId: r.card_id,
    deckId: r.deck_id,
    ease: r.ease,
    ivl: r.ivl,
    previousIvl: r.previous_interval,
    duration: r.duration,
    type: r.type,
  }));
}
