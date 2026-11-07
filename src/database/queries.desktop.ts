// Desktop data layer — the same API as src/database/queries.ts, but every call
// is forwarded over the Electron bridge to the real SQLite database in
// desktop/db.js. That gives the desktop app the full offline library (FTS5
// search over every downloaded verse), instead of the size-limited
// localStorage store the plain-browser build falls back to.
import { Verse, Favorite, Tag, Note } from '@/types';
import { queryTerms, ftsPhraseExpr, ftsWordsExpr } from '@/utils/searchMatch';
import { rankVerses } from '@/utils/searchRelevance';
import { getBridge } from './desktopBridge';

function call<T>(method: string, args: unknown[] = []): Promise<T> {
  const bridge = getBridge();
  if (!bridge) return Promise.reject(new Error('Desktop bridge unavailable'));
  return bridge.db<T>(method, args);
}

export function buildVerseId(bookSlug: string, chapter: number, verse: string, canto?: number): string {
  if (canto !== undefined) return `${bookSlug}:${canto}:${chapter}:${verse}`;
  return `${bookSlug}:${chapter}:${verse}`;
}

export const getVerse = (bookSlug: string, chapter: number, verse: string, canto?: number, language = 'en') =>
  call<Verse | null>('getVerse', [bookSlug, chapter, verse, canto, language]);

export const saveVerse = (verse: Verse) => call<void>('saveVerse', [verse]);

export const getChapterVerses = (bookSlug: string, chapter: number, canto?: number, language = 'en') =>
  call<Verse[]>('getChapterVerses', [bookSlug, chapter, canto, language]);

export const findCachedCombinedVerse = (
  bookSlug: string, chapter: number, verse: string, canto?: number, language = 'en'
) => call<Verse | null>('findCachedCombinedVerse', [bookSlug, chapter, verse, canto, language]);

// Retrieval happens in SQLite (FTS5 prefix-OR over every term, diacritics
// folded); ranking uses the SAME rankVerses() scorer as native and browser, so
// a query returns the same ordering on Windows as it does on the phone.
export async function searchVerses(query: string, bookSlug?: string, limit = 50): Promise<Verse[]> {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  // Exact-phrase rows first (see queries.ts searchVerses).
  const phrase = ftsPhraseExpr(terms);
  const phraseRows = phrase ? await call<Verse[]>('searchCandidates', [phrase, bookSlug, limit]) : [];
  const wordRows = await call<Verse[]>('searchCandidates', [
    ftsWordsExpr(terms),
    bookSlug,
    Math.max(limit * 3, 200),
  ]);
  const seen = new Set(phraseRows.map((v) => v.id));
  const candidates = [...phraseRows, ...wordRows.filter((v) => !seen.has(v.id))];
  return rankVerses(candidates, terms).slice(0, limit);
}

export interface SynonymRow {
  bookSlug: string; canto?: number; chapter: number; verse: string; synonyms: string;
}
export const getSynonymCandidates = (prefix: string, limit = 300, language = 'en') =>
  call<SynonymRow[]>('getSynonymCandidates', [prefix, limit, language]);

export const findVersesByTransliteration = (words: string[], limit = 20, language = 'en') =>
  call<Verse[]>('findVersesByTransliteration', [words, limit, language]);

export const getFavorites = () => call<Favorite[]>('getFavorites');
export const addFavorite = (fav: Favorite) => call<void>('addFavorite', [fav]);
export const removeFavorite = (verseId: string) => call<void>('removeFavorite', [verseId]);
export const isFavorite = (verseId: string) => call<boolean>('isFavorite', [verseId]);

export const getTags = () => call<Tag[]>('getTags');
export const createTag = (tag: Tag) => call<void>('createTag', [tag]);
export const deleteTag = (tagId: string) => call<void>('deleteTag', [tagId]);
export const addVerseTag = (verseId: string, tagId: string) => call<void>('addVerseTag', [verseId, tagId]);
export const removeVerseTag = (verseId: string, tagId: string) => call<void>('removeVerseTag', [verseId, tagId]);
export const getVerseTagIds = (verseId: string) => call<string[]>('getVerseTagIds', [verseId]);
export const getVersesByTag = (tagId: string) => call<Verse[]>('getVersesByTag', [tagId]);

export const getNote = (verseId: string) => call<Note | null>('getNote', [verseId]);
export const saveNote = (note: Note) => call<void>('saveNote', [note]);
export const deleteNote = (verseId: string) => call<void>('deleteNote', [verseId]);

export const updateReadingProgress = (bookSlug: string, chapter: number, verse: string, canto?: number) =>
  call<void>('updateReadingProgress', [bookSlug, chapter, verse, canto]);

export const getReadingProgress = (bookSlug: string, canto?: number) =>
  call<{ chapter: number; verse: string } | null>('getReadingProgress', [bookSlug, canto]);

// Real implementations on desktop — the browser fallback stubs these out.
export const markChapterCompleted = (bookSlug: string, chapter: number, canto?: number) =>
  call<void>('markChapterCompleted', [bookSlug, chapter, canto]);

export const getCompletedChapters = (bookSlug: string) =>
  call<number[]>('getCompletedChapters', [bookSlug]);

export interface DownloadStatus {
  status: 'not_downloaded' | 'queued' | 'downloading' | 'downloaded' | 'partial';
  progress: number;
  total: number;
  downloaded: number;
  downloadedAt?: number;
}

export const getDownloadStatus = (bookSlug: string) =>
  call<DownloadStatus>('getDownloadStatus', [bookSlug]);

export const setDownloadStatus = (
  bookSlug: string, status: DownloadStatus['status'], totalVerses: number, downloadedVerses: number
) => call<void>('setDownloadStatus', [bookSlug, status, totalVerses, downloadedVerses]);

export const getDownloadedBookSlugs = () => call<string[]>('getDownloadedBookSlugs');
export const getAllDownloadStatuses = () => call<Record<string, DownloadStatus>>('getAllDownloadStatuses');
export const getResumableBookSlugs = () => call<string[]>('getResumableBookSlugs');

// A Map does not survive IPC structured cloning across the contextBridge, so
// main sends entry pairs and we rebuild the Map the callers expect.
export async function getDownloadedChapters(bookSlug: string, language: string): Promise<Map<string, number>> {
  const entries = await call<Array<[string, number]>>('getDownloadedChapters', [bookSlug, language]);
  return new Map(entries);
}

export const markDownloadedChapter = (
  bookSlug: string, language: string, chapterKey: string, verseCount: number
) => call<void>('markDownloadedChapter', [bookSlug, language, chapterKey, verseCount]);

export const clearDownloadedChapters = (bookSlug: string, language: string) =>
  call<void>('clearDownloadedChapters', [bookSlug, language]);

export const saveDailySloka = (
  date: string, bookSlug: string, chapter: number, verse: string, canto?: number
) => call<void>('saveDailySloka', [date, bookSlug, chapter, verse, canto]);

export const getDailySloka = (date: string) =>
  call<{ bookSlug: string; canto?: number; chapter: number; verse: string } | null>('getDailySloka', [date]);
