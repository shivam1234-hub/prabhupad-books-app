import { Citation, findCitations, fold, LibraryRef } from './citations';

/**
 * Every line of a purport, with where it comes from — and how we know.
 *
 * Śrīla Prabhupāda's purports stand on śāstra: he quotes verses, names
 * where they are from, translates them, and explains the verse on which he
 * is commenting. Each line gets the strongest link that can actually be
 * shown, and says which kind it is:
 *
 *   cited        he names the verse ("(Kaṭha Upaniṣad 2.2.13)", "Bg. 7.17")
 *   quote        a verse he quotes; its source is his reference beside it,
 *                or found by matching the Sanskrit in the library
 *   translation  his English for the verse he just quoted
 *   introduces   "… in the Śvetāśvatara Upaniṣad:" — leads into a quotation
 *   explains     his own explanation of the verse this purport belongs to;
 *                verses that say something similar are offered on request,
 *                marked as similar, never as his source
 *
 * Nothing here guesses a source: a similar verse is shown as similar.
 */

export type LineKind = 'prose' | 'verse' | 'reference';

export interface PurportLine {
  id: number;
  kind: LineKind;
  text: string;
  paragraph: number;
  citations: Citation[];
}

export type Evidence =
  | { kind: 'cited'; citations: Citation[] }
  | { kind: 'quote'; citation: Citation | null; from: 'his-reference' | 'library-match' | 'not-found'; found?: FoundVerse }
  | { kind: 'translation'; of: number }
  | { kind: 'introduces'; of: number }
  | { kind: 'explains' };

export interface FoundVerse {
  ref: LibraryRef;
  label: string;
  transliteration: string;
}

/** A source for a line found by studying the purport (not his own citation,
 * unless rel is 'his-citation'). */
export interface StudySource {
  rel: 'this' | 'restates' | 'refers' | 'identifies-quote' | 'his-citation';
  /** "Bhagavad-gītā 6.47", "Śaraṇāgati". */
  label: string;
  ref: LibraryRef | null;
  why: string;
  /** The words of that verse (or of this verse, for 'this'). */
  quote: string;
}

export interface MappedLine extends PurportLine {
  evidence: Evidence;
  /** Sources from the study of this purport, when there is one for this book. */
  study?: StudySource[];
}

const IAST = /[āīūṛṝḷṅñṭḍṇśṣṁḥĀĪŪṚṜḶṄÑṬḌṆŚṢṀḤ]/;
const ENGLISH = new Set(['the', 'and', 'of', 'is', 'to', 'in', 'that', 'this', 'he', 'it', 'which', 'are', 'by', 'with', 'for', 'as', 'be', 'one', 'not', 'his', 'who', 'was', 'from']);

