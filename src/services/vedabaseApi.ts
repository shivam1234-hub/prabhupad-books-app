import { Verse, Language } from '@/types';
import {
  buildVerseId, saveVerse, getVerse, findCachedCombinedVerse, setDownloadStatus,
  getDownloadedChapters, markDownloadedChapter,
} from '@/database/queries';
import {
  buildVerseUrl,
  buildChapterUrl,
  chapterListPattern,
  isChallengeOrEmpty,
  parseVerseFromRsc,
  extractChapterTitle,
} from './vedabaseParser';

import { isVanisourceBook, buildVanisourceUrl, extractVanisourceProse } from './vanisourceParser';
import { runPool, createLimiter } from '@/utils/pool';

export { isFlatBook, isChapterPageBook } from './vedabaseParser';
export { isVanisourceBook } from './vanisourceParser';

const BASE_URL = 'https://vedabase.io';

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      },
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}


// Distinguishes "verse doesn't exist" (404 / parse-miss — e.g. a combined-verse
// member like bg 1.16, which 404s because the real page is bg 1.16-18) from a
// genuine network failure. Callers iterating a chapter must NOT treat a 404 as
// "give up — offline", or they stop at the first combined verse.
export interface FetchVerseResult {
  verse: Verse | null;
  networkError: boolean;
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

  // Vanisource books: `verse` is the MediaWiki page title; fetch via the API.
  if (isVanisourceBook(bookSlug)) {
    return fetchVanisourcePage(bookSlug, chapter, verse, language, buildVanisourceUrl(verse));
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

// Fetch + parse a single standalone verse page (no cache or combined-verse
// fallback — callers handle that). Returns networkError=true only for genuine
// connectivity failures; a 404 / parse-miss is {verse: null, networkError: false}.
async function fetchStandaloneVerse(
  bookSlug: string,
  chapter: number,
  verse: string,
  canto?: number | null,
  language: Language = 'en'
): Promise<FetchVerseResult> {
  const cantoNum = canto ?? undefined;
  const url = buildVerseUrl(bookSlug, chapter, verse, canto, language);

  let res: Response;
  try {
    res = await fetchWithTimeout(url);
  } catch {
    // fetch threw / timed out / aborted — this is a real network problem.
    if (__DEV__) console.warn(`[vedabase] network error for ${url}`);
    return { verse: null, networkError: true };
  }

  if (!res.ok) {
    // 404 etc. — the verse simply isn't a standalone page (combined verse).
    if (__DEV__) console.warn(`[vedabase] HTTP ${res.status} for ${url}`);
    return { verse: null, networkError: false };
  }

  let html: string;
  try {
    html = await res.text();
  } catch {
    return { verse: null, networkError: true };
  }

  // Detect Cloudflare or other bot-challenge pages
  if (html.includes('cf-browser-verification') || html.includes('Just a moment') || html.length < 500) {
    if (__DEV__) console.warn(`[vedabase] Got challenge/empty page for ${url} (${html.length} bytes)`);
    return { verse: null, networkError: false };
  }

  const data = parseVerseFromRsc(html, verse);
  if (!data) {
    if (__DEV__) console.warn(`[vedabase] RSC parse failed for ${url}`);
    return { verse: null, networkError: false };
  }

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

  try {
    await saveVerse(verseObj);
  } catch {
    // Caching is best-effort; still return the fetched verse.
  }
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

// Fetch + parse a vanisource MediaWiki page. `url` lets the web layer route
// through the CORS proxy.
export async function fetchVanisourcePage(
  bookSlug: string,
  chapter: number,
  verse: string,
  language: Language,
  url: string
): Promise<FetchVerseResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url);
  } catch {
    return { verse: null, networkError: true };
  }
  if (!res.ok) return { verse: null, networkError: false };
  let json: string;
  try {
    json = await res.text();
  } catch {
    return { verse: null, networkError: true };
  }
  const prose = extractVanisourceProse(json);
  if (!prose) return { verse: null, networkError: false };

  const verseObj: Verse = {
    id: buildVerseId(bookSlug, chapter, verse, undefined),
    bookSlug: bookSlug as any,
    chapter,
    verse,
    translation: prose,
    language,
  };
  try { await saveVerse(verseObj); } catch { /* best-effort */ }
  return { verse: verseObj, networkError: false };
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

// A chapter page is fetched both for its verse list and its title (the <h1>).
// Cache the parsed result per URL so the chapter screen's title lookup rides on
// the same download that already happens for the verse list — no extra request.
const chapterPageCache = new Map<string, ChapterPageData>();

async function fetchChapterPage(
  bookSlug: string,
  chapter: number,
  canto?: number | null,
  language: Language = 'en'
): Promise<ChapterPageData> {
  const url = buildChapterUrl(bookSlug, chapter, canto, language);
  const cached = chapterPageCache.get(url);
  if (cached) return cached;

  const pattern = chapterListPattern(bookSlug, chapter, canto, language);

  // Retry once — this list is the source of truth for the chapter, and a
  // transient miss here would otherwise force a degraded sequential fallback.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const html = await res.text();
        const verses = new Set<string>();
        let m: RegExpExecArray | null;
        pattern.lastIndex = 0;
        while ((m = pattern.exec(html)) !== null) verses.add(m[1]);
        if (verses.size > 0) {
          const data: ChapterPageData = {
            verseIds: Array.from(verses),
            title: extractChapterTitle(html),
          };
          chapterPageCache.set(url, data);
          return data;
        }
      }
    } catch {
      // fall through to retry
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
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

// The real chapter title (the page <h1>). Rides the fetchChapterPage cache, so
// once the verse list has loaded this returns instantly with no extra request.
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
  // True when shouldStop() interrupted the run (cancel / paused for background
  // time budget). The row is left as 'downloading' so it resumes later. Already
  // cached verses are served from SQLite on resume, so re-walking is cheap.
  stopped: boolean;
}

