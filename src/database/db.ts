import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;
let _opening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  // Single-flight: concurrent callers on first launch must share ONE open +
  // schema-init. Opening multiple connections that each run the WAL pragma and
  // create the FTS5 table can deadlock on a fresh DB, hanging every query.
  if (!_opening) {
    _opening = (async () => {
      const db = await withTimeout(
        SQLite.openDatabaseAsync('vedabase.db'),
        10000,
        'Database open timed out'
      );
      await withTimeout(initializeSchema(db), 10000, 'Database init timed out');
      _db = db;
      return db;
    })().catch((e) => {
      // Reset so a later call can retry instead of being stuck on a failed open.
      _opening = null;
      throw e;
    });
  }
  return _opening;
}

// Belt-and-suspenders: never let an unforeseen native-side stall hang a query
// forever. A rejection surfaces in the UI as an error + Retry, not an endless
// spinner.
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); }
    );
  });
}

async function initializeSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS verses (
      id TEXT PRIMARY KEY,
      book_slug TEXT NOT NULL,
      canto INTEGER,
      chapter INTEGER NOT NULL,
      verse TEXT NOT NULL,
      devanagari TEXT,
      bengali TEXT,
      transliteration TEXT,
      synonyms TEXT,
      translation TEXT,
      purport TEXT,
      audio_url TEXT,
      language TEXT DEFAULT 'en',
      cached_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      parse_version INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_verses_book ON verses(book_slug);
    CREATE INDEX IF NOT EXISTS idx_verses_location ON verses(book_slug, canto, chapter, verse);

    CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
      id UNINDEXED,
      book_slug UNINDEXED,
      translation,
      purport,
      synonyms,
      transliteration,
      devanagari,
      content=verses,
      content_rowid=rowid,
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER IF NOT EXISTS verses_ai AFTER INSERT ON verses BEGIN
      INSERT INTO verses_fts(rowid, id, book_slug, translation, purport, synonyms, transliteration, devanagari)
      VALUES (new.rowid, new.id, new.book_slug, new.translation, new.purport, new.synonyms, new.transliteration, new.devanagari);
    END;

    CREATE TRIGGER IF NOT EXISTS verses_ad AFTER DELETE ON verses BEGIN
      INSERT INTO verses_fts(verses_fts, rowid, id, book_slug, translation, purport, synonyms, transliteration, devanagari)
      VALUES ('delete', old.rowid, old.id, old.book_slug, old.translation, old.purport, old.synonyms, old.transliteration, old.devanagari);
    END;

    CREATE TRIGGER IF NOT EXISTS verses_au AFTER UPDATE ON verses BEGIN
      INSERT INTO verses_fts(verses_fts, rowid, id, book_slug, translation, purport, synonyms, transliteration, devanagari)
      VALUES ('delete', old.rowid, old.id, old.book_slug, old.translation, old.purport, old.synonyms, old.transliteration, old.devanagari);
      INSERT INTO verses_fts(rowid, id, book_slug, translation, purport, synonyms, transliteration, devanagari)
      VALUES (new.rowid, new.id, new.book_slug, new.translation, new.purport, new.synonyms, new.transliteration, new.devanagari);
    END;

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      verse_id TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      canto INTEGER,
      chapter INTEGER NOT NULL,
      verse TEXT NOT NULL,
      added_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS verse_tags (
      verse_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (verse_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      verse_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      book_slug TEXT NOT NULL,
      canto INTEGER NOT NULL DEFAULT 0,
      chapter INTEGER NOT NULL,
      verse TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (book_slug, canto)
    );

    CREATE TABLE IF NOT EXISTS completed_chapters (
      book_slug TEXT NOT NULL,
      canto INTEGER NOT NULL DEFAULT 0,
      chapter INTEGER NOT NULL,
      completed_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (book_slug, canto, chapter)
    );

    CREATE TABLE IF NOT EXISTS download_status (
      book_slug TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'not_downloaded',
      total_verses INTEGER NOT NULL DEFAULT 0,
      downloaded_verses INTEGER NOT NULL DEFAULT 0,
      downloaded_at INTEGER
    );

    -- Per-chapter completion markers. A row means that chapter was fully
    -- downloaded, so a resumed download skips it (no network) and seeds its
    -- progress from verse_count instead of restarting the book from 0%.
    CREATE TABLE IF NOT EXISTS download_chapters (
      book_slug TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      chapter_key TEXT NOT NULL,
      verse_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (book_slug, language, chapter_key)
    );

    CREATE TABLE IF NOT EXISTS daily_sloka (
      date TEXT PRIMARY KEY,
      verse_id TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      canto INTEGER,
      chapter INTEGER NOT NULL,
      verse TEXT NOT NULL
    );
  `);

  await runMigrations(db);
}

// Idempotent migrations for DBs created by older app versions.
async function runMigrations(db: SQLite.SQLiteDatabase) {
  // parse_version records which parser build produced a cached row (for
  // future diagnostics) — it no longer gates reads, so older cached verses
  // stay instantly servable offline instead of forcing a re-fetch on open.
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(verses)`);
  if (!cols.some((c) => c.name === 'parse_version')) {
    await db.execAsync(`ALTER TABLE verses ADD COLUMN parse_version INTEGER NOT NULL DEFAULT 0`);
  }

  // Search upgrade: older DBs have an FTS index without `transliteration` and
  // without diacritic folding, so Sanskrit lines (e.g. "tapo divyaṁ") couldn't be
  // found by ASCII queries. Rebuild the FTS table with the new schema + tokenizer.
  const ftsCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(verses_fts)`);
  const hasTranslit = ftsCols.some((c) => c.name === 'transliteration');
  if (ftsCols.length > 0 && !hasTranslit) {
    await db.execAsync(`
      DROP TRIGGER IF EXISTS verses_ai;
      DROP TRIGGER IF EXISTS verses_ad;
      DROP TRIGGER IF EXISTS verses_au;
      DROP TABLE IF EXISTS verses_fts;

      CREATE VIRTUAL TABLE verses_fts USING fts5(
        id UNINDEXED,
        book_slug UNINDEXED,
        translation,
        purport,
        synonyms,
        transliteration,
        devanagari,
        content=verses,
        content_rowid=rowid,
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER verses_ai AFTER INSERT ON verses BEGIN
        INSERT INTO verses_fts(rowid, id, book_slug, translation, purport, synonyms, transliteration, devanagari)
        VALUES (new.rowid, new.id, new.book_slug, new.translation, new.purport, new.synonyms, new.transliteration, new.devanagari);
      END;

      CREATE TRIGGER verses_ad AFTER DELETE ON verses BEGIN
        INSERT INTO verses_fts(verses_fts, rowid, id, book_slug, translation, purport, synonyms, transliteration, devanagari)
        VALUES ('delete', old.rowid, old.id, old.book_slug, old.translation, old.purport, old.synonyms, old.transliteration, old.devanagari);
      END;

      CREATE TRIGGER verses_au AFTER UPDATE ON verses BEGIN
        INSERT INTO verses_fts(verses_fts, rowid, id, book_slug, translation, purport, synonyms, transliteration, devanagari)
        VALUES ('delete', old.rowid, old.id, old.book_slug, old.translation, old.purport, old.synonyms, old.transliteration, old.devanagari);
        INSERT INTO verses_fts(rowid, id, book_slug, translation, purport, synonyms, transliteration, devanagari)
        VALUES (new.rowid, new.id, new.book_slug, new.translation, new.purport, new.synonyms, new.transliteration, new.devanagari);
      END;

      INSERT INTO verses_fts(verses_fts) VALUES('rebuild');
    `);
  }
}
