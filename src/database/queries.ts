import { getDb } from './db';
import { Verse, Favorite, Tag, Note, SearchResult } from '@/types';
import { queryTerms, ftsPhraseExpr, ftsWordsExpr } from '@/utils/searchMatch';
import { rankVerses } from '@/utils/searchRelevance';

// Stamped onto every freshly-fetched verse so future format changes are
// identifiable; NOT used to reject already-cached rows on read (a stale-format
// cached verse is still fully readable, and gating reads on this previously
// forced a slow, sometimes offline-hanging network re-fetch for any verse
// downloaded under an older build — see git history for the incident).
//   1 = original
//   2 = combined-verse fix: join all children for transliteration/devanagari/etc.
//   3 = combined-verse transliteration: blank-line + "TEXT n" label per sloka.
export const CURRENT_PARSE_VERSION = 3;

export async function getVerse(
  bookSlug: string,
  chapter: number,
  verse: string,
  canto?: number,
  language = 'en'
): Promise<Verse | null> {
  const db = await getDb();
  const id = buildVerseId(bookSlug, chapter, verse, canto);
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM verses WHERE id = ? AND language = ?',
    [id, language]
  );
  return row ? rowToVerse(row) : null;
}

export async function saveVerse(verse: Verse): Promise<void> {
  const db = await getDb();
  await db.runAsync(
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
}

export async function getChapterVerses(
  bookSlug: string,
  chapter: number,
  canto?: number,
  language = 'en'
): Promise<Verse[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM verses WHERE book_slug = ? AND chapter = ? AND (canto = ? OR (canto IS NULL AND ? IS NULL)) AND language = ? ORDER BY CAST(verse AS REAL)',
    [bookSlug, chapter, canto ?? null, canto ?? null, language]
  );
  return rows.map(rowToVerse);
}

// An individual verse (e.g. sb 11.19.36) may not exist as a standalone row
// because it's part of a combined verse cached under a range id (sb:11:19:36-39).
// Find the already-cached combined row whose range contains this verse number.
export async function findCachedCombinedVerse(
  bookSlug: string,
  chapter: number,
  verse: string,
  canto?: number,
  language = 'en'
): Promise<Verse | null> {
  if (verse.includes('-')) return null; // already a range
  const target = parseInt(verse, 10);
  if (isNaN(target)) return null; // front-matter / named page

  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM verses
       WHERE book_slug = ? AND chapter = ?
         AND (canto = ? OR (canto IS NULL AND ? IS NULL))
         AND language = ? AND verse LIKE '%-%'`,
    [bookSlug, chapter, canto ?? null, canto ?? null, language]
  );
  for (const row of rows) {
    const m = /^(\d+)-(\d+)$/.exec(String(row.verse));
    if (m && target >= parseInt(m[1], 10) && target <= parseInt(m[2], 10)) {
      return rowToVerse(row);
    }
  }
  return null;
}

export async function searchVerses(
  query: string,
  bookSlug?: string,
  limit = 50
): Promise<Verse[]> {
  const db = await getDb();

  // FTS5 retrieval is prefix-only (no fuzzy matching), so it's used purely to
  // pull a broad, cheap candidate pool out of a potentially huge offline
  // cache: OR across every term's prefix, so a typo in ONE word of a
  // multi-word query still retrieves rows that match on the others. The FTS
  // tokenizer also folds diacritics, so ASCII "tapo divyam" matches the
  // stored "tapo divyaṁ". Final relevance ranking — including typo-tolerant
  // fuzzy scoring and field weighting — happens client-side in rankVerses,
  // shared with the web search path so results match across platforms.
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const candidatePool = Math.max(limit * 3, 200);

  const fetch = async (expr: string, n: number) => {
    let sql = `
      SELECT v.* FROM verses v
      INNER JOIN verses_fts fts ON v.rowid = fts.rowid
      WHERE verses_fts MATCH ?
    `;
    const params: any[] = [expr];
    if (bookSlug) {
      sql += ' AND v.book_slug = ?';
      params.push(bookSlug);
    }
    sql += ' ORDER BY rank LIMIT ?';
    params.push(n);
    return (await db.getAllAsync<any>(sql, params)).map(rowToVerse);
  };

  // Exact-phrase rows first, so a phrase buried in one purport is never
  // crowded out of the pool by rows matching common words like "so".
  const phrase = ftsPhraseExpr(terms);
  const phraseRows = phrase ? await fetch(phrase, limit) : [];
  const wordRows = await fetch(ftsWordsExpr(terms), candidatePool);
  const seen = new Set(phraseRows.map((v) => v.id));
  const candidates = [...phraseRows, ...wordRows.filter((v) => !seen.has(v.id))];
  return rankVerses(candidates, terms).slice(0, limit);
}

// Verses whose transliteration contains these words in a row (ASCII,
// diacritics folded like the FTS tokenizer): where a verse quoted in a
// purport is found. The caller checks each candidate letter by letter.
export async function findVersesByTransliteration(words: string[], limit = 20, language = 'en'): Promise<Verse[]> {
  const w = words.filter(x => /^[a-z]+$/.test(x)).slice(0, 5);
  if (w.length < 2) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT v.* FROM verses v INNER JOIN verses_fts fts ON v.rowid = fts.rowid
      WHERE verses_fts MATCH ? AND v.language = ? LIMIT ?`,
    [`transliteration:"${w.join(' ')}"`, language, limit]
  );
  return rows.map(rowToVerse);
}