const chapterKeyOf = (c: { chapter: number; cantoPart?: number }) =>
  `${c.cantoPart ?? 0}:${c.chapter}`;

export async function fetchAndCacheBook(
  bookSlug: string,
  chapterList: Array<{ chapter: number; verseCount: number; cantoPart?: number; pageId?: string }>,
  language: Language = 'en',
  onProgress?: (done: number, total: number) => void,
  shouldStop?: () => boolean,
  concurrency = 1
): Promise<CacheBookResult> {
  // Chapters already fully downloaded in a previous run. We skip these entirely
  // (no network) and seed progress from them, so a resumed/relaunched download
  // continues from where it left off instead of restarting the book at 0%.
  const doneChapters = await getDownloadedChapters(bookSlug, language);

  // Seed running totals from completed chapters. `total` uses the recorded verse
  // count for done chapters and the meta estimate for the rest (corrected per
  // chapter once its real verse list is fetched).
  let total = 0;
  let done = 0;
  for (const c of chapterList) {
    const recorded = doneChapters.get(chapterKeyOf(c));
    if (recorded !== undefined) { total += recorded; done += recorded; }
    else total += c.verseCount;
  }
  let success = done; // completed chapters count as already-successful verses
  let failed = 0;

  await setDownloadStatus(bookSlug, 'downloading', total, done);
  onProgress?.(done, total);

  // Up to `concurrency` pages are fetched at once: chapters are worked on in
  // parallel lanes, and every request (chapter list or verse) goes through one
  // shared limiter so the total in flight never exceeds the setting.
  const limit = createLimiter(concurrency);
  let stopped = false;
  const stop = () => stopped || (stopped = !!shouldStop?.());

  const pending = chapterList.filter((c) => !doneChapters.has(chapterKeyOf(c)));
  await runPool(pending, concurrency, async (chapterMeta) => {
    const { verseCount, cantoPart, pageId } = chapterMeta;
    const key = chapterKeyOf(chapterMeta);
    if (stop()) return;

    // Vanisource pages (lectures, letters, vanisource-only books) are one wiki
    // page each, opened by the reader as chapter 1 with the page title as the
    // verse — so fetch and store them exactly that way. They have no vedabase
    // chapter list; asking for one fell back to a page named "1", which
    // doesn't exist, and left every such book "Partial 0/N".
    const chapter = pageId ? 1 : chapterMeta.chapter;

    // Use the real verse identifiers (handles combined verses like "16-18");
    // fall back to sequential numbering if the chapter page is unreachable.
    let verseIds = pageId
      ? [pageId]
      : await limit(() => fetchChapterVerseList(bookSlug, chapter, cantoPart, language));
    const listOk = verseIds.length > 0;
    if (!listOk) {
      verseIds = Array.from({ length: verseCount }, (_, i) => String(i + 1));
    } else {
      // Correct the running total for this chapter's true verse count.
      total += verseIds.length - verseCount;
    }

    // Only a genuine network failure (not a 404 for a combined-verse member)
    // should keep us from marking the chapter complete. A failed list fetch
    // means we don't even have the real verse ids yet, so never mark it done.
    let chapterNetworkError = !listOk;
    let chapterStopped = false;

    await Promise.all(verseIds.map((vid) => limit(async () => {
      if (stop()) { chapterStopped = true; return; }
      const { verse, networkError } = await fetchVerseDetailed(bookSlug, chapter, vid, cantoPart, language);
      if (verse) success++;
      else {
        failed++;
        if (networkError) chapterNetworkError = true;
      }
      done++;
      onProgress?.(done, total);
      // Persist periodically within long chapters so progress survives a kill
      // mid-chapter (the verses themselves are already cached by fetchVerse).
      if (done % 25 === 0) await setDownloadStatus(bookSlug, 'downloading', total, success);
    })));

    // Mark the chapter complete so a future resume skips it. We require that we
    // reached every verse id without a network error; combined-verse 404s are fine.
    if (!chapterNetworkError && !chapterStopped) {
      await markDownloadedChapter(bookSlug, language, key, verseIds.length);
    }
    // Persist progress per chapter so a closed/reopened app reflects reality.
    await setDownloadStatus(bookSlug, 'downloading', total, success);
    // Be gentle with vedabase.io when downloading one page at a time.
    if (concurrency === 1) await new Promise((r) => setTimeout(r, 100));
  });

  if (stopped) {
    await setDownloadStatus(bookSlug, 'downloading', total, success);
    return { success, failed, total, stopped: true };
  }

  // failed > 0 means some verses couldn't be fetched (network) — mark partial so
  // the user can re-download to fill the gaps.
  await setDownloadStatus(bookSlug, failed === 0 ? 'downloaded' : 'partial', total, success);

  return { success, failed, total, stopped: false };
}

export async function searchOnline(
  query: string,
  language: Language = 'en'
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const url = `${BASE_URL}/${language}/search/?text=${encodeURIComponent(query)}&format=json`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.results)) return data.results;
    return [];
  } catch {
    return [];
  }
}