/** A paragraph written as verse: its own lines, Sanskrit words, no English. */
function isVerseBlock(p: string): boolean {
  const words = p.split(/[\s\-–—,;:.!?’'“”"()]+/).filter(Boolean);
  if (words.length < 3) return false;
  const english = words.filter(w => ENGLISH.has(w.toLowerCase())).length;
  const sanskrit = words.filter(w => IAST.test(w)).length;
  const lines = p.split('\n').filter(l => l.trim()).length;
  return english / words.length < 0.06 && (lines >= 2 ? sanskrit / words.length > 0.15 : sanskrit / words.length > 0.4);
}

// Abbreviations a sentence doesn't end on.
const ABBR = /(?:^|[\s(])(bg|cc|sb|bhāg|bhag|brs|iso|noi|bs|ch|no|nos|vs|cf|viz|e\.g|i\.e|dr|mr|mrs|st|ft|vol|pp?|a\.c|madhya|ādi|antya|text|texts)\.$/i;

/** Sentences of a prose paragraph. */
function sentences(p: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?][”’"')]*\s+(?=[“"‘(]?[A-ZĀĪŪṚŚṢṬḌṆ])/g;
  for (const m of p.matchAll(re)) {
    const end = m.index! + m[0].trimEnd().length;
    const piece = p.slice(start, end);
    // "Bg." "i.e." "Śrī A.C." — not a sentence end.
    if (ABBR.test(piece.slice(-8)) || /\s[A-Z]\.$/.test(piece)) continue;
    out.push(piece.trim());
    start = m.index! + m[0].length;
  }
  const rest = p.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** The purport as lines: its verses whole, its prose sentence by sentence. */
export function segmentPurport(purport: string, inBook?: string): PurportLine[] {
  const lines: PurportLine[] = [];
  purport.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).forEach((p, paragraph) => {
    const add = (kind: LineKind, text: string) =>
      lines.push({ id: lines.length, kind, text, paragraph, citations: findCitations(text, inBook) });
    if (/^\([^()]+\)$/.test(p) && findCitations(p, inBook).length) add('reference', p);
    else if (isVerseBlock(p)) add('verse', p);
    else for (const s of sentences(p.replace(/\s*\n\s*/g, ' '))) add('prose', s);
  });
  return lines;
}

/**
 * The next verse of a cited range: "3.14–15" quoted as two blocks, the
 * second is 3.15. The first block then stands for 3.14 alone.
 */
function nextInRange(c: Citation): Citation | undefined {
  const m = c.number.match(/^(.*?)(\d+)(?:–(\d+))?$/);
  if (!m || !c.rangeTo) return undefined;
  const [, head, from] = m;
  const nextNo = Number(from) + 1;
  if (nextNo > c.rangeTo) return undefined;
  const number = `${head}${nextNo}`;
  const ref = c.ref ? { ...c.ref, verse: String(nextNo) } : null;
  return { ...c, number, label: `${c.work} ${number}`, ref, how: c.how };
}

/** Looks a quoted verse up in the library by its Sanskrit. */
export type QuoteFinder = (quote: string) => Promise<FoundVerse | null>;

/** What each line rests on. Only the quote lookups touch the library. */
export async function mapPurport(purport: string, inBook: string | undefined, findQuote: QuoteFinder): Promise<MappedLine[]> {
  const lines = segmentPurport(purport, inBook);
  const mapped: MappedLine[] = [];
  // A translation in quotation marks may run over several sentences, and
  // verses quoted together are translated one after another.
  let openTranslation: number | null = null;
  let depth = 0;
  let lastTranslated: number | null = null;
  for (const line of lines) {
    const prev = lines[line.id - 1];
    const next = lines[line.id + 1];
    let evidence: Evidence;
    if (line.kind === 'verse') {
      // His reference: in the block, in the "(…)" line after it, or at the
      // end of the sentence that leads into it ("… Upaniṣad:").
      // A second verse right after a cited one continues it: "verses 14
      // and 15" quoted as two blocks — the second is 15.
      const before = mapped[mapped.length - 1];
      const continued = before?.kind === 'verse' && before.evidence.kind === 'quote' && before.evidence.citation
        ? nextInRange(before.evidence.citation) : undefined;
      const citation = line.citations[0]
        ?? (next?.kind === 'reference' ? next.citations[0] : undefined)
        ?? (prev?.kind === 'prose' && /:\s*$/.test(prev.text) ? prev.citations[prev.citations.length - 1] : undefined)
        ?? continued
        ?? null;
      // The first block then stands for the first verse of the range alone.
      if (continued && citation === continued && before.evidence.kind === 'quote' && before.evidence.citation) {
        const c = before.evidence.citation;
        const first = c.number.replace(/–\d+$/, '');
        before.evidence = { ...before.evidence, citation: { ...c, number: first, label: `${c.work} ${first}`,
          ref: c.ref ? { ...c.ref, verse: c.ref.verse.replace(/-\d+$/, '') } : null } };
      }
      const found = await findQuote(line.text).catch(() => null);
      evidence = { kind: 'quote', citation, from: citation ? 'his-reference' : found ? 'library-match' : 'not-found', found: found ?? undefined };
    } else if (line.kind === 'reference') {
      evidence = { kind: 'cited', citations: line.citations };
    } else {
      // The quotation just before: its first block when several verses stand together.
      let q = mapped.length - 1;
      while (q >= 0 && mapped[q].kind === 'reference') q--;
      while (q > 0 && mapped[q - 1].kind === 'verse' && mapped[q].kind === 'verse') q--;
      const quoteBefore = q >= 0 ? mapped[q] : undefined;
      const prevMapped: MappedLine | undefined = mapped[mapped.length - 1];
      const nextOfRun: number | null = lastTranslated !== null && mapped[lastTranslated + 1]?.kind === 'verse' ? lastTranslated + 1 : null;
      const newParagraph = line.paragraph !== prev?.paragraph;
      if (openTranslation !== null && line.kind === 'prose' && newParagraph && /^“/.test(line.text)) {
        // A new paragraph re-opened with “ (the running-quote convention):
        // with verses quoted together, the next verse's translation.
        const nextVerse: number = mapped[openTranslation + 1]?.kind === 'verse' ? openTranslation + 1 : openTranslation;
        evidence = { kind: 'translation', of: nextVerse };
        depth = 0;
      } else if (openTranslation !== null && line.kind === 'prose') {
        evidence = { kind: 'translation', of: openTranslation };
      } else if (nextOfRun !== null && /^[“"]/.test(line.text) && prevMapped?.evidence.kind === 'translation') {
        // The next verse of the group, translated in turn.
        evidence = { kind: 'translation', of: nextOfRun };
      } else if (quoteBefore?.kind === 'verse' && /^[“"‘]/.test(line.text) && (prev?.kind === 'verse' || prev?.kind === 'reference')) {
        evidence = { kind: 'translation', of: quoteBefore.id };
      } else if (next?.kind === 'verse' && /:\s*$/.test(line.text)) {
        evidence = { kind: 'introduces', of: next.id };
      } else if (line.citations.length) {
        evidence = { kind: 'cited', citations: line.citations };
      } else {
        evidence = { kind: 'explains' };
      }
    }
    if (evidence.kind === 'translation') {
      // Open until its closing quotation mark.
      depth = (openTranslation === null ? 0 : depth) + (line.text.match(/“/g) ?? []).length - (line.text.match(/”/g) ?? []).length;
      openTranslation = depth > 0 ? evidence.of : null;
      lastTranslated = evidence.of;
    } else {
      openTranslation = null;
      depth = 0;
      if (line.kind !== 'verse') lastTranslated = null;
    }
    mapped.push({ ...line, evidence });
  }
  // A reference written after the translation — "(Cc. Ādi 17.164) Such
  // sacrifices …" — belongs to the quotation it follows.
  for (const m of mapped) {
    if (m.evidence.kind !== 'quote' || m.evidence.citation) continue;
    let j = m.id + 1;
    while (mapped[j] && (mapped[j].kind === 'verse' || mapped[j].evidence.kind === 'translation')) j++;
    const after = mapped[j];
    const c = after?.citations[0];
    if (c && c.start <= 1 && /^\(/.test(after.text)) {
      m.evidence = { ...m.evidence, citation: c, from: 'his-reference' };
    }
  }
  return mapped;
}

/** A quoted verse's first line, letters only, for matching in the library. */
export function quoteKey(quote: string): string[] {
  const first = quote.split('\n').map(l => l.trim()).find(Boolean) ?? quote;
  return fold(first).split(/[^a-z]+/).filter(Boolean);
}

export const lettersOnly = (s: string) => fold(s).replace(/[^a-z]/g, '');