export interface SynonymRow {
  bookSlug: string;
  canto?: number;
  chapter: number;
  verse: string;
  synonyms: string;
}

// Verses whose word-for-word synonyms contain a word starting with `prefix`
// (ASCII, diacritics folded — the FTS tokenizer folds them too). Feeds the
// tap-a-word meaning lookup: the caller parses each row's "word – meaning"
// pairs and keeps the ones whose Sanskrit word is the one tapped.
export async function getSynonymCandidates(
  prefix: string, limit = 300, language = 'en'
): Promise<SynonymRow[]> {
  if (!/^[a-z]{2,}$/.test(prefix)) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT v.book_slug, v.canto, v.chapter, v.verse, v.synonyms FROM verses v
       INNER JOIN verses_fts fts ON v.rowid = fts.rowid
      WHERE verses_fts MATCH ? AND v.language = ? AND v.synonyms IS NOT NULL
      LIMIT ?`,
    [`synonyms:"${prefix}"*`, language, limit]
  );
  return rows.map((r: any) => ({
    bookSlug: r.book_slug, canto: r.canto ?? undefined, chapter: r.chapter,
    verse: String(r.verse), synonyms: r.synonyms,
  }));
}

export async function getFavorites(): Promise<Favorite[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM favorites ORDER BY added_at DESC'
  );
  return rows.map((r: any): Favorite => ({
    id: r.id,
    verseId: r.verse_id,
    bookSlug: r.book_slug,
    canto: r.canto,
    chapter: r.chapter,
    verse: r.verse,
    addedAt: r.added_at,
    note: r.note,
  }));
}

export async function addFavorite(fav: Favorite): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO favorites (id, verse_id, book_slug, canto, chapter, verse, added_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [fav.id, fav.verseId, fav.bookSlug, fav.canto ?? null, fav.chapter, String(fav.verse), fav.addedAt, fav.note ?? null]
  );
}

export async function removeFavorite(verseId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM favorites WHERE verse_id = ?', [verseId]);
}

export async function isFavorite(verseId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT id FROM favorites WHERE verse_id = ?', [verseId]);
  return !!row;
}

export async function getTags(): Promise<Tag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM tags ORDER BY created_at DESC');
  return rows.map((r: any): Tag => ({
    id: r.id, name: r.name, color: r.color, createdAt: r.created_at,
  }));
}

export async function createTag(tag: Tag): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)',
    [tag.id, tag.name, tag.color, tag.createdAt]
  );
}

export async function deleteTag(tagId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM tags WHERE id = ?', [tagId]);
  await db.runAsync('DELETE FROM verse_tags WHERE tag_id = ?', [tagId]);
}

export async function addVerseTag(verseId: string, tagId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO verse_tags (verse_id, tag_id) VALUES (?, ?)',
    [verseId, tagId]
  );
}

export async function removeVerseTag(verseId: string, tagId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM verse_tags WHERE verse_id = ? AND tag_id = ?', [verseId, tagId]);
}

export async function getVerseTagIds(verseId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT tag_id FROM verse_tags WHERE verse_id = ?', [verseId]);
  return rows.map((r: any) => r.tag_id);
}

export async function getVersesByTag(tagId: string): Promise<Verse[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT v.* FROM verses v INNER JOIN verse_tags vt ON v.id = vt.verse_id WHERE vt.tag_id = ?',
    [tagId]
  );
  return rows.map(rowToVerse);
}

export async function getNote(verseId: string): Promise<Note | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM notes WHERE verse_id = ?', [verseId]);
  if (!row) return null;
  return { id: row.id, verseId: row.verse_id, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO notes (id, verse_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [note.id, note.verseId, note.content, note.createdAt, note.updatedAt]
  );
}

export async function deleteNote(verseId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE verse_id = ?', [verseId]);
}

export async function updateReadingProgress(
  bookSlug: string, chapter: number, verse: string, canto?: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO reading_progress (book_slug, canto, chapter, verse, updated_at)
     VALUES (?, ?, ?, ?, strftime('%s','now'))`,
    [bookSlug, canto ?? 0, chapter, verse]
  );
}

