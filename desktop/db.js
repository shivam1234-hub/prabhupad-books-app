// Desktop (Windows/macOS/Linux) persistence layer.
//
// Mirrors src/database/db.ts + src/database/queries.ts one-for-one: same schema,
// same SQL, same FTS5 tokenizer. The mobile app stores verses in expo-sqlite;
// here the identical database lives in Electron's userData directory, so the
// desktop build has the *same* real offline library rather than the reduced
// localStorage stub the plain-browser web build falls back to.
//
// node-sqlite3-wasm (not better-sqlite3) is deliberate: it is a pure-WASM build
// of SQLite with FTS5 compiled in, so no native module has to be rebuilt per
// platform and a Windows installer can be cross-built from macOS or Linux.
const path = require('path');
const fs = require('fs');
const { Database } = require('node-sqlite3-wasm');

let db = null;

// Schema copied verbatim from src/database/db.ts so a verse row written by the
// phone and one written here are byte-compatible (enables future sync/import).
const SCHEMA = `
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
`;

// Matches CURRENT_PARSE_VERSION in src/database/queries.ts.
const CURRENT_PARSE_VERSION = 3;

function open(userDataDir) {
  if (db) return db;
  fs.mkdirSync(userDataDir, { recursive: true });
  db = new Database(path.join(userDataDir, 'vedabase.db'));
  db.exec(SCHEMA);
  return db;
}

function close() {
  if (!db) return;
  try { db.close(); } catch { /* already closed */ }
  db = null;
}

function dbFile(userDataDir) {
  return path.join(userDataDir, 'vedabase.db');
}

const all = (sql, params = []) => db.all(sql, params);
const get = (sql, params = []) => db.get(sql, params) ?? null;
const run = (sql, params = []) => { db.run(sql, params); };

function rowToVerse(r) {
  if (!r) return null;
  return {
    id: r.id,
    bookSlug: r.book_slug,
    canto: r.canto ?? undefined,
    chapter: r.chapter,
    verse: r.verse,
    devanagari: r.devanagari ?? undefined,
    bengali: r.bengali ?? undefined,
    transliteration: r.transliteration ?? undefined,
    synonyms: r.synonyms ?? undefined,
    translation: r.translation ?? undefined,
    purport: r.purport ?? undefined,
    audioUrl: r.audio_url ?? undefined,
    language: r.language,
  };
}

function buildVerseId(bookSlug, chapter, verse, canto) {
  if (canto !== undefined && canto !== null) return `${bookSlug}:${canto}:${chapter}:${verse}`;
  return `${bookSlug}:${chapter}:${verse}`;
}

