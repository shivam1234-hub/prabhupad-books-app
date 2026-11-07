import { useState, useEffect, useCallback } from 'react';
import { Verse } from '@/types';
import {
  fetchVerse, fetchVerseDetailed, fetchChapterVerseList, fetchChapterTitle,
} from '@/services/vedabaseApi';
import { useSettingsStore } from '@/store/settingsStore';
import { getChapterVerses, getDownloadedChapters } from '@/database/queries';

/** Verse order within a chapter ("16-18" sorts as 16). */
const verseOrder = (v: Verse) => parseFloat(String(v.verse)) || 0;
const byVerse = (a: Verse, b: Verse) => verseOrder(a) - verseOrder(b);

// Resolve a chapter's display title. `fallback` is the title known from bundled
// book data — pass it only when it's a real title (BG, SB cantos 1–2), not a
// placeholder like "Chapter 5". When there's no real fallback, fetch the actual
// title (the chapter page <h1>) from vedabase; this covers SB cantos 3–12 and CC.
export function useChapterTitle(
  bookSlug: string,
  chapter: number,
  canto: number | undefined,
  fallback?: string,
) {
  const language = useSettingsStore((s) => s.settings.language);
  const [title, setTitle] = useState<string | null>(fallback ?? null);

  useEffect(() => {
    let cancelled = false;
    setTitle(fallback ?? null);
    if (fallback) return; // real title from bundled data — no network needed
    fetchChapterTitle(bookSlug, chapter, canto, language)
      .then((t) => { if (!cancelled && t) setTitle(t); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bookSlug, chapter, canto, language, fallback]);

  return title;
}

export function useVerse(bookSlug: string, chapter: number, verse: string, canto?: number) {
  const language = useSettingsStore((s) => s.settings.language);
  const [data, setData] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const v = await fetchVerse(bookSlug, chapter, verse, canto, language);
      setData(v);
      if (!v) setError('Could not load verse. Check your connection.');
    } catch {
      setError('Failed to load verse.');
    } finally {
      setLoading(false);
    }
  }, [bookSlug, chapter, verse, canto, language]);

  useEffect(() => { load(); }, [load]);

  return { verse: data, loading, error, refresh: load };
}

export function useChapterVerses(
  bookSlug: string,
  chapter: number,
  verseCount: number,
  canto?: number
) {
  const language = useSettingsStore((s) => s.settings.language);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [total, setTotal] = useState(verseCount);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVerses([]);
    setLoadedCount(0);
    setTotal(verseCount);
    setError(null);

    (async () => {
      // 1. The offline library first, at once. A chapter the downloader
      //    finished (download_chapters) is complete as it stands, so it needs
      //    no network at all — before, every chapter open waited on the
      //    vedabase.io chapter page (1–5 s online, up to ~30 s on a bad
      //    connection: two tries × 15 s timeout) before showing a cached verse.
      const [cached, doneChapters] = await Promise.all([
        getChapterVerses(bookSlug, chapter, canto, language).catch(() => [] as Verse[]),
        getDownloadedChapters(bookSlug, language).catch(() => new Map<string, number>()),
      ]);
      if (cancelled) return;
      const sortedCache = [...cached].sort(byVerse);
      if (sortedCache.length) {
        setVerses(sortedCache);
        setLoadedCount(sortedCache.length);
      }
      if (sortedCache.length && doneChapters.has(`${canto ?? 0}:${chapter}`)) {
        setTotal(sortedCache.length);
        setLoading(false);
        return;
      }

      // 2. Not fully downloaded: get the real verse identifiers from the
      // chapter page. This handles combined verses (e.g. BG 1.16-18) which
      // don't exist as 16/17/18 — a naive 1..N loop would hit 3 misses there
      // and give up mid-chapter. Cached verses stay on screen meanwhile.
      let verseIds = await fetchChapterVerseList(bookSlug, chapter, canto, language);
      if (cancelled) return;
      if (verseIds.length === 0) {
        // Chapter page unreachable — fall back to sequential numbering.
        verseIds = Array.from({ length: verseCount }, (_, i) => String(i + 1));
      } else {
        setTotal(verseIds.length);
      }

      const results: Verse[] = [];
      let consecutiveNetworkFails = 0;

      for (const vid of verseIds) {
        if (cancelled) break;

        const { verse, networkError } = await fetchVerseDetailed(bookSlug, chapter, vid, canto, language);

        if (verse) {
          consecutiveNetworkFails = 0;
          results.push(verse);
          if (!cancelled) {
            // Keep the cached verses not reached yet, so the list never
            // shrinks while it fills in.
            const have = new Set(results.map(r => r.id));
            const shown = [...results, ...sortedCache.filter(c => !have.has(c.id))].sort(byVerse);
            setVerses(shown);
            setLoadedCount(shown.length);
          }
        } else if (networkError) {
          // Real network problem — give up after 3 in a row so we don't hang.
          consecutiveNetworkFails++;
          if (consecutiveNetworkFails >= 3) {
            if (!cancelled) setError('network');
            break;
          }
        } else {
          // 404 / not a standalone verse (e.g. a combined-verse member when we
          // fell back to sequential numbering) — skip it, don't give up.
          consecutiveNetworkFails = 0;
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [bookSlug, chapter, verseCount, canto, language]);

  return { verses, loading, loadedCount, total, error };
}
