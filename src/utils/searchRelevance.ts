// Google-style ranking for free-text verse search: broader recall (typo
// tolerance) than a strict substring AND-match, but exact/whole-word hits in
// the fields readers care about most (translation) still rank far above a
// fuzzy hit buried in a purport. Shared by both the native (post-FTS rerank)
// and web (direct scan) search paths so results are consistent across
// platforms.
//
// Speed: every field is folded once (foldIndexed, a lookup table rather than
// String.normalize) and scanned once with an Aho–Corasick automaton for ALL
// query terms together. The resulting per-verse analysis — term hits plus the
// word spans to highlight — is cached, so grouping results into sections and
// highlighting them afterwards costs nothing extra.
import { AhoCorasick } from '@/utils/ahoCorasick';
import { foldIndexed, withinEditDistance } from '@/utils/searchMatch';

export interface ScorableVerse {
  translation?: string;
  synonyms?: string;
  transliteration?: string;
  purport?: string;
  devanagari?: string;
}

export type ScoredField = keyof ScorableVerse;

// How much a hit in each field is worth — translation is what a reader is
// almost always looking for; purport is the largest field by far and would
// otherwise dominate matches purely on volume.
const FIELD_WEIGHTS: Record<ScoredField, number> = {
  translation: 12,
  synonyms: 6,
  transliteration: 6,
  devanagari: 2,
  purport: 3,
};
const FIELDS = Object.keys(FIELD_WEIGHTS) as ScoredField[];

// Multiplier applied on top of a field's weight depending on how a term
// matched within that field — an exact whole word beats a same-word prefix,
// which beats a mid-word substring, which beats a typo-tolerant fuzzy hit.
const EXACT_WORD = 1;
const PREFIX_WORD = 0.7;
const SUBSTRING = 0.45;
const FUZZY_WORD = 0.3;

// Typos allowed per word. Stricter than the book-name matcher's
// fuzzyThreshold: Sanskrit is full of short look-alikes, and 2 typos on a
// 5-letter word let "bhaya" match bhavān, bhago, bhīma and bhāgam.
function typoBudget(len: number): number {
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

// A multi-word query found as a phrase (same words, same order, only spaces or
// punctuation between) outranks any verse that merely contains the words.
const PHRASE_BONUS = 1000;

export interface FieldMatch {
  // Best match multiplier per query term (0 = term not found in this field).
  kinds: number[];
  // Whole words to highlight, [start, end) in the ORIGINAL text, sorted.
  spans: Array<[number, number]>;
  // Original-text start of the first exact-phrase occurrence, or -1.
  phraseAt: number;
}

export interface VerseAnalysis {
  fields: Partial<Record<ScoredField, FieldMatch>>;
  score: number;
  coverage: number; // share of query terms found anywhere in the verse
}

// Word characters after folding: ASCII letters/digits and anything non-ASCII
// (IAST, Devanagari letters and vowel signs) except common punctuation.
function isWordChar(c: number): boolean {
  if (c < 128) return (c >= 97 && c <= 122) || (c >= 48 && c <= 57);
  return !(
    c === 0xa0 || c === 0xab || c === 0xbb || c === 0xb7 ||
    (c >= 0x2000 && c <= 0x206f) || // general punctuation: ‘ ’ “ ” – — … etc.
    c === 0x0964 || c === 0x0965 // Devanagari danda / double danda
  );
}

interface Query {
  key: string;
  terms: string[];
  ac: AhoCorasick;
}

let lastQuery: Query | null = null;
function compile(terms: string[]): Query {
  const key = terms.join('\u0001');
  if (lastQuery?.key !== key) lastQuery = { key, terms, ac: new AhoCorasick(terms) };
  return lastQuery;
}

function analyzeField(text: string, q: Query, allowFuzzy: boolean): FieldMatch | undefined {
  const { text: f, map } = foldIndexed(text);
  const kinds = new Array<number>(q.terms.length).fill(0);
  const folded: Array<[number, number]> = [];
  // Word-start positions of each term — for phrase detection.
  const starts = q.terms.map(() => new Set<number>());

  const addWord = (s: number, e: number) => {
    while (s > 0 && isWordChar(f.charCodeAt(s - 1))) s--;
    while (e < f.length && isWordChar(f.charCodeAt(e))) e++;
    folded.push([s, e]);
  };

  q.ac.scan(f, (p, s, e) => {
    const atStart = s === 0 || !isWordChar(f.charCodeAt(s - 1));
    const atEnd = e === f.length || !isWordChar(f.charCodeAt(e));
    const kind = atStart && atEnd ? EXACT_WORD : atStart ? PREFIX_WORD : SUBSTRING;
    if (kind > kinds[p]) kinds[p] = kind;
    if (atStart) starts[p].add(s);
    // 3+ letter terms highlight wherever they hit; 1–2 letter ones only as
    // whole words, so "is" doesn't light up "this" nor "so" "sophisticated".
    if (q.terms[p].length >= 3 || (atStart && atEnd)) addWord(s, e);
  });

  // Typo-tolerant fallback for terms not found verbatim. It's O(words) edit
  // distances, so only for the shorter fields — never the purport.
  if (allowFuzzy && q.terms.some((t, i) => kinds[i] === 0 && t.length >= 4)) {
    for (let i = 0; i < f.length; ) {
      while (i < f.length && !isWordChar(f.charCodeAt(i))) i++;
      const s = i;
      while (i < f.length && isWordChar(f.charCodeAt(i))) i++;
      if (i === s) continue;
      const word = f.slice(s, i);
      q.terms.forEach((t, ti) => {
        if (kinds[ti] !== 0 && kinds[ti] !== FUZZY_WORD) return;
        if (t.length < 4) return;
        if (!withinEditDistance(t, word, typoBudget(t.length))) return;
        kinds[ti] = FUZZY_WORD;
        folded.push([s, i]);
      });
    }
  }

  // Exact phrase: each next term starts right after the previous one, with
  // 1–3 separator chars between ("so-called scholars", "so called scholars").
  // Middle terms must be whole words; the last may be a prefix (still typing).
  let phraseFolded = -1;
  if (q.terms.length >= 2) {
    for (const s0 of starts[0]) {
      let pos = s0 + q.terms[0].length;
      let ok = true;
      for (let t = 1; t < q.terms.length && ok; t++) {
        let g = pos;
        while (g < f.length && g - pos < 3 && !isWordChar(f.charCodeAt(g))) g++;
        if (g === pos || !starts[t].has(g)) ok = false;
        else pos = g + q.terms[t].length;
      }
      if (!ok) continue;
      if (phraseFolded < 0 || s0 < phraseFolded) phraseFolded = s0;
      addWord(s0, pos); // one highlight across the whole phrase
    }
  }

  // A field can match without anything to highlight ("is" inside "this").
  if (folded.length === 0 && !kinds.some((k) => k > 0)) return undefined;

  // Folded -> original coordinates, then sort and merge duplicates/overlaps.
  const spans = folded
    .map(([s, e]): [number, number] => (map ? [map[s], map[e - 1] + 1] : [s, e]))
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    // Overlapping, or joined only by hyphens ("so" + "called" -> "so-called").
    if (last && (sp[0] <= last[1] || /^-+$/.test(text.slice(last[1], sp[0])))) {
      last[1] = Math.max(last[1], sp[1]);
    } else merged.push(sp);
  }
  const phraseAt = phraseFolded < 0 ? -1 : map ? map[phraseFolded] : phraseFolded;
  return { kinds, spans: merged, phraseAt };
}

