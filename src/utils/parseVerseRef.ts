import { BOOKS } from '@/constants/books';
import { editDistance, fuzzyThreshold } from '@/utils/searchMatch';

export interface VerseRef {
  bookSlug: string;
  canto?: number;
  chapter: number;
  verse: string;
  label: string; // human-readable e.g. "Bhagavad-gītā 1.1"
  /** Other plausible readings of the same numbers, when genuinely ambiguous. */
  alternates?: VerseRef[];
}

// Longest aliases first so "srimad bhagavatam" matches before "sb"
const ALIASES: Array<[string, string]> = [
  ['bhagavad-gita as it is', 'bg'],
  ['bhagavad gita as it is', 'bg'],
  ['bhagavad-gita', 'bg'],
  ['bhagavad gita', 'bg'],
  ['bhagavadgita', 'bg'],
  ['srimad-bhagavatam', 'sb'],
  ['srimad bhagavatam', 'sb'],
  ['srimadbhagavatam', 'sb'],
  ['chaitanya charitamrita', 'cc'],
  ['chaitanya-charitamrita', 'cc'],
  ['nectar of instruction', 'noi'],
  ['nectar of devotion', 'nod'],
  ['krishna book', 'kb'],
  ['isopanisad', 'iso'],
  ['isopanishad', 'iso'],
  ['bhagavatam', 'sb'],
  ['charitamrita', 'cc'],
  ['chaitanya', 'cc'],
  ['gita', 'bg'],
  ['bg', 'bg'],
  ['sb', 'sb'],
  ['cc', 'cc'],
  ['noi', 'noi'],
  ['nod', 'nod'],
  ['iso', 'iso'],
  ['kb', 'kb'],
  ['ssr', 'ssr'],
  ['tlc', 'tlc'],
  ['bs', 'bs'],
];

// Books that use canto.chapter.verse addressing
const CANTO_BOOKS = new Set(['sb', 'cc']);

// When the user types bare numbers with no book name at all, guess the book
// from how many number groups they gave — chapter.verse almost always means
// the Gita (the most-read, most-referenced book by far), and canto.chapter.verse
// almost always means the Bhāgavatam. Both are just a best first guess: any other
// book(s) for which the same numbers are also a real, in-range reference are
// surfaced as alternates rather than silently dropped.
const BARE_NUMBER_DEFAULT: Record<number, string> = { 2: 'bg', 3: 'sb' };
const BARE_NUMBER_ALT_CANDIDATES: Record<number, string[]> = { 3: ['cc'] };

function getBook(bookSlug: string) {
  return BOOKS.find((b) => b.slug === bookSlug);
}

// Chapter/canto counts in BOOKS are real vedabase structure; per-chapter verse
// counts for some books (e.g. SB cantos 3-12) are uniform placeholders, not
// exact per-chapter data. So we validate chapter/canto existence strictly, but
// only sanity-cap the verse number itself generously — real chapters in this
// corpus never exceed ~90 verses, so anything past 200 is certainly bogus, but
// we don't want placeholder inaccuracy to reject genuine, in-range verses.
const MAX_PLAUSIBLE_VERSE = 200;

function isPlausibleRef(bookSlug: string, chapter: number, canto: number | undefined, verseNums: number[]): boolean {
  const book = getBook(bookSlug);
  if (!book) return false;
  if (book.hasCantos && book.cantos) {
    if (canto === undefined) return false;
    const c = book.cantos.find((c) => c.number === canto);
    if (!c || !c.chapters.some((ch) => ch.number === chapter)) return false;
  } else {
    if (canto !== undefined) return false;
    if (!(book.chapters || []).some((ch) => ch.number === chapter)) return false;
  }
  return verseNums.every((v) => v >= 1 && v <= MAX_PLAUSIBLE_VERSE);
}

// Best fuzzy alias match for a typo'd book name/abbreviation (e.g. "bhagvad
// gita", "srimad bhagwatam", "gtia"). Only called after the exact startsWith
// pass fails, so it never overrides a real exact match.
function findAliasFuzzy(phrase: string): string | null {
  if (phrase.length < 3) return null;
  let best: { slug: string; dist: number } | null = null;
  for (const [alias, slug] of ALIASES) {
    if (Math.abs(alias.length - phrase.length) > 3) continue;
    const dist = editDistance(alias, phrase);
    if (dist <= fuzzyThreshold(alias.length) && (!best || dist < best.dist)) {
      best = { slug, dist };
    }
  }
  return best?.slug ?? null;
}

