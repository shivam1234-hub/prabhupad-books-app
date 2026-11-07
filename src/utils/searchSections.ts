// Groups ranked search results by WHERE the query matched — shloka,
// translation or purport for the three verse-commentary scriptures, and one
// "other books" bucket for everything else — and prepares highlighted
// snippets. Everything comes from the cached per-verse analysis that ranking
// already computed (searchRelevance.analyzeVerse), so no text is re-scanned.
import { Verse } from '@/types';
import { analyzeVerse, FieldMatch, ScoredField } from '@/utils/searchRelevance';

export type HitField = 'phrase' | 'shloka' | 'translation' | 'purport' | 'other';

export interface TextRun {
  text: string;
  hit: boolean;
}

export interface SearchHit {
  verse: Verse;
  field: HitField;
  source: ScoredField; // which part of the verse the snippet comes from
  runs: TextRun[]; // snippet, split into plain / highlighted pieces
}

export interface SearchSection {
  key: HitField;
  title: string;
  hits: SearchHit[];
}

const SECTIONED_BOOKS = new Set(['bg', 'sb', 'cc']);

// Where to take an exact-phrase snippet from when it occurs in several fields.
const PHRASE_ORDER: ScoredField[] = ['translation', 'transliteration', 'purport', 'synonyms', 'devanagari'];

const SECTION_TITLES: Record<HitField, string> = {
  phrase: 'Exact phrase',
  shloka: 'Shloka matches',
  translation: 'Translation matches',
  purport: 'Purport matches',
  other: 'Other books',
};

// Same coverage rule as scoring: at least half of the query's terms.
function covers(m: FieldMatch | undefined): m is FieldMatch {
  if (!m) return false;
  const found = m.kinds.filter((k) => k > 0).length;
  return found > 0 && found / m.kinds.length >= 0.5;
}

// A window of `text` around its first highlighted word, ellipsised at
// whichever ends it cuts, as highlight runs.
// `focus` (an offset) centres the window there instead, e.g. on the phrase.
export function snippetRuns(text: string, spans: Array<[number, number]>, max = 200, focus = -1): TextRun[] {
  let start = 0;
  let end = text.length;
  if (text.length > max) {
    const first = focus >= 0 ? spans.find((sp) => sp[1] > focus) : spans[0];
    start = first ? Math.max(0, first[0] - Math.round(max * 0.3)) : 0;
    if (start > 0) {
      // Begin on a word boundary.
      const sp = text.indexOf(' ', start);
      if (sp !== -1 && sp < (first?.[0] ?? start + 20)) start = sp + 1;
    }
    end = Math.min(text.length, start + max);
    if (end < text.length) {
      const sp = text.lastIndexOf(' ', end);
      if (sp > start) end = sp;
    }
  }

  // Newlines/tabs -> spaces, one for one, so span offsets stay valid.
  const flat = (a: number, b: number) => text.slice(a, b).replace(/\s/g, ' ');
  const runs: TextRun[] = [];
  if (start > 0) runs.push({ text: '…', hit: false });
  let pos = start;
  for (const [s0, e0] of spans) {
    const s = Math.max(s0, start);
    const e = Math.min(e0, end);
    if (e <= s) continue;
    if (s > pos) runs.push({ text: flat(pos, s), hit: false });
    runs.push({ text: flat(s, e), hit: true });
    pos = e;
  }
  if (pos < end) runs.push({ text: flat(pos, end), hit: false });
  if (end < text.length) runs.push({ text: '…', hit: false });
  return runs;
}

// Bucket ranked verses into sections (relevance order is kept within each).
// A BG/SB/CC verse appears in every section whose field it matches, so e.g.
// all purport hits are listed even when the translation matched too.
export function groupSearchResults(verses: Verse[], terms: string[]): SearchSection[] {
  const buckets: Record<HitField, SearchHit[]> = { phrase: [], shloka: [], translation: [], purport: [], other: [] };
  const hit = (v: Verse, field: HitField, name: ScoredField, m: FieldMatch): SearchHit =>
    ({ verse: v, field, source: name, runs: snippetRuns(v[name]!, m.spans) });

  for (const v of verses) {
    const { fields } = analyzeVerse(v, terms);

    // Exact-phrase hits get their own top section (snippet centred on the
    // phrase) instead of appearing again in that field's section below.
    const phraseIn = PHRASE_ORDER.find((n) => (fields[n]?.phraseAt ?? -1) >= 0);
    if (phraseIn) {
      const m = fields[phraseIn]!;
      buckets.phrase.push({ verse: v, field: 'phrase', source: phraseIn, runs: snippetRuns(v[phraseIn]!, m.spans, 200, m.phraseAt) });
    }
    const shlokaPhrase = phraseIn === 'transliteration' || phraseIn === 'devanagari';

    if (SECTIONED_BOOKS.has(v.bookSlug)) {
      if (!shlokaPhrase) {
        if (covers(fields.transliteration)) buckets.shloka.push(hit(v, 'shloka', 'transliteration', fields.transliteration));
        else if (covers(fields.devanagari)) buckets.shloka.push(hit(v, 'shloka', 'devanagari', fields.devanagari));
      }
      if (phraseIn !== 'translation' && covers(fields.translation)) buckets.translation.push(hit(v, 'translation', 'translation', fields.translation));
      if (phraseIn !== 'purport' && covers(fields.purport)) buckets.purport.push(hit(v, 'purport', 'purport', fields.purport));
      continue;
    }
    if (phraseIn) continue;

    // Other books: show whichever field matched first, in reading priority.
    const order: ScoredField[] = ['translation', 'purport', 'transliteration', 'synonyms'];
    const name = order.find((n) => covers(fields[n]));
    if (name) {
      buckets.other.push(hit(v, 'other', name, fields[name]!));
    } else {
      const text = v.translation || v.purport;
      if (text) buckets.other.push({ verse: v, field: 'other', source: v.translation ? 'translation' : 'purport', runs: snippetRuns(text, []) });
    }
  }

  return (Object.keys(buckets) as HitField[])
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, title: SECTION_TITLES[k], hits: buckets[k] }));
}