export async function getReadingProgress(bookSlug: string, canto?: number): Promise<{ chapter: number; verse: string } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    'SELECT chapter, verse FROM reading_progress WHERE book_slug = ? AND canto = ?',
    [bookSlug, canto ?? 0]
  );
  return row ? { chapter: row.chapter, verse: row.verse } : null;
}

export async function markChapterCompleted(bookSlug: string, chapter: number, canto?: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO completed_chapters (book_slug, canto, chapter, completed_at)
     VALUES (?, ?, ?, strftime('%s','now'))`,
    [bookSlug, canto ?? 0, chapter]
  );
}

export async function getCompletedChapters(bookSlug: string): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT chapter FROM completed_chapters WHERE book_slug = ?',
    [bookSlug]
  );
  return rows.map((r: any) => r.chapter);
}

export interface DownloadStatus {
  status: 'not_downloaded' | 'queued' | 'downloading' | 'downloaded' | 'partial';
  progress: number;
  total: number;
  downloaded: number;
  downloadedAt?: number;
}

export async function getDownloadStatus(bookSlug: string): Promise<DownloadStatus> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
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
}

// Slugs of books fully downloaded for offline use — for at-a-glance badges.
export async function getDownloadedBookSlugs(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT book_slug FROM download_status WHERE status = 'downloaded'"
  );
  return rows.map((r: any) => r.book_slug);
}

// Every persisted download row, keyed by slug — seeds the download manager's
// in-memory state on launch so the UI reflects past downloads at a glance.
export async function getAllDownloadStatuses(): Promise<Record<string, DownloadStatus>> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT book_slug, status, total_verses, downloaded_verses, downloaded_at FROM download_status'
  );
  const map: Record<string, DownloadStatus> = {};
  for (const row of rows) {
    map[row.book_slug] = {
      status: row.status,
      progress: row.total_verses > 0 ? row.downloaded_verses / row.total_verses : 0,
      total: row.total_verses,
      downloaded: row.downloaded_verses,
      downloadedAt: row.downloaded_at ?? undefined,
    };
  }
  return map;
}

// Books that were mid-download or queued when the app last closed — these are
// re-enqueued on launch (and by the background task) so downloads resume.
export async function getResumableBookSlugs(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT book_slug FROM download_status WHERE status IN ('queued', 'downloading')"
  );
  return rows.map((r: any) => r.book_slug);
}

export async function setDownloadStatus(
  bookSlug: string,
  status: DownloadStatus['status'],
  totalVerses: number,
  downloadedVerses: number
): Promise<void> {
  const db = await getDb();
  const downloadedAt = status === 'downloaded' ? Math.floor(Date.now() / 1000) : null;
  await db.runAsync(
    `INSERT OR REPLACE INTO download_status
       (book_slug, status, total_verses, downloaded_verses, downloaded_at)
     VALUES (?, ?, ?, ?, ?)`,
    [bookSlug, status, totalVerses, downloadedVerses, downloadedAt]
  );
}

// --- Per-chapter download completion (enables accurate, skip-ahead resume) ---

// chapter_key -> verse_count for every fully-downloaded chapter of this book.
export async function getDownloadedChapters(
  bookSlug: string, language: string
): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT chapter_key, verse_count FROM download_chapters WHERE book_slug = ? AND language = ?',
    [bookSlug, language]
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.chapter_key, r.verse_count);
  return map;
}

export async function markDownloadedChapter(
  bookSlug: string, language: string, chapterKey: string, verseCount: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO download_chapters (book_slug, language, chapter_key, verse_count)
     VALUES (?, ?, ?, ?)`,
    [bookSlug, language, chapterKey, verseCount]
  );
}

// Wipe completion markers for a book (used when force re-downloading from scratch).
export async function clearDownloadedChapters(bookSlug: string, language: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM download_chapters WHERE book_slug = ? AND language = ?',
    [bookSlug, language]
  );
}

export async function saveDailySloka(
  date: string, bookSlug: string, chapter: number, verse: string, canto?: number
): Promise<void> {
  const db = await getDb();
  const id = buildVerseId(bookSlug, chapter, verse, canto);
  await db.runAsync(
    `INSERT OR REPLACE INTO daily_sloka (date, verse_id, book_slug, canto, chapter, verse)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, id, bookSlug, canto ?? null, chapter, verse]
  );
}

export async function getDailySloka(date: string): Promise<{ bookSlug: string; canto?: number; chapter: number; verse: string } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    'SELECT book_slug, canto, chapter, verse FROM daily_sloka WHERE date = ?',
    [date]
  );
  return row ? { bookSlug: row.book_slug, canto: row.canto ?? undefined, chapter: row.chapter, verse: row.verse } : null;
}

export function buildVerseId(
  bookSlug: string, chapter: number, verse: string, canto?: number
): string {
  if (canto !== undefined) return `${bookSlug}:${canto}:${chapter}:${verse}`;
  return `${bookSlug}:${chapter}:${verse}`;
}

function rowToVerse(r: any): Verse {
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