function buildLabel(bookSlug: string, canto: number | undefined, chapter: number, verse: string): string {
  const book = getBook(bookSlug);
  return canto !== undefined
    ? `${book?.title ?? bookSlug} ${canto}.${chapter}.${verse}`
    : `${book?.title ?? bookSlug} ${chapter}.${verse}`;
}

// Parses the numeric tail ("1.1", "1 1", "1.1.1", "1-1-1", "11.19.36-39", …)
// into address numbers plus an optional combined-verse range, honoring
// whichever book's addressing scheme (canto.chapter.verse vs chapter.verse)
// applies. Returns null if the numbers don't parse into a plausible verse ref
// for that book.
// "ādi 1.1" / "madhya-lila 20.108" / "antya 5.1" → "1 1.1" etc.: the
// Caitanya-caritāmṛta's līlā names stand for its first number.
const LILAS: Array<[RegExp, string]> = [
  [/^adi(?:[\s-]*lila)?\b[\s.:,]*/, '1 '],
  [/^madhya(?:[\s-]*lila)?\b[\s.:,]*/, '2 '],
  [/^antya(?:[\s-]*lila)?\b[\s.:,]*/, '3 '],
];

/** Lowercase and drop diacritics, so "Cc. Ādi", "Gītā" and "kṛṣṇa" match
 *  what people type on an English keyboard. */
