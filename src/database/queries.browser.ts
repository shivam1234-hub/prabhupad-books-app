// Web implementation of queries using in-memory localStorage-backed store
import { getWebDb, persistWebDb } from './db.web';
import { Verse, Favorite, Tag, Note } from '@/types';
import { queryTerms } from '@/utils/searchMatch';
import { rankVerses } from '@/utils/searchRelevance';

export function buildVerseId(bookSlug: string, chapter: number, verse: string, canto?: number): string {
  if (canto !== undefined) return `${bookSlug}:${canto}:${chapter}:${verse}`;
  return `${bookSlug}:${chapter}:${verse}`;
}

export async function getVerse(
  bookSlug: string, chapter: number, verse: string, canto?: number, language = 'en'
): Promise<Verse | null> {
  const db = getWebDb();
  const id = buildVerseId(bookSlug, chapter, verse, canto);
  return (db.verses.get(id) as Verse) ?? null;
}

export async function saveVerse(verse: Verse): Promise<void> {
  const db = getWebDb();
  db.verses.set(verse.id, verse);
  persistWebDb();
}

export async function getChapterVerses(
  bookSlug: string, chapter: number, canto?: number, _language = 'en'
): Promise<Verse[]> {
  const db = getWebDb();
  return [...db.verses.values()].filter(
    (v: any) => v.bookSlug === bookSlug && v.chapter === chapter &&
      (canto !== undefined ? v.canto === canto : v.canto === undefined)
  ) as Verse[];
}

// An individual verse (e.g. sb 11.19.36) may be cached only as part of a combined
// verse stored under a range id (sb:11:19:36-39). Find that range row, if any.
export async function findCachedCombinedVerse(
  bookSlug: string, chapter: number, verse: string, canto?: number, _language = 'en'
): Promise<Verse | null> {
  if (verse.includes('-')) return null; // already a range
  const target = parseInt(verse, 10);
  if (isNaN(target)) return null; // front-matter / named page

  const db = getWebDb();
  for (const v of db.verses.values() as IterableIterator<any>) {
    if (v.bookSlug !== bookSlug || v.chapter !== chapter) continue;
    if (canto !== undefined ? v.canto !== canto : v.canto !== undefined) continue;
    const m = /^(\d+)-(\d+)$/.exec(String(v.verse));
    if (m && target >= parseInt(m[1], 10) && target <= parseInt(m[2], 10)) return v as Verse;
  }
  return null;
}

export async function searchVerses(query: string, bookSlug?: string, limit = 50): Promise<Verse[]> {
  const db = getWebDb();
  // Diacritic-insensitive, typo-tolerant, relevance-ranked match across all
  // text fields (incl. transliteration) — "tapo divyam" matches the stored
  // "tapo divyaṁ", and translation hits outrank purport-only hits.
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const candidates = [...db.verses.values()].filter(
    (v: any) => !bookSlug || v.bookSlug === bookSlug
  ) as Verse[];
  return rankVerses(candidates, terms).slice(0, limit);
}

const foldWeb = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Plain-browser build: scan the cache for a verse containing the quoted words.
export async function findVersesByTransliteration(words: string[], limit = 20, language = 'en'): Promise<Verse[]> {
  const key = words.join('');
  if (words.length < 2) return [];
  const out: Verse[] = [];
  for (const v of getWebDb().verses.values() as IterableIterator<any>) {
    if (!v.transliteration || (v.language ?? 'en') !== language) continue;
    if (!foldWeb(v.transliteration).replace(/[^a-z]/g, '').includes(key)) continue;
    out.push(v as Verse);
    if (out.length >= limit) break;
  }
  return out;
}

export interface SynonymRow {
  bookSlug: string; canto?: number; chapter: number; verse: string; synonyms: string;
}

