// Web data layer — same parsing/URL logic as native (vedabaseParser), but fetches
// through the local CORS proxy (cors-proxy.js) since the browser can't fetch
// vedabase.io cross-origin. Keeps web behavior faithful to the device.
import { Verse, Language } from '@/types';
import {
  buildVerseId, saveVerse, getVerse, findCachedCombinedVerse, setDownloadStatus,
  getDownloadedChapters, markDownloadedChapter,
} from '@/database/queries';
import {
  buildVerseUrl,
  buildChapterUrl,
  parseVerseFromRsc,
  extractVerseList,
  extractChapterTitle,
  isChallengeOrEmpty,
} from './vedabaseParser';

import { isVanisourceBook, buildVanisourceUrl, extractVanisourceProse } from './vanisourceParser';
import { getBridge, isDesktop } from '@/database/desktopBridge';
import { runPool, createLimiter } from '@/utils/pool';

export { isFlatBook, isChapterPageBook } from './vedabaseParser';
export { isVanisourceBook } from './vanisourceParser';

// Two transports, picked at call time:
//
//  * Desktop (Electron): the main process fetches vedabase.io / vanisource.org
//    directly — it is not subject to CORS — so the real URLs are used as-is and
//    no local proxy has to be installed or started on the user's machine.
//  * Browser (`npm run web:dev`): the request goes through cors-proxy.js, which
//    maps http://localhost:3001/api/<path> -> https://vedabase.io/<path> and
//    http://localhost:3001/vs/<path> -> https://vanisource.org/<path>.
const PROXY = 'http://localhost:3001/api';
const toProxy = (url: string) =>
  isDesktop() ? url : url.replace('https://vedabase.io', PROXY);
const toVsProxy = (url: string) =>
  isDesktop() ? url : url.replace('https://vanisource.org', 'http://localhost:3001/vs');

export interface FetchVerseResult {
  verse: Verse | null;
  networkError: boolean;
}