export function foldRef(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function resolveNumbers(rest: string, bookSlug: string): { canto?: number; chapter: number; verse: string } | null {
  const hasCantos = CANTO_BOOKS.has(bookSlug);
  if (bookSlug === 'cc') for (const [re, n] of LILAS) rest = rest.replace(re, n);

  // Books that are a single chapter of texts (Īśopaniṣad, Nectar of
  // Instruction): "iso 5" means mantra 5.
  const book = getBook(bookSlug);
  if (!hasCantos && /^\d+(-\d+)?$/.test(rest.trim()) && (book?.chapters?.length ?? 0) === 1) {
    rest = `${book!.chapters![0].number}.${rest.trim()}`;
  }

  // A trailing "a-b" is a combined-verse range (e.g. sb 11.19.36-39); keep it
  // intact rather than splitting on the hyphen, so the reference resolves to
  // the real combined-verse page instead of a non-existent standalone verse.
  const rangeMatch = rest.match(/(\d+)-(\d+)\s*$/);
  const parts = rest.split(/[\s.\-,]+/).filter(Boolean);
  const nums = parts.map(Number);

  if (nums.length < 2 || nums.some((n) => isNaN(n) || n < 1)) return null;

  let canto: number | undefined;
  let chapter: number;
  let verse: string;

  const addr = rangeMatch ? nums.slice(0, -2) : nums;
  const useRange = !!rangeMatch && (hasCantos ? addr.length >= 2 : addr.length >= 1);

  if (useRange) {
    if (hasCantos) [canto, chapter] = [addr[0], addr[1]];
    else chapter = addr[0];
    verse = `${rangeMatch![1]}-${rangeMatch![2]}`;
  } else if (hasCantos && nums.length >= 3) {
    [canto, chapter] = [nums[0], nums[1]];
    verse = String(nums[2]);
  } else if (!hasCantos && nums.length === 2) {
    chapter = nums[0];
    verse = String(nums[1]);
  } else {
    return null; // e.g. only 2 numbers given for a canto book with no explicit canto
  }

  const verseNums = verse.includes('-') ? verse.split('-').map(Number) : [Number(verse)];
  if (!isPlausibleRef(bookSlug, chapter, canto, verseNums)) return null;

  return { canto, chapter, verse };
}

// How many address "slots" the bare numbers represent — a trailing a-b range
// is one verse slot, not two, so "11.19.36-39" counts as 3 (canto, chapter,
// verse-range), matching how resolveNumbers itself treats it.
function logicalGroupCount(q: string): number {
  const rangeMatch = q.match(/(\d+)-(\d+)\s*$/);
  const nums = q.split(/[.\-\s,]+/).filter(Boolean);
  return rangeMatch ? nums.length - 1 : nums.length;
}

function bareNumericRef(q: string): VerseRef | null {
  if (!/^\d+([.\-\s,]+\d+)*$/.test(q)) return null;
  // "1-1-1" (three or more groups joined only by hyphens) is an address
  // like "1.1.1", not chapter 1 + verses 1-1.
  if (/^\d+(-\d+){2,}$/.test(q)) q = q.replace(/-/g, '.');

  const groupCount = logicalGroupCount(q);
  const defaultSlug = BARE_NUMBER_DEFAULT[groupCount];
  if (!defaultSlug) return null;

  const primary = resolveNumbers(q, defaultSlug);
  if (!primary) return null;

  const alternates: VerseRef[] = [];
  for (const altSlug of BARE_NUMBER_ALT_CANDIDATES[groupCount] ?? []) {
    const alt = resolveNumbers(q, altSlug);
    if (alt) {
      alternates.push({ bookSlug: altSlug, ...alt, label: buildLabel(altSlug, alt.canto, alt.chapter, alt.verse) });
    }
  }

  return {
    bookSlug: defaultSlug,
    ...primary,
    label: buildLabel(defaultSlug, primary.canto, primary.chapter, primary.verse),
    ...(alternates.length ? { alternates } : {}),
  };
}

// Typo-tolerant match against the book-name phrase before the first digit
// ("bhagvad gita 2.47", "srimad bhagwatam 1.1.1", "chaitanya charitamrta
// 1.1.1"). Compares the WHOLE phrase, not just whatever an exact prefix
// match happened to consume — a short alias like "chaitanya" can be a true
// prefix of the input while the rest of the phrase still has a typo, so this
// is tried whenever the exact-prefix fast path doesn't fully resolve.
function fuzzyBookRef(q: string): VerseRef | null {
  const digitIdx = q.search(/\d/);
  if (digitIdx <= 0) return null;
  const phrase = q.slice(0, digitIdx).trim().replace(/[.\-:,\s]+$/, '');
  const fuzzySlug = findAliasFuzzy(phrase);
  if (!fuzzySlug) return null;
  const rest = q.slice(digitIdx).trim();
  const resolved = resolveNumbers(rest, fuzzySlug);
  if (!resolved) return null;
  return { bookSlug: fuzzySlug, ...resolved, label: buildLabel(fuzzySlug, resolved.canto, resolved.chapter, resolved.verse) };
}

export function parseVerseRef(input: string): VerseRef | null {
  if (!input || input.trim().length < 3) return null;

  // Normalise: lowercase, collapse whitespace, remove leading/trailing junk
  const q = foldRef(input.trim()).replace(/\s+/g, ' ');

  // Fast path: an exact alias prefix whose remainder parses cleanly as numbers.
  for (const [alias, slug] of ALIASES) {
    if (q.startsWith(alias)) {
      const rest = q.slice(alias.length).trim().replace(/^[.\-:,\s]+/, '');
      const resolved = resolveNumbers(rest, slug);
      if (resolved) {
        return { bookSlug: slug, ...resolved, label: buildLabel(slug, resolved.canto, resolved.chapter, resolved.verse) };
      }
      break; // matched but didn't resolve — fall through to the fuzzy paths below
    }
  }

  // Bare numbers, no book name at all ("1.2", "1.1.1").
  const bare = bareNumericRef(q);
  if (bare) return bare;

  // A book name is present but didn't cleanly resolve above — try a
  // typo-tolerant match against the whole phrase before the numbers.
  return fuzzyBookRef(q);
}

/**
 * Find all books whose title/slug partially matches the query.
 * Used when no verse number is given (e.g. user types just "gita").
 */
export function findMatchingBooks(input: string) {
  // Diacritics folded on both sides: "gita" finds "Bhagavad-gītā".
  const q = foldRef(input.trim());
  return BOOKS.filter(
    (b) =>
      b.slug.includes(q) ||
      foldRef(b.title).includes(q) ||
      foldRef(b.subtitle ?? '').includes(q)
  );
}
