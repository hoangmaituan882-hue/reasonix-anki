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
      const [ts, cardId, , ease, ivl, , , duration, type] = r;
      placeholders.push("(?, ?, ?, ?, ?, ?, ?)");
      values.push(ts, cardId, deckId, ease ?? 0, ivl ?? 0, duration ?? 0, type ?? 0);
      if (ts > maxTs) maxTs = ts;
      affectedDates.add(localDate(ts));
    }
    await d.execute(
      `INSERT OR IGNORE INTO revlog
         (review_time, card_id, deck_id, ease, ivl, duration, type)
       VALUES ${placeholders.join(", ")}`,
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
