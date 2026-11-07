// Pure parsing + URL logic for vedabase.io pages — NO React Native / expo / DB
// imports, so it can be unit-tested directly with Node (see scripts/test-books.ts).
// vedabaseApi.ts wires these together with the network + cache layer.
import type { ApiVerseResponse, Language } from '@/types';

export const BASE_URL = 'https://vedabase.io';

// Caitanya-caritāmṛta uses lila names in the URL, not a canto number:
// canto 1/2/3 → /cc/adi|madhya|antya/chapter/verse/
const CC_LILAS = ['adi', 'madhya', 'antya'];

// "Flat" books have their texts/chapters directly under the book — no
// chapter→verse level: /iso/1/, /kb/12/. (Modeled as a single chapter in
// books.ts so the chapter screen lists every page.)
const FLAT_BOOKS = new Set([
  'iso', 'noi', 'nod', 'kb', 'ssr', 'tlc', 'bbd', 'rv', 'pqpa', 'tlk', 'tqk', 'lob',
]);

export function isFlatBook(slug: string): boolean {
  return FLAT_BOOKS.has(slug);
}

// "Chapter-page" books are prose with a volume→chapter hierarchy where each
// chapter IS a single page (no verse level): /spl/{volume}/{chapter}/,
// /rkd/{part}/{chapter}/.
const CHAPTER_PAGE_BOOKS = new Set(['spl', 'rkd']);

export function isChapterPageBook(slug: string): boolean {
  return CHAPTER_PAGE_BOOKS.has(slug);
}

// Maps a numeric canto to the URL segment for that book (lila name for CC).
function cantoSegment(bookSlug: string, canto: number): string {
  if (bookSlug === 'cc') return CC_LILAS[canto - 1] ?? String(canto);
  return String(canto);
}

export function buildVerseUrl(
  bookSlug: string,
  chapter: number,
  verse: string,
  canto?: number | null,
  language: Language = 'en'
): string {
  const base = `${BASE_URL}/${language}/library/${bookSlug}`;
  // Named front-matter pages (introduction, preface, foreword…) live at book root.
  if (/^[a-z]/i.test(verse)) {
    return `${base}/${verse}/`;
  }
  // Chapter-page books (e.g. Līlāmṛta): the chapter itself is the page.
  if (CHAPTER_PAGE_BOOKS.has(bookSlug)) {
    return canto != null ? `${base}/${canto}/${chapter}/` : `${base}/${chapter}/`;
  }
  if (FLAT_BOOKS.has(bookSlug)) {
    return `${base}/${verse}/`;
  }
  if (canto != null) {
    return `${base}/${cantoSegment(bookSlug, canto)}/${chapter}/${verse}/`;
  }
  return `${base}/${chapter}/${verse}/`;
}

export function buildChapterUrl(
  bookSlug: string,
  chapter: number,
  canto?: number | null,
  language: Language = 'en'
): string {
  const base = `${BASE_URL}/${language}/library/${bookSlug}`;
  if (FLAT_BOOKS.has(bookSlug)) {
    // Verses are listed on the book's root page.
    return `${base}/`;
  }
  if (canto != null) {
    return `${base}/${cantoSegment(bookSlug, canto)}/${chapter}/`;
  }
  return `${base}/${chapter}/`;
}

// The regex that extracts verse identifiers (including combined-verse ranges)
// from a chapter/list page, matching the same per-book URL scheme as buildVerseUrl.
export function chapterListPattern(
  bookSlug: string,
  chapter: number,
  canto?: number | null,
  language: Language = 'en'
): RegExp {
  const lib = `/${language}/library/${bookSlug}`;
  if (FLAT_BOOKS.has(bookSlug)) {
    return new RegExp(`${lib}/(\\d+(?:-\\d+)?)/`, 'g');
  }
  if (canto != null) {
    return new RegExp(`${lib}/${cantoSegment(bookSlug, canto)}/${chapter}/(\\d+(?:-\\d+)?)/`, 'g');
  }
  return new RegExp(`${lib}/${chapter}/(\\d+(?:-\\d+)?)/`, 'g');
}

// Extract the verse identifiers from a chapter/list page's HTML.
export function extractVerseList(
  html: string,
  bookSlug: string,
  chapter: number,
  canto?: number | null,
  language: Language = 'en'
): string[] {
  const pattern = chapterListPattern(bookSlug, chapter, canto, language);
  const verses = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) verses.add(m[1]);
  return Array.from(verses);
}

// Extract the chapter title from a chapter/list page. On vedabase every chapter
// page renders its title as the sole <h1> (e.g. "Observing the Armies on the
// Battlefield of Kurukṣetra"); the <title> tag only holds "Chapter One".
export function extractChapterTitle(html: string): string | null {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!m) return null;
  const title = stripHtml(m[1]);
  return title || null;
}

// Detect Cloudflare / bot-challenge / empty pages.
export function isChallengeOrEmpty(html: string): boolean {
  return html.includes('cf-browser-verification') || html.includes('Just a moment') || html.length < 500;
}