const cache = new WeakMap<object, { key: string; a: VerseAnalysis }>();

// Analyse (or fetch the cached analysis of) a verse for these query terms.
export function analyzeVerse(verse: ScorableVerse, terms: string[]): VerseAnalysis {
  const q = compile(terms);
  const hit = cache.get(verse);
  if (hit && hit.key === q.key) return hit.a;

  const fields: VerseAnalysis['fields'] = {};
  for (const name of FIELDS) {
    const text = verse[name];
    if (text) fields[name] = analyzeField(text, q, name !== 'purport');
  }

  // Each term counts once, at its best field; fewer than half the terms
  // matching anywhere excludes the verse — keeps single-typo multi-word
  // queries working (AND-ish) without requiring literally every term.
  let total = 0;
  let matchedTerms = 0;
  for (let i = 0; i < terms.length; i++) {
    let best = 0;
    for (const name of FIELDS) {
      const m = fields[name];
      if (m && m.kinds[i] * FIELD_WEIGHTS[name] > best) best = m.kinds[i] * FIELD_WEIGHTS[name];
    }
    if (best > 0) matchedTerms++;
    total += best;
  }
  const coverage = terms.length ? matchedTerms / terms.length : 0;
  // Square the coverage so full-coverage matches pull well clear of partial
  // ones instead of just edging ahead of them.
  let score = coverage < 0.5 ? 0 : total * coverage * coverage;

  // Exact-phrase verses go first, a phrase in the translation above one in
  // the purport.
  let phraseWeight = 0;
  for (const name of FIELDS) {
    if ((fields[name]?.phraseAt ?? -1) >= 0) phraseWeight = Math.max(phraseWeight, FIELD_WEIGHTS[name]);
  }
  if (phraseWeight > 0) score += PHRASE_BONUS + phraseWeight * 10;

  const a = { fields, score, coverage };
  cache.set(verse, { key: q.key, a });
  return a;
}

export function scoreVerse(verse: ScorableVerse, terms: string[]): number {
  if (terms.length === 0) return 0;
  return analyzeVerse(verse, terms).score;
}

// Score, filter (score > 0), and sort a batch of verses by relevance — the
// shared tail end of both the native (post-FTS rerank) and web (full scan)
// search paths. When some verse contains EVERY term, verses with only some
// of them are dropped; otherwise the partial matches are all there is (see
// isPartialResult).
export function rankVerses<T extends ScorableVerse>(verses: T[], terms: string[]): T[] {
  const scored = verses
    .map((v) => ({ v, a: terms.length ? analyzeVerse(v, terms) : null }))
    .filter((r): r is { v: T; a: VerseAnalysis } => !!r.a && r.a.score > 0);
  const anyFull = scored.some((r) => r.a.coverage === 1);
  return scored
    .filter((r) => !anyFull || r.a.coverage === 1)
    .sort((a, b) => b.a.score - a.a.score)
    .map((r) => r.v);
}

// True when ranked results are only partial matches — no verse had every term.
export function isPartialResult(ranked: ScorableVerse[], terms: string[]): boolean {
  return terms.length > 1 && ranked.length > 0 && analyzeVerse(ranked[0], terms).coverage < 1;
}
