// Where things live in a book, for the desktop reading screens: chapter
// targets (prose books open a page, not a verse list), reference labels,
// breadcrumbs, and each chapter's real verse identifiers (combined verses like
// "16-18" included) for the contents sidebar and ← / → navigation.
import { useEffect, useState } from 'react';
import type { Href } from 'expo-router';
import { BookMeta } from '@/types';
import { isFlatBook, isChapterPageBook, isVanisourceBook, fetchChapterVerseList } from '@/services/vedabaseApi';
import { getChapterVerses } from '@/database/queries';
import { useSettingsStore } from '@/store/settingsStore';
import type { Crumb } from './ui';

export type FlatChapter = { canto?: number; chapter: number; title: string; verseCount: number; pageId?: string };

export function flatChapters(book: BookMeta): FlatChapter[] {
  if (book.hasCantos && book.cantos) {
    return book.cantos.flatMap((c) => c.chapters.map((ch) => ({ canto: c.number, chapter: ch.number, title: ch.title, verseCount: ch.verseCount })));
  }
  return (book.chapters ?? []).map((ch) => ({ chapter: ch.number, title: ch.title, verseCount: ch.verseCount, pageId: ch.pageId }));
}

/** Prose books: each chapter is one page (no verse list). */
export function isProseBook(book: BookMeta): boolean {
  return (isFlatBook(book.slug) && (book.chapters?.length ?? 0) > 1) || isChapterPageBook(book.slug) || isVanisourceBook(book.slug);
}

const verse = (book: string, chapter: number | string, v: string, canto?: number): Href => ({
  pathname: '/verse',
  params: { book, chapter: String(chapter), verse: v, canto: canto !== undefined ? String(canto) : '' },
});

/** Where opening a chapter from the contents goes — same rules as the phone's book screen. */
export function chapterHref(book: BookMeta, ch: FlatChapter): Href {
  if (ch.pageId) return verse(book.slug, 1, ch.pageId);
  if (isChapterPageBook(book.slug)) return verse(book.slug, ch.chapter, '', ch.canto);
  if (isFlatBook(book.slug) && (book.chapters?.length ?? 0) > 1) return verse(book.slug, 1, String(ch.chapter));
  return {
    pathname: '/chapter',
    params: { book: book.slug, chapter: String(ch.chapter), canto: ch.canto !== undefined ? String(ch.canto) : '' },
  };
}

export function verseHref(book: string, chapter: number, v: string, canto?: number): Href {
  return verse(book, chapter, v, canto);
}

const ABBR: Record<string, string> = { bg: 'Bg.', sb: 'ŚB', cc: 'CC', noi: 'NoI', iso: 'Śrī Īśo', bs: 'Bs.' };
const LILA = ['Ādi', 'Madhya', 'Antya'];

/** vedabase.io-style short reference: "Bg. 2.13", "ŚB 1.2.6", "CC Ādi 1.1". */
export function shortRef(book: BookMeta, chapter: number, v: string, canto?: number): string {
  if (book.slug === 'cc' && canto) return `CC ${LILA[canto - 1] ?? canto} ${chapter}.${v}`;
  const head = ABBR[book.slug] ?? book.title;
  if (isFlatBook(book.slug) && (book.chapters?.length ?? 0) <= 1) return `${head} ${v}`;
  return canto !== undefined ? `${head} ${canto}.${chapter}.${v}` : `${head} ${chapter}.${v}`;
}

export function cantoLabel(book: BookMeta, canto: number): string {
  const c = book.cantos?.find((x) => x.number === canto);
  if (book.slug === 'cc') return c?.title ?? `Līlā ${canto}`;
  if (book.slug === 'sb') return `Canto ${canto}`;
  return c?.title ?? `Part ${canto}`;
}

export function chapterMeta(book: BookMeta, chapter: number, canto?: number): FlatChapter | undefined {
  return flatChapters(book).find((c) => c.chapter === chapter && (canto === undefined || c.canto === canto));
}

/** Library › Book › [Canto] › Chapter … */
export function bookCrumbs(book: BookMeta, canto?: number, chapter?: number): Crumb[] {
  const out: Crumb[] = [
    { label: 'Library', href: '/library' },
    { label: book.title, href: { pathname: '/book/[slug]', params: { slug: book.slug } } },
  ];
  if (canto !== undefined && book.hasCantos) out.push({ label: cantoLabel(book, canto), href: { pathname: '/book/[slug]', params: { slug: book.slug, canto: String(canto) } } });
  if (chapter !== undefined && !isProseBook(book) && !(isFlatBook(book.slug) && (book.chapters?.length ?? 0) <= 1)) {
    out.push({
      label: `Chapter ${chapter}`,
      href: { pathname: '/chapter', params: { book: book.slug, chapter: String(chapter), canto: canto !== undefined ? String(canto) : '' } },
    });
  }
  return out;
}

const idCache = new Map<string, string[]>();
const orderOf = (v: string) => parseFloat(v) || 0;

/**
 * A chapter's verse identifiers in order ("1", "2", "16-18", …): the offline
 * copy first, then the chapter page, falling back to 1…verseCount.
 */
export function useVerseIds(book: BookMeta | undefined, chapter: number, canto: number | undefined, enabled = true): string[] {
  const language = useSettingsStore((s) => s.settings.language);
  const meta = book ? chapterMeta(book, chapter, canto) : undefined;
  const fallback = meta ? Array.from({ length: meta.verseCount }, (_, i) => String(i + 1)) : [];
  const key = `${book?.slug}/${canto ?? ''}/${chapter}/${language}`;
  const [ids, setIds] = useState<string[]>(idCache.get(key) ?? fallback);

  useEffect(() => {
    if (!book || !enabled) return;
    const hit = idCache.get(key);
    if (hit) { setIds(hit); return; }
    setIds(fallback);
    let cancelled = false;
    (async () => {
      const cached = await getChapterVerses(book.slug, chapter, canto, language).catch(() => []);
      if (cancelled) return;
      if (cached.length >= (meta?.verseCount ?? 1) * 0.6) {
        const list = cached.map((v) => v.verseRange || String(v.verse)).sort((a, b) => orderOf(a) - orderOf(b));
        setIds(list);
      }
      const remote = await fetchChapterVerseList(book.slug, chapter, canto, language).catch(() => [] as string[]);
      if (cancelled || !remote.length) return;
      idCache.set(key, remote);
      setIds(remote);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return ids;
}

/** Does verse id `id` ("16-18") contain verse number `n` ("17")? */
export function idContains(id: string, n: string): boolean {
  if (id === n) return true;
  const m = /^(\d+)-(\d+)$/.exec(id);
  const x = parseInt(n, 10);
  return !!m && !isNaN(x) && x >= parseInt(m[1], 10) && x <= parseInt(m[2], 10);
}