// Plain-browser dev build: no FTS here, so scan the (small) localStorage cache.
export async function getSynonymCandidates(
  prefix: string, limit = 300, language = 'en'
): Promise<SynonymRow[]> {
  const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const re = new RegExp(`(^|[^a-z])${prefix}`);
  const out: SynonymRow[] = [];
  for (const v of getWebDb().verses.values() as IterableIterator<any>) {
    if (!v.synonyms || (v.language ?? 'en') !== language || !re.test(fold(v.synonyms))) continue;
    out.push({ bookSlug: v.bookSlug, canto: v.canto, chapter: v.chapter, verse: String(v.verse), synonyms: v.synonyms });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getFavorites(): Promise<Favorite[]> {
  const db = getWebDb();
  return [...db.favorites.values()].sort((a: any, b: any) => b.addedAt - a.addedAt) as Favorite[];
}

export async function addFavorite(fav: Favorite): Promise<void> {
  const db = getWebDb();
  if (!db.favorites.has(fav.id)) {
    db.favorites.set(fav.id, fav);
    persistWebDb();
  }
}

export async function removeFavorite(verseId: string): Promise<void> {
  const db = getWebDb();
  for (const [k, v] of db.favorites.entries()) {
    if ((v as any).verseId === verseId) { db.favorites.delete(k); break; }
  }
  persistWebDb();
}

export async function isFavorite(verseId: string): Promise<boolean> {
  const db = getWebDb();
  return [...db.favorites.values()].some((v: any) => v.verseId === verseId);
}

export async function getTags(): Promise<Tag[]> {
  const db = getWebDb();
  return [...db.tags.values()].sort((a: any, b: any) => b.createdAt - a.createdAt) as Tag[];
}

export async function createTag(tag: Tag): Promise<void> {
  const db = getWebDb();
  db.tags.set(tag.id, tag);
  persistWebDb();
}

export async function deleteTag(tagId: string): Promise<void> {
  const db = getWebDb();
  db.tags.delete(tagId);
  for (const [vid, set] of db.verseTags.entries()) {
    set.delete(tagId);
    if (set.size === 0) db.verseTags.delete(vid);
  }
  persistWebDb();
}

export async function addVerseTag(verseId: string, tagId: string): Promise<void> {
  const db = getWebDb();
  if (!db.verseTags.has(verseId)) db.verseTags.set(verseId, new Set());
  db.verseTags.get(verseId)!.add(tagId);
  persistWebDb();
}

export async function removeVerseTag(verseId: string, tagId: string): Promise<void> {
  const db = getWebDb();
  db.verseTags.get(verseId)?.delete(tagId);
  persistWebDb();
}

export async function getVerseTagIds(verseId: string): Promise<string[]> {
  const db = getWebDb();
  return [...(db.verseTags.get(verseId) ?? [])];
}

export async function getVersesByTag(tagId: string): Promise<Verse[]> {
  const db = getWebDb();
  const verseIds: string[] = [];
  for (const [vid, tags] of db.verseTags.entries()) {
    if (tags.has(tagId)) verseIds.push(vid);
  }
  return verseIds.map((id) => db.verses.get(id)).filter(Boolean) as Verse[];
}

export async function getNote(verseId: string): Promise<Note | null> {
  const db = getWebDb();
  return (db.notes.get(verseId) as Note) ?? null;
}

export async function saveNote(note: Note): Promise<void> {
  const db = getWebDb();
  db.notes.set(note.verseId, note);
  persistWebDb();
}

export async function deleteNote(verseId: string): Promise<void> {
  const db = getWebDb();
  db.notes.delete(verseId);
  persistWebDb();
}

export async function updateReadingProgress(
  bookSlug: string, chapter: number, verse: string, canto?: number
): Promise<void> {
  const db = getWebDb();
  const key = `${bookSlug}:${canto ?? 0}`;
  db.readingProgress.set(key, { bookSlug, canto, chapter, verse, updatedAt: Date.now() });
  persistWebDb();
}

export async function getReadingProgress(
  bookSlug: string, canto?: number
): Promise<{ chapter: number; verse: string } | null> {
  const db = getWebDb();
  const key = `${bookSlug}:${canto ?? 0}`;
  const row = db.readingProgress.get(key) as any;
  return row ? { chapter: row.chapter, verse: row.verse } : null;
}

export async function markChapterCompleted(_bookSlug: string, _chapter: number, _canto?: number): Promise<void> {}
export async function getCompletedChapters(_bookSlug: string): Promise<number[]> { return []; }

export interface DownloadStatus {
  status: 'not_downloaded' | 'queued' | 'downloading' | 'downloaded' | 'partial';
  progress: number;
  total: number;
  downloaded: number;
  downloadedAt?: number;
}

export async function getDownloadStatus(bookSlug: string): Promise<DownloadStatus> {
  const db = getWebDb();
  const row = db.downloadStatus.get(bookSlug);
  if (!row) return { status: 'not_downloaded', progress: 0, total: 0, downloaded: 0 };
  return {
    status: row.status,
    progress: row.total > 0 ? row.downloaded / row.total : 0,
    total: row.total,
    downloaded: row.downloaded,
    downloadedAt: row.downloadedAt,
  };
}

export async function setDownloadStatus(
  bookSlug: string,
  status: DownloadStatus['status'],
  totalVerses: number,
  downloadedVerses: number
): Promise<void> {
  const db = getWebDb();
  db.downloadStatus.set(bookSlug, {
    status,
    total: totalVerses,
    downloaded: downloadedVerses,
    downloadedAt: status === 'downloaded' ? Math.floor(Date.now() / 1000) : undefined,
  });
  persistWebDb();
}

export async function getDownloadedBookSlugs(): Promise<string[]> {
  const db = getWebDb();
  return [...db.downloadStatus.entries()].filter(([, v]) => v.status === 'downloaded').map(([k]) => k);
}

export async function getAllDownloadStatuses(): Promise<Record<string, DownloadStatus>> {
  const db = getWebDb();
  const map: Record<string, DownloadStatus> = {};
  for (const [slug, v] of db.downloadStatus.entries()) {
    map[slug] = {
      status: v.status,
      progress: v.total > 0 ? v.downloaded / v.total : 0,
      total: v.total,
      downloaded: v.downloaded,
      downloadedAt: v.downloadedAt,
    };
  }
  return map;
}

export async function getResumableBookSlugs(): Promise<string[]> {
  const db = getWebDb();
  return [...db.downloadStatus.entries()]
    .filter(([, v]) => v.status === 'queued' || v.status === 'downloading')
    .map(([k]) => k);
}

const chapterRowKey = (bookSlug: string, language: string, chapterKey: string) =>
  `${bookSlug}|${language}|${chapterKey}`;

export async function getDownloadedChapters(
  bookSlug: string, language: string
): Promise<Map<string, number>> {
  const db = getWebDb();
  const prefix = `${bookSlug}|${language}|`;
  const map = new Map<string, number>();
  for (const [k, v] of db.downloadChapters.entries()) {
    if (k.startsWith(prefix)) map.set(k.slice(prefix.length), v);
  }
  return map;
}

export async function markDownloadedChapter(
  bookSlug: string, language: string, chapterKey: string, verseCount: number
): Promise<void> {
  const db = getWebDb();
  db.downloadChapters.set(chapterRowKey(bookSlug, language, chapterKey), verseCount);
  persistWebDb();
}

export async function clearDownloadedChapters(bookSlug: string, language: string): Promise<void> {
  const db = getWebDb();
  const prefix = `${bookSlug}|${language}|`;
  for (const k of [...db.downloadChapters.keys()]) {
    if (k.startsWith(prefix)) db.downloadChapters.delete(k);
  }
  persistWebDb();
}

export async function saveDailySloka(
  date: string, bookSlug: string, chapter: number, verse: string, canto?: number
): Promise<void> {
  const db = getWebDb();
  db.dailySloka.set(date, { bookSlug, canto, chapter, verse });
  persistWebDb();
}

export async function getDailySloka(
  date: string
): Promise<{ bookSlug: string; canto?: number; chapter: number; verse: string } | null> {
  const db = getWebDb();
  return (db.dailySloka.get(date) as any) ?? null;
}
