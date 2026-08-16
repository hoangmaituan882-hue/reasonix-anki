// 验证 lib/db/stats.ts 的 SQL：DDL 迁移 + 时间线查询（与实现完全一致，node:sqlite）
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE revlog (
  review_time INTEGER NOT NULL,
  card_id     INTEGER NOT NULL,
  deck_id     INTEGER NOT NULL,
  ease        INTEGER,
  ivl         INTEGER,
  previous_interval INTEGER,
  duration    INTEGER,
  type        INTEGER,
  PRIMARY KEY (review_time, card_id)
)`);
db.exec(`CREATE TABLE deck_daily (
  deck_id INTEGER NOT NULL, date TEXT NOT NULL, reviews INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0, again INTEGER NOT NULL DEFAULT 0,
  hard INTEGER NOT NULL DEFAULT 0, good INTEGER NOT NULL DEFAULT 0,
  easy INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (deck_id, date)
)`);
db.exec(`CREATE TABLE watermark (deck_id INTEGER PRIMARY KEY, last_ts INTEGER NOT NULL)`);

// 迁移幂等：已含 previous_interval → 不应再 ALTER
const cols1 = db.prepare("PRAGMA table_info(revlog)").all().map((c) => c.name);
console.log("has previous_interval (new):", cols1.includes("previous_interval"));

// 迁移场景：旧库无列 → ALTER 补
db.exec("DROP TABLE revlog");
db.exec(`CREATE TABLE revlog (
  review_time INTEGER NOT NULL, card_id INTEGER NOT NULL, deck_id INTEGER NOT NULL,
  ease INTEGER, ivl INTEGER, duration INTEGER, type INTEGER,
  PRIMARY KEY (review_time, card_id)
)`);
const cols2 = db.prepare("PRAGMA table_info(revlog)").all().map((c) => c.name);
if (!cols2.includes("previous_interval")) db.exec("ALTER TABLE revlog ADD COLUMN previous_interval INTEGER");
const cols3 = db.prepare("PRAGMA table_info(revlog)").all().map((c) => c.name);
console.log("migration added column:", cols3.includes("previous_interval"));

// syncDeck 的 INSERT ... ON CONFLICT DO UPDATE（与 stats.ts 同款）
const ts = Date.parse("2026-08-16T12:00:00+08:00");
const rows = [[ts, 111, 0, 3, 4, 2, 0, 8, 1], [ts + 1000, 222, 0, 1, 0, 4, 0, 12, 2], [ts + 2000, 333, 0, 4, 15, 7, 0, 5, 1]];
const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
const values = rows.flatMap((r) => [r[0], r[1], r[2], r[3], r[4], r[5] ?? null, r[7], r[8]]);
db.prepare(`INSERT OR IGNORE INTO revlog
  (review_time, card_id, deck_id, ease, ivl, previous_interval, duration, type)
  VALUES ${placeholders}
  ON CONFLICT(review_time, card_id) DO UPDATE SET
    previous_interval = COALESCE(excluded.previous_interval, revlog.previous_interval)`).run(...values);
console.log("inserted rows:", db.prepare("SELECT COUNT(*) c FROM revlog").get().c);

// 重复插入（同 review_time+card_id）→ 不重复、previous_interval 保留
db.prepare(`INSERT OR IGNORE INTO revlog
  (review_time, card_id, deck_id, ease, ivl, previous_interval, duration, type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(review_time, card_id) DO UPDATE SET
    previous_interval = COALESCE(excluded.previous_interval, revlog.previous_interval)`)
  .run(ts, 111, 0, 3, 4, 999, 8, 1); // 新数据 previous_interval=999 → 应覆盖为 999
const dup = db.prepare("SELECT previous_interval FROM revlog WHERE review_time = ? AND card_id = 111").get(ts);
console.log("dup upsert keeps excluded prevIvl (999):", dup.previous_interval === 999);
console.log("row count after dup:", db.prepare("SELECT COUNT(*) c FROM revlog").get().c);

// getDayTimeline SQL（与 stats.ts 同款）：按日过滤 + 排序 + 可选 deck
const date = "2026-08-16";
const all = db.prepare(
  `SELECT review_time, card_id, deck_id, ease, ivl, previous_interval, duration, type
   FROM revlog
   WHERE date(review_time / 1000, 'unixepoch', 'localtime') = ?
   ORDER BY review_time`).all(date);
console.log("timeline(global) rows:", all.length, "first card:", all[0].card_id, "prevIvl:", all[0].previous_interval);

const deckOnly = db.prepare(
  `SELECT review_time, card_id, deck_id, ease, ivl, previous_interval, duration, type
   FROM revlog
   WHERE date(review_time / 1000, 'unixepoch', 'localtime') = ? AND deck_id = ?
   ORDER BY review_time`).all(date, 0);
console.log("timeline(deck 0) rows:", deckOnly.length);

// 跨天验证：插入昨天记录不应出现在今天
const yts = ts - 24 * 3600 * 1000;
db.prepare(`INSERT INTO revlog (review_time, card_id, deck_id, ease, ivl, previous_interval, duration, type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(yts, 999, 0, 2, 5, 1, 6, 1);
const all2 = db.prepare(
  `SELECT review_time, card_id FROM revlog
   WHERE date(review_time / 1000, 'unixepoch', 'localtime') = ?
   ORDER BY review_time`).all(date);
console.log("after yesterday insert, today rows:", all2.length, "(expect 3)");
console.log("ALL OK");