// --- The dispatch table the renderer calls over IPC -------------------------
// Every name here matches an export of src/database/queries.ts, so the desktop
// data layer is a drop-in for the native one.
const api = {
  getVerse(bookSlug, chapter, verse, canto, language = 'en') {
    const id = buildVerseId(bookSlug, chapter, verse, canto);
    return rowToVerse(get('SELECT * FROM verses WHERE id = ? AND language = ?', [id, language]));
  },

  saveVerse(verse) {
    run(
      `INSERT OR REPLACE INTO verses
        (id, book_slug, canto, chapter, verse, devanagari, bengali, transliteration, synonyms, translation, purport, audio_url, language, cached_at, parse_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'), ?)`,
      [
        verse.id, verse.bookSlug, verse.canto ?? null, verse.chapter,
        String(verse.verse), verse.devanagari ?? null, verse.bengali ?? null,
        verse.transliteration ?? null, verse.synonyms ?? null,
        verse.translation ?? null, verse.purport ?? null,
        verse.audioUrl ?? null, verse.language, CURRENT_PARSE_VERSION,
      ]
    );
  },

  getChapterVerses(bookSlug, chapter, canto, language = 'en') {
    return all(
      'SELECT * FROM verses WHERE book_slug = ? AND chapter = ? AND (canto = ? OR (canto IS NULL AND ? IS NULL)) AND language = ? ORDER BY CAST(verse AS REAL)',
      [bookSlug, chapter, canto ?? null, canto ?? null, language]
    ).map(rowToVerse);
  },

  findCachedCombinedVerse(bookSlug, chapter, verse, canto, language = 'en') {
    if (String(verse).includes('-')) return null;
    const target = parseInt(verse, 10);
    if (isNaN(target)) return null;
    const rows = all(
      `SELECT * FROM verses
         WHERE book_slug = ? AND chapter = ?
           AND (canto = ? OR (canto IS NULL AND ? IS NULL))
           AND language = ? AND verse LIKE '%-%'`,
      [bookSlug, chapter, canto ?? null, canto ?? null, language]
    );
    for (const row of rows) {
      const m = /^(\d+)-(\d+)$/.exec(String(row.verse));
      if (m && target >= parseInt(m[1], 10) && target <= parseInt(m[2], 10)) return rowToVerse(row);
    }
    return null;
  },

  // Word-for-word lookup — same query as getSynonymCandidates in
  // src/database/queries.ts.
  getSynonymCandidates(prefix, limit = 300, language = 'en') {
    if (!/^[a-z]{2,}$/.test(String(prefix))) return [];
    try {
      return all(
        `SELECT v.book_slug, v.canto, v.chapter, v.verse, v.synonyms FROM verses v
           INNER JOIN verses_fts fts ON v.rowid = fts.rowid
          WHERE verses_fts MATCH ? AND v.language = ? AND v.synonyms IS NOT NULL
          LIMIT ?`,
        [`synonyms:"${prefix}"*`, language, limit]
      ).map((r) => ({
        bookSlug: r.book_slug, canto: r.canto ?? undefined, chapter: r.chapter,
        verse: String(r.verse), synonyms: r.synonyms,
      }));
    } catch {
      return [];
    }
  },

  // Where a verse quoted in a purport is found — same query as
  // findVersesByTransliteration in src/database/queries.ts.
  findVersesByTransliteration(words, limit = 20, language = 'en') {
    const w = (words || []).filter((x) => /^[a-z]+$/.test(String(x))).slice(0, 5);
    if (w.length < 2) return [];
    try {
      return all(
        `SELECT v.* FROM verses v INNER JOIN verses_fts fts ON v.rowid = fts.rowid
          WHERE verses_fts MATCH ? AND v.language = ? LIMIT ?`,
        [`transliteration:"${w.join(' ')}"`, language, limit]
      ).map(rowToVerse);
    } catch {
      return [];
    }
  },

  // FTS5 pulls a broad candidate pool; the renderer applies the SHARED
  // rankVerses() scorer to it, so desktop results rank identically to mobile.
  searchCandidates(ftsExpr, bookSlug, poolSize) {
    let sql = `
      SELECT v.* FROM verses v
      INNER JOIN verses_fts fts ON v.rowid = fts.rowid
      WHERE verses_fts MATCH ?
    `;
    const params = [ftsExpr];
    if (bookSlug) { sql += ' AND v.book_slug = ?'; params.push(bookSlug); }
    sql += ' ORDER BY rank LIMIT ?';
    params.push(poolSize);
    try {
      return all(sql, params).map(rowToVerse);
    } catch {
      // A malformed FTS expression must degrade to "no results", never crash.
      return [];
    }
  },

  getFavorites() {
    return all('SELECT * FROM favorites ORDER BY added_at DESC').map((r) => ({
      id: r.id, verseId: r.verse_id, bookSlug: r.book_slug, canto: r.canto,
      chapter: r.chapter, verse: r.verse, addedAt: r.added_at, note: r.note,
    }));
  },

  addFavorite(fav) {
    run(
      'INSERT OR IGNORE INTO favorites (id, verse_id, book_slug, canto, chapter, verse, added_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [fav.id, fav.verseId, fav.bookSlug, fav.canto ?? null, fav.chapter, String(fav.verse), fav.addedAt, fav.note ?? null]
    );
  },

  removeFavorite(verseId) { run('DELETE FROM favorites WHERE verse_id = ?', [verseId]); },

  isFavorite(verseId) { return !!get('SELECT id FROM favorites WHERE verse_id = ?', [verseId]); },

  getTags() {
    return all('SELECT * FROM tags ORDER BY created_at DESC').map((r) => ({
      id: r.id, name: r.name, color: r.color, createdAt: r.created_at,
    }));
  },

  createTag(tag) {
    run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      [tag.id, tag.name, tag.color, tag.createdAt]);
  },

  deleteTag(tagId) {
    run('DELETE FROM tags WHERE id = ?', [tagId]);
    run('DELETE FROM verse_tags WHERE tag_id = ?', [tagId]);
  },

  addVerseTag(verseId, tagId) {
    run('INSERT OR IGNORE INTO verse_tags (verse_id, tag_id) VALUES (?, ?)', [verseId, tagId]);
  },

  removeVerseTag(verseId, tagId) {
    run('DELETE FROM verse_tags WHERE verse_id = ? AND tag_id = ?', [verseId, tagId]);
  },

  getVerseTagIds(verseId) {
    return all('SELECT tag_id FROM verse_tags WHERE verse_id = ?', [verseId]).map((r) => r.tag_id);
  },

  getVersesByTag(tagId) {
    return all(
      'SELECT v.* FROM verses v INNER JOIN verse_tags vt ON v.id = vt.verse_id WHERE vt.tag_id = ?',
      [tagId]
    ).map(rowToVerse);
  },

  getNote(verseId) {
    const row = get('SELECT * FROM notes WHERE verse_id = ?', [verseId]);
    if (!row) return null;
    return { id: row.id, verseId: row.verse_id, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at };
  },

  saveNote(note) {
    run('INSERT OR REPLACE INTO notes (id, verse_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [note.id, note.verseId, note.content, note.createdAt, note.updatedAt]);
  },

  deleteNote(verseId) { run('DELETE FROM notes WHERE verse_id = ?', [verseId]); },

  updateReadingProgress(bookSlug, chapter, verse, canto) {
    run(
      `INSERT OR REPLACE INTO reading_progress (book_slug, canto, chapter, verse, updated_at)
       VALUES (?, ?, ?, ?, strftime('%s','now'))`,
      [bookSlug, canto ?? 0, chapter, String(verse)]
    );
  },

  getReadingProgress(bookSlug, canto) {
    const row = get('SELECT chapter, verse FROM reading_progress WHERE book_slug = ? AND canto = ?',
      [bookSlug, canto ?? 0]);
    return row ? { chapter: row.chapter, verse: row.verse } : null;
  },

  markChapterCompleted(bookSlug, chapter, canto) {
    run(
      `INSERT OR IGNORE INTO completed_chapters (book_slug, canto, chapter, completed_at)
       VALUES (?, ?, ?, strftime('%s','now'))`,
      [bookSlug, canto ?? 0, chapter]
    );
  },

  getCompletedChapters(bookSlug) {
    return all('SELECT chapter FROM completed_chapters WHERE book_slug = ?', [bookSlug])
      .map((r) => r.chapter);
  },

  getDownloadStatus(bookSlug) {
    const row = get(
      'SELECT status, total_verses, downloaded_verses, downloaded_at FROM download_status WHERE book_slug = ?',
      [bookSlug]
    );
    if (!row) return { status: 'not_downloaded', progress: 0, total: 0, downloaded: 0 };
    return {
      status: row.status,
      progress: row.total_verses > 0 ? row.downloaded_verses / row.total_verses : 0,
      total: row.total_verses,
      downloaded: row.downloaded_verses,
      downloadedAt: row.downloaded_at ?? undefined,
    };
  },

  getDownloadedBookSlugs() {
    return all("SELECT book_slug FROM download_status WHERE status = 'downloaded'")
      .map((r) => r.book_slug);
  },

  getAllDownloadStatuses() {
    const map = {};
    for (const row of all('SELECT book_slug, status, total_verses, downloaded_verses, downloaded_at FROM download_status')) {
      map[row.book_slug] = {
        status: row.status,
        progress: row.total_verses > 0 ? row.downloaded_verses / row.total_verses : 0,
        total: row.total_verses,
        downloaded: row.downloaded_verses,
        downloadedAt: row.downloaded_at ?? undefined,
      };
    }
    return map;
  },

  getResumableBookSlugs() {
    return all("SELECT book_slug FROM download_status WHERE status IN ('queued', 'downloading')")
      .map((r) => r.book_slug);
  },

  setDownloadStatus(bookSlug, status, totalVerses, downloadedVerses) {
    const downloadedAt = status === 'downloaded' ? Math.floor(Date.now() / 1000) : null;
    run(
      `INSERT OR REPLACE INTO download_status
         (book_slug, status, total_verses, downloaded_verses, downloaded_at)
       VALUES (?, ?, ?, ?, ?)`,
      [bookSlug, status, totalVerses, downloadedVerses, downloadedAt]
    );
  },

  // Returned as entry pairs — a Map does not survive IPC structured cloning
  // intact across the contextBridge, so the renderer rebuilds it.
  getDownloadedChapters(bookSlug, language) {
    return all(
      'SELECT chapter_key, verse_count FROM download_chapters WHERE book_slug = ? AND language = ?',
      [bookSlug, language]
    ).map((r) => [r.chapter_key, r.verse_count]);
  },

  markDownloadedChapter(bookSlug, language, chapterKey, verseCount) {
    run(
      `INSERT OR REPLACE INTO download_chapters (book_slug, language, chapter_key, verse_count)
       VALUES (?, ?, ?, ?)`,
      [bookSlug, language, chapterKey, verseCount]
    );
  },

  clearDownloadedChapters(bookSlug, language) {
    run('DELETE FROM download_chapters WHERE book_slug = ? AND language = ?', [bookSlug, language]);
  },

  saveDailySloka(date, bookSlug, chapter, verse, canto) {
    run(
      `INSERT OR REPLACE INTO daily_sloka (date, verse_id, book_slug, canto, chapter, verse)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [date, buildVerseId(bookSlug, chapter, verse, canto), bookSlug, canto ?? null, chapter, verse]
    );
  },

  getDailySloka(date) {
    const row = get('SELECT book_slug, canto, chapter, verse FROM daily_sloka WHERE date = ?', [date]);
    return row
      ? { bookSlug: row.book_slug, canto: row.canto ?? undefined, chapter: row.chapter, verse: row.verse }
      : null;
  },

  // --- Desktop-only helpers (Settings screen / storage management) ---
  stats() {
    const verses = get('SELECT COUNT(*) AS n FROM verses')?.n ?? 0;
    const books = get('SELECT COUNT(DISTINCT book_slug) AS n FROM verses')?.n ?? 0;
    return { verses, books };
  },
};

module.exports = { open, close, dbFile, api };