async function getHtml(url: string): Promise<string | null> {
  const bridge = getBridge();
  if (bridge) {
    try {
      return await bridge.fetchText(url);
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchVerseDetailed(
  bookSlug: string,
  chapter: number,
  verse: string,
  canto?: number | null,
  language: Language = 'en'
): Promise<FetchVerseResult> {
  const cantoNum = canto ?? undefined;
  const cached = await getVerse(bookSlug, chapter, verse, cantoNum, language);
  if (cached) return { verse: cached, networkError: false };

  // The verse may be a member of a combined verse already cached under a range
  // id (e.g. sb 11.19.36 lives inside the cached sb 11.19.36-39). Serve that —
  // this also works offline, before any network call.
  const cachedCombined = await findCachedCombinedVerse(bookSlug, chapter, verse, cantoNum, language);
  if (cachedCombined) return { verse: cachedCombined, networkError: false };

  // Vanisource books: `verse` is the MediaWiki page title; fetch via API (proxy).
  if (isVanisourceBook(bookSlug)) {
    const json = await getHtml(toVsProxy(buildVanisourceUrl(verse)));
    if (json === null) return { verse: null, networkError: true };
    const prose = extractVanisourceProse(json);
    if (!prose) return { verse: null, networkError: false };
    const v: Verse = { id: buildVerseId(bookSlug, chapter, verse, undefined), bookSlug: bookSlug as any, chapter, verse, translation: prose, language };
    try { await saveVerse(v); } catch { /* best-effort */ }
    return { verse: v, networkError: false };
  }

  const direct = await fetchStandaloneVerse(bookSlug, chapter, verse, canto, language);
  if (direct.verse || direct.networkError) return direct;

  // Not a standalone page — it may be a member of a combined verse listed on the
  // chapter page (e.g. sb 11.19.36 -> sb 11.19.36-39). Resolve the range and
  // fetch that instead so individual-verse references still land on content.
  const combinedId = await combinedVerseIdFor(bookSlug, chapter, verse, canto, language);
  if (combinedId && combinedId !== verse) {
    const combinedCached = await getVerse(bookSlug, chapter, combinedId, cantoNum, language);
    if (combinedCached) return { verse: combinedCached, networkError: false };
    return fetchStandaloneVerse(bookSlug, chapter, combinedId, canto, language);
  }

  return direct;
}

// Fetch + parse a single standalone verse page through the proxy (no cache or
// combined-verse fallback — callers handle that).
async function fetchStandaloneVerse(
  bookSlug: string,
  chapter: number,
  verse: string,
  canto?: number | null,
  language: Language = 'en'
): Promise<FetchVerseResult> {
  const cantoNum = canto ?? undefined;
  const url = toProxy(buildVerseUrl(bookSlug, chapter, verse, canto, language));
  const html = await getHtml(url);
  if (html === null) return { verse: null, networkError: true };
  if (isChallengeOrEmpty(html)) return { verse: null, networkError: false };

  const data = parseVerseFromRsc(html, verse);
  if (!data) return { verse: null, networkError: false };

  const verseObj: Verse = {
    id: buildVerseId(bookSlug, chapter, verse, cantoNum),
    bookSlug: bookSlug as any,
    canto: cantoNum,
    chapter,
    verse,
    devanagari: data.devanagari || undefined,
    transliteration: data.verse_text || undefined,
    synonyms: data.synonyms || undefined,
    translation: data.translation || undefined,
    purport: data.purport || undefined,
    audioUrl: data.audio || undefined,
    language,
  };

  try { await saveVerse(verseObj); } catch { /* best-effort cache */ }
  return { verse: verseObj, networkError: false };
}

// Find the combined-verse range on the chapter page that contains an individual
// verse number (e.g. 36 -> "36-39"). Returns null if the verse stands alone or
// the chapter list is unreachable.
async function combinedVerseIdFor(
  bookSlug: string,
  chapter: number,
  verse: string,
  canto?: number | null,
  language: Language = 'en'
): Promise<string | null> {
  if (verse.includes('-')) return null;
  const target = parseInt(verse, 10);
  if (isNaN(target)) return null;

  const verseIds = await fetchChapterVerseList(bookSlug, chapter, canto, language);
  for (const id of verseIds) {
    const m = /^(\d+)-(\d+)$/.exec(id);
    if (m && target >= parseInt(m[1], 10) && target <= parseInt(m[2], 10)) return id;
  }
  return null;
}

export async function fetchVerse(
  bookSlug: string,
  chapter: number,
  verse: string,
  canto?: number | null,
  language: Language = 'en'
): Promise<Verse | null> {
  return (await fetchVerseDetailed(bookSlug, chapter, verse, canto, language)).verse;
}

interface ChapterPageData {
  verseIds: string[];
  title: string | null;
}

// Cache the parsed chapter page per URL so the title lookup rides on the same
// proxied download as the verse list — no extra request.
const chapterPageCache = new Map<string, ChapterPageData>();

async function fetchChapterPage(
  bookSlug: string,
  chapter: number,
  canto?: number | null,
  language: Language = 'en'
): Promise<ChapterPageData> {
  const url = toProxy(buildChapterUrl(bookSlug, chapter, canto, language));
  const cached = chapterPageCache.get(url);
  if (cached) return cached;

  for (let attempt = 0; attempt < 2; attempt++) {
    const html = await getHtml(url);
    if (html) {
      const ids = extractVerseList(html, bookSlug, chapter, canto, language);
      if (ids.length > 0) {
        const data: ChapterPageData = { verseIds: ids, title: extractChapterTitle(html) };
        chapterPageCache.set(url, data);
        return data;
      }
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
  }
  return { verseIds: [], title: null };
}

export async function fetchChapterVerseList(
  bookSlug: string,
  chapter: number,
  canto?: number | null,
  language: Language = 'en'
): Promise<string[]> {
  return (await fetchChapterPage(bookSlug, chapter, canto, language)).verseIds;
}

export async function fetchChapterTitle(
  bookSlug: string,
  chapter: number,
  canto?: number | null,
  language: Language = 'en'
): Promise<string | null> {
  return (await fetchChapterPage(bookSlug, chapter, canto, language)).title;
}

export interface CacheBookResult {
  success: number;
  failed: number;
  total: number;
  stopped: boolean;
}

const chapterKeyOf = (c: { chapter: number; cantoPart?: number }) =>
  `${c.cantoPart ?? 0}:${c.chapter}`;

export async function fetchAndCacheBook(
  bookSlug: string,
  chapterList: Array<{ chapter: number; verseCount: number; cantoPart?: number }>,
  language: Language = 'en',
  onProgress?: (done: number, total: number) => void,
  shouldStop?: () => boolean,
  concurrency = 1
): Promise<CacheBookResult> {
  const doneChapters = await getDownloadedChapters(bookSlug, language);

  // Seed totals/progress from completed chapters so a resume never restarts at 0%.
  let total = 0, done = 0;
  for (const c of chapterList) {
    const recorded = doneChapters.get(chapterKeyOf(c));
    if (recorded !== undefined) { total += recorded; done += recorded; }
    else total += c.verseCount;
  }
  let success = done, failed = 0;

  await setDownloadStatus(bookSlug, 'downloading', total, done);
  onProgress?.(done, total);

  // Up to `concurrency` pages in flight: parallel chapter lanes, with every
  // request going through one shared limiter (see vedabaseApi.ts).
  const limit = createLimiter(concurrency);
  let stopped = false;
  const stop = () => stopped || (stopped = !!shouldStop?.());

  const pending = chapterList.filter((c) => !doneChapters.has(chapterKeyOf(c)));
  await runPool(pending, concurrency, async (c) => {
    const { chapter, verseCount, cantoPart } = c;
    const key = chapterKeyOf(c);
    if (stop()) return;
    let verseIds = await limit(() => fetchChapterVerseList(bookSlug, chapter, cantoPart, language));
    const listOk = verseIds.length > 0;
    if (!listOk) {
      verseIds = Array.from({ length: verseCount }, (_, i) => String(i + 1));
    } else {
      total += verseIds.length - verseCount;
    }
    let chapterNetworkError = !listOk;
    let chapterStopped = false;
    await Promise.all(verseIds.map((vid) => limit(async () => {
      if (stop()) { chapterStopped = true; return; }
      const { verse, networkError } = await fetchVerseDetailed(bookSlug, chapter, vid, cantoPart, language);
      if (verse) success++;
      else { failed++; if (networkError) chapterNetworkError = true; }
      onProgress?.(++done, total);
    })));
    if (!chapterNetworkError && !chapterStopped) {
      await markDownloadedChapter(bookSlug, language, key, verseIds.length);
    }
    await setDownloadStatus(bookSlug, 'downloading', total, success);
  });

  if (stopped) {
    await setDownloadStatus(bookSlug, 'downloading', total, success);
    return { success, failed, total, stopped: true };
  }

  await setDownloadStatus(bookSlug, failed === 0 ? 'downloaded' : 'partial', total, success);
  return { success, failed, total, stopped: false };
}

export async function searchOnline(): Promise<Array<{ title: string; url: string; snippet: string }>> {
  return [];
}