// Decode RSC stream chunks embedded as self.__next_f.push([1,"..."]) in Next.js pages
function decodeRscChunks(html: string): string {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      parts.push(JSON.parse('"' + m[1] + '"'));
    } catch {
      parts.push(m[1]);
    }
  }
  return parts.join('');
}

// Extract a balanced JSON array/object starting at `start` index
function extractJsonBlock(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Read `byteLen` UTF-8 bytes starting at `start` (RSC rows are length-prefixed,
// not newline-delimited, and content holds multibyte Sanskrit diacritics).
function sliceByUtf8Bytes(text: string, start: number, byteLen: number): string {
  let bytes = 0;
  let i = start;
  while (i < text.length && bytes < byteLen) {
    const cp = text.codePointAt(i)!;
    bytes += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
    i += cp > 0xffff ? 2 : 1;
  }
  return text.slice(start, i);
}

// Next.js streams long strings as separate rows (`28:T45b,<content>`) and puts a
// reference (`"$28"`) in the field. Resolve such refs against the decoded stream.
// Returns '' for refs that don't point at a text row (e.g. element refs like $L1d).
function resolveRscRef(text: string, value: unknown): string {
  if (typeof value !== 'string') return '';
  const ref = /^\$([0-9a-f]+)$/.exec(value);
  if (!ref) return value;
  const id = ref[1];
  // T-form: length-prefixed text row.
  const t = new RegExp(`(?:^|[^0-9a-z$])${id}:T([0-9a-f]+),`).exec(text);
  if (t) {
    return sliceByUtf8Bytes(text, t.index + t[0].length, parseInt(t[1], 16));
  }
  // Quote-form: short JSON-string row.
  const q = new RegExp(`(?:^|[^0-9a-z$])${id}:"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
  if (q) {
    try { return JSON.parse('"' + q[1] + '"'); } catch { return q[1]; }
  }
  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// For a combined verse id like "16-18", return the per-sloka numbers
// ["16","17","18"] when the count matches the number of text blocks; otherwise
// null (so we don't mislabel an unexpected split).
function slokaNumbersFor(verseId: string | undefined, count: number): string[] | null {
  if (!verseId || count < 2) return null;
  const m = /^(\d+)-(\d+)$/.exec(verseId);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const end = parseInt(m[2], 10);
  if (end - start + 1 !== count) return null;
  return Array.from({ length: count }, (_, i) => String(start + i));
}

export function parseVerseFromRsc(html: string, verseId?: string): Partial<ApiVerseResponse> | null {
  const text = decodeRscChunks(html);
  const marker = '"child_items":[';
  const idx = text.indexOf(marker);
  if (idx < 0) return null;

  const jsonBlock = extractJsonBlock(text, idx + marker.length - 1);
  if (!jsonBlock) return null;

  let childItems: any[];
  try {
    childItems = JSON.parse(jsonBlock);
  } catch {
    return null;
  }

  // Resolve a field value, following any `$NN` stream reference.
  const deref = (v: unknown) => stripHtml(resolveRscRef(text, v ?? ''));

  // Combined verses (e.g. bg 1.21-22) split a section across MULTIPLE children —
  // one per sloka. Join them all, not just the first, or the transliteration /
  // devanagari / synonyms come out truncated.
  const joinChildren = (children: any[], key: string, sep: string) =>
    children.map((c: any) => deref(c?.[key])).filter(Boolean).join(sep);

  const result: Partial<ApiVerseResponse> = {};
  for (const section of childItems) {
    const children: any[] = section.children || [];
    switch (section.section) {
      case 'devanagari':
        result.devanagari = joinChildren(children, 'body_final', '\n');
        break;
      case 'verse_text': {
        // Keep each sloka as its own block; for combined verses, separate them
        // with a blank line and label with the verse number so they're distinct.
        const blocks = children.map((c: any) => deref(c?.body_value)).filter(Boolean);
        const nums = slokaNumbersFor(verseId, blocks.length);
        result.verse_text = nums
          ? blocks.map((b, i) => `TEXT ${nums[i]}\n${b}`).join('\n\n')
          : blocks.join(blocks.length > 1 ? '\n\n' : '\n');
        break;
      }
      case 'synonyms':
        result.synonyms = joinChildren(children, 'shadow_value', ' ');
        break;
      case 'translation':
        result.translation = joinChildren(children, 'body_value', ' ');
        break;
      case 'purport':
        result.purport = joinChildren(children, 'body_value', '\n\n');
        break;
    }
  }

  // Prose pages (Kṛṣṇa Book, Teachings of Lord Caitanya, Perfect Questions…,
  // etc.) have no verse sections — their text lives in a "before-verses" section
  // of paragraphs/headers. Surface it as the page body so the chapter reads.
  if (Object.keys(result).length === 0) {
    const prose = childItems.find((s: any) => s.section === 'before-verses');
    if (prose) {
      const body = joinChildren(prose.children || [], 'body_value', '\n\n');
      if (body) result.translation = body;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
