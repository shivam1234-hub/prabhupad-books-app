import { DictionaryName, loadDictionaryText } from './dictionaryLoader';
import { lookupGlossary, GlossaryEntry } from '@/constants/sanskritGlossary';
import { getSynonymCandidates, SynonymRow } from '@/database/queries';
import { parseSynonyms } from '@/utils/parseSynonyms';
import { Verse } from '@/types';
import { OfflinePiece, OfflineSanskrit, WordGrammar } from './sanskrit/sanskritLexicon';
import {
  analyseVerb, CASES, CaseNo, deriveReading, derivePronoun, Derivation, Gender, GrammarLabel, labelReading, NumberNo,
  Person, VerbAnalysis, verbEndingFor,
} from './sanskrit/sanskritGrammar';
import { COMPOUND_MEMBERS } from '@/constants/compoundMembers';
import { PARTICIPLE_ENGLISH, PREFIXED_MEANINGS, PRONOUNS, ROOT_MEANINGS, UPASARGA_INFO } from '@/constants/sanskritRoots';
import { slp1ToIast } from './sanskrit/sanskritTranslit';
import { verbAnalysisFromLexicon } from './sanskrit/formLexicon';
import { analyseParticiple, stemCandidates, type GrammarReading } from './sanskrit/sanskritGrammar';
import { iastToSlp1 } from './sanskrit/sanskritTranslit';
import { MatchCursor, matchInVerse, wordForWordFromSynonyms } from './sanskrit/wordForWordMatch';
import type { SandhiJoin } from './sanskrit/sandhi';
import { simplifyMeaning } from './sanskrit/simplify';

/**
 * Offline word lookup for the verse screen's long-press / double-click
 * meanings.
 *
 * Sanskrit words are explained only from bona fide sources, in this order:
 *  1. Śrīla Prabhupāda's own word-for-word translations — the synonyms of the
 *     verse being read first, then of every other verse in the offline library
 *     (one FTS query over the synonyms column).
 *  2. The short glossary in constants/sanskritGlossary.ts.
 *  3. For sandhi-viccheda (splitting fused words: "caiva" = ca + eva) the
 *     verse's own word-for-word first — his synonyms are the split — and
 *     otherwise an offline splitter (services/sanskrit/) over the particle
 *     list, the glossary and Apte's dictionary, which Prabhupāda cites.
 *     Apte only tells the splitter which pieces are words: every meaning
 *     shown is Prabhupāda's own (this verse, his word-for-word elsewhere in
 *     the library, or the glossary in his usage), so no meaning can differ
 *     in sense from his. No other dictionary is consulted.
 *
 * English words use the bundled WordNet 3.0 file (scripts/build-dictionary.py),
 * kept as one string and binary-searched in place.
 */

export type PartOfSpeech = 'n' | 'v' | 'a' | 'r';

export interface Sense {
  pos: PartOfSpeech;
  def: string;
}

/** One of Prabhupāda's renderings of the word, with where it is used. */
export interface WordMeaning {
  /** The Sanskrit word exactly as printed in the synonyms, e.g. "kalpa-tarubhyaḥ". */
  word: string;
  meaning: string;
  refs: VerseRef[];
  /** Taken from the synonyms of the verse on screen. */
  inThisVerse: boolean;
}

export interface VerseRef {
  bookSlug: string;
  canto?: number;
  chapter: number;
  verse: string;
  label: string;
}

export interface PartResult {
  word: string;
  meanings: WordMeaning[];
  glossary: GlossaryEntry | null;
}

export interface LookupResult {
  word: string;
  isSanskrit: boolean;
  meanings: WordMeaning[];
  glossary: GlossaryEntry | null;
  glossaryViaStem: boolean;
  /** English headword it resolved to ("went" -> "go"), or null. */
  headword: string | null;
  senses: Sense[];
  /** Filled only when a hyphenated compound had no entry of its own. */
  parts: PartResult[];
  /** Sandhi-viccheda with grammar, when the word separates into words or
   * the verse's word-for-word covers it. */
  sandhi: SandhiResult | null;
}

/** Where a separated word's meaning comes from. 'prabhupada': this verse's
 * word-for-word; 'library': his word-for-word for the same word in another
 * verse; 'apte': found only in Apte — the word is recognised, but no
 * meaning is shown for it. */
export type SandhiSource = 'prabhupada' | 'library' | 'particle' | 'glossary' | 'apte' | 'derived';

/** One word of a sandhi-viccheda, with its grammar and meaning. */
export interface SandhiPart {
  /** As it stands once separated, IAST ("eva", "pāṇḍavāḥ"). */
  word: string;
  meaning: string | null;
  source: SandhiSource | null;
  /** Dictionary form, when the word is an inflection of it ("kṣetra"). */
  stem: string | null;
  /** The stem is a verb root (shown as √tyaj). */
  verb: boolean;
  /** Prabhupāda gives one meaning for several words ("śrī-bhagavān uvāca —
   * the Supreme Personality of Godhead said"): the words it covers. */
  entryWords: string[] | null;
  /** For a hyphenated compound in his list, its members' offline meanings. */
  members: SandhiPart[];
  grammar: WordGrammarView | null;
  /** The sandhi that joined it to the next word / changed its start. */
  join: SandhiJoin | null;
  start: SandhiJoin | null;
  /** For 'library': the verse his meaning is taken from ("SB 1.2.3"). */
  ref: VerseRef | null;
  /** For 'library': his other renderings of the word, commonest first —
   * shown together, since which one fits here is his to say, not ours. */
  alsoRendered: { meaning: string; ref: VerseRef | null }[];
  /** His exact words, when `meaning` is a simpler wording of them. */
  original: string | null;
  /** Prabhupāda gives one meaning for a phrase ("sañjayaḥ uvāca — Sañjaya
   * said"): that phrase and its meaning, shown beside the word's own. */
  phrase: { words: string; meaning: string } | null;
  /** The word could not be analysed safely — listed, never dropped. */
  unanalysed?: boolean;
}

export interface WordGrammarView {
  /** A fixed description (particles, pronouns, compound members). */
  note: string | null;
  best: GrammarLabel | null;
  others: GrammarLabel[];
  /** Where the word comes from and how it changed: "yām ← yad (which):
   * yad → feminine stem yā- → yā- + -m (accusative singular) = yām". */
  origin: WordOrigin | null;
  /** For a finite verb: its parts (upasarga + dhātu + vikaraṇa + tiṅ), the
   * whole table of its tense, and what each prefix does. */
  verb: VerbView | null;
  /** The readings this view was made from, best first (not shown): the
   * verse pass re-picks an adjective's reading by agreement. */
  source?: { grammar: WordGrammar; word: string };
}

export interface VerbView extends VerbAnalysis {
  rootMeaning: string | null;
  /** Each upasarga with its basic sense ("pra — forward, forth"). */
  upasargas: { prefix: string; sense: string; example: string }[];
  /** What prefix + root mean together, when the prefix changes the sense
   * ("pra + √vad — to speak out, to proclaim"). */
  combinedMeaning: string | null;
}

function verbView(a: VerbAnalysis | null): VerbView | null {
  if (!a) return null;
  const rootKey = iastToSlp1(a.root) ?? '';
  const preKeys = a.prefixes.map(p => iastToSlp1(p) ?? p);
  return {
    ...a,
    rootMeaning: ROOT_MEANINGS[rootKey] ?? null,
    upasargas: preKeys.map((k, i) => ({
      prefix: a.prefixes[i], sense: UPASARGA_INFO[k]?.sense ?? '', example: UPASARGA_INFO[k]?.example ?? '',
    })),
    combinedMeaning: preKeys.length ? PREFIXED_MEANINGS[[...preKeys, rootKey].join('|')] ?? null : null,
  };
}

const PERSON_WORD: Record<string, Person> = { '3rd': 3, '2nd': 2, '1st': 1 };

/** Verb analysis for a listed verb form from its note
 * ("√jñā with abhi- · present (laṭ), 3rd person singular"). */
function verbFromNote(note: string, form: string): VerbView | null {
  const m = note.match(/^√(\S+)(?: with ([^·]+?)-)? · (.+), (1st|2nd|3rd) person (singular|dual|plural)$/);
  if (!m) return null;
  const root = iastToSlp1(m[1]);
  if (!root) return null;
  const prefix = m[2] ? m[2].split(/-\s*\+\s*|\s*\+\s*/).map(p => iastToSlp1(p.replace(/-$/, '')) ?? p).join('-') : undefined;
  const person = PERSON_WORD[m[4]];
  const num = NUMBER_WORD[m[5]];
  const v = verbEndingFor(form, person, num, /perfect/.test(m[3]));
  if (!v) return null;
  return verbView(analyseVerb(form, root, prefix, { ...v, tense: m[3] }));
}

export interface WordOrigin {
  /** Dictionary form it comes from: "idam", "puṣpita", "√vad". */
  base: string;
  /** Meaning of that form, in Śrīla Prabhupāda's usage (glossary, root and
   * pronoun lists), or null. */
  baseMeaning: string | null;
  steps: string[];
}

/** "past participle of apa- + √hṛ (to carry away, to steal): carried away". */
function participleMeaning(word: string): string | null {
  const slp = iastToSlp1(word.split('-').pop() ?? word);
  if (!slp) return null;
  const a = analyseParticiple(slp, k => offlineSanskrit.isRoot(k));
  if (!a) return null;
  const key = [...a.prefixes, a.root].join('|');
  const sense = PREFIXED_MEANINGS[key] ?? ROOT_MEANINGS[a.root];
  const english = PARTICIPLE_ENGLISH[key] ?? PARTICIPLE_ENGLISH[a.root];
  const parts = [...a.prefixes.map(p => `${slp1ToIast(p)}-`), `√${slp1ToIast(a.root)}`].join(' + ');
  return `${english ? `${english} — ` : ''}past participle of ${parts}${sense ? ` (${sense})` : ''}`;
}

/** Meaning of a stem / root / pronoun a word comes from. */
function baseMeaningOf(d: Derivation): string | null {
  if (d.kind === 'verb') return ROOT_MEANINGS[d.baseKey] ?? null;
  if (d.kind === 'pronoun') return PRONOUNS[d.base]?.meaning ?? null;
  const g = lookupGlossaryStem(normalizeWord(d.base));
  if (g) return g.entry.def;
  // The negative prefix: avipaścit = a- (not) + vipaścit (learned).
  const m = normalizeWord(d.base).match(/^(an?)(.{3,})$/);
  const inner = m ? lookupGlossaryStem(m[2]) : null;
  if (inner) {
    const innerWord = d.base.slice(m![1].length);
    const first = inner.entry.def.split(/[;—]/)[0].replace(/\.$/, '').trim().toLowerCase();
    return `not ${first} — ${m![1]}- (not) + ${innerWord} (${first})`;
  }
  return null;
}

const GENDER_WORD: Record<string, Gender> = { masculine: 'm', feminine: 'f', neuter: 'n' };
const NUMBER_WORD: Record<string, NumberNo> = { singular: 0, dual: 1, plural: 2 };

/** Origin of a word whose grammar is a fixed note: a pronoun form
 * ("idam · feminine accusative singular") or a listed verb form
 * ("√as · present (laṭ), 3rd person singular"). */
function originFromNote(note: string, form: string): WordOrigin | null {
  const head = note.split(' · ')[0].trim();
  const rest = note.slice(head.length).replace(/^ · /, '');
  if (head.startsWith('√')) {
    const root = head.slice(1).split(' ')[0];
    const key = iastToSlp1(root) ?? '';
    return { base: `√${root}`, baseMeaning: ROOT_MEANINGS[key] ?? null, steps: [`${head} → ${slp1ToIast(form)}: ${rest}`] };
  }
  const pron = PRONOUNS[head];
  if (!pron) return null;
  // Only a single reading is spelt out; "te" (two readings) just names them.
  const one = !/\bor\b|\//.test(rest);
  const g = one ? GENDER_WORD[rest.match(/masculine|feminine|neuter/)?.[0] ?? ''] ?? null : null;
  const caseWord = rest.match(/nominative|accusative|instrumental|dative|ablative|genitive|locative|vocative/)?.[0];
  const caseNo = one && caseWord ? (CASES.find(c => c.english === caseWord)!.no as CaseNo) : null;
  const numWord = rest.match(/singular|dual|plural/)?.[0];
  const num = one && numWord ? NUMBER_WORD[numWord] : null;
  const d = g && caseNo && num !== null && (pron.m || pron.f)
    ? derivePronoun(head, pron, g, caseNo, num, form)
    : { base: head, baseKey: '', kind: 'pronoun' as const, steps: [`${head} → ${slp1ToIast(form)}: ${rest}`] };
  return { base: head, baseMeaning: pron.meaning, steps: d.steps };
}

export interface SandhiResult {
  /** 'prabhupada': the split is his, from the verse; 'offline': computed. */
  from: 'prabhupada' | 'offline';
  /** The verse it came from ("BG 2.42"), for 'prabhupada'. */
  verse: string | null;
  parts: SandhiPart[];
}

export const POS_LABEL: Record<PartOfSpeech, string> = {
  n: 'noun', v: 'verb', a: 'adjective', r: 'adverb',
};

const SENSE_SEP = '\x1f';
const MAX_MEANINGS = 5;

// ── Dictionary files ──────────────────────────────────────────────────────

/** A bundled sorted `key<TAB>value` file, loaded once on first use. */
class RawDictionary {
  text = '';
  private loading: Promise<void> | null = null;

  constructor(private readonly name: DictionaryName) {}

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = loadDictionaryText(this.name).then(raw => { this.text = raw; }).catch(err => {
        this.loading = null; // let the next lookup retry
        throw err;
      });
    }
    return this.loading;
  }

  find = (key: string): string | null => findRaw(this.text, key);
}

const wordnet = new RawDictionary('wordnet');
const apte = new RawDictionary('apte');
// Vidyut's readings of every word in Prabhupāda's word-for-word, and the
// conjugation tables of their verbs (scripts/build-forms.py).
const forms = new RawDictionary('forms');
const verbTables = new RawDictionary('verbtables');
const offlineSanskrit = new OfflineSanskrit(apte.find, forms.find);

export function preloadDictionary(): Promise<void> {
  return wordnet.load();
}

/**
 * Binary search straight over the raw file: jump to a character offset, back
 * up to the start of its line and compare that line's key. Lines are sorted by
 * key, so no per-line index has to be built (that took seconds on the JS
 * thread for the file's ~86k lines).
 */
function findRaw(text: string, key: string): string | null {
  if (!text) return null;
  // Skip the '#' header lines at the top.
  let first = 0;
  while (first < text.length && text.charCodeAt(first) === 35) {
    const nl = text.indexOf('\n', first);
    if (nl === -1) return null;
    first = nl + 1;
  }
  let lo = first;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const start = mid <= first ? first : text.lastIndexOf('\n', mid - 1) + 1;
    const tab = text.indexOf('\t', start);
    let nl = text.indexOf('\n', start);
    if (nl === -1) nl = text.length;
    if (tab === -1 || tab > nl) { hi = start; continue; } // blank line
    const k = text.slice(start, tab);
    if (k === key) return text.slice(tab + 1, nl);
    if (k < key) lo = nl + 1;
    else hi = start;
  }
  return null;
}

// ── Normalising ───────────────────────────────────────────────────────────

/** Lower-case, drop IAST diacritics and curly quotes, keep letters/'/-. */
export function normalizeWord(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, '')
    .replace(/'s$/, '');
}

/** Strip surrounding punctuation but keep the reader's own spelling. */
export function cleanDisplayWord(s: string): string {
  return s.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

/**
 * Compare Sanskrit words across sandhi: final -ḥ is printed -ś/-s/-r/-o
 * depending on the next word ("kalpatarubhyaś ca" but "kalpatarubhyaḥ" in the
 * synonyms), and hyphens are placed differently in text and synonyms.
 */
function sandhiKey(w: string): string {
  let k = normalizeWord(w).replace(/[^a-z]/g, '');
  k = k.replace(/[hsr]$/, '');
  if (k.endsWith('o')) k = k.slice(0, -1) + 'a';
  return k;
}

// ── English (WordNet) ─────────────────────────────────────────────────────

// WordNet's own "morphy" detachment rules plus -ly/-ily and undoubling; the
// third field is the part of speech the suffix implies.
const SUFFIX_RULES: [string, string, PartOfSpeech?][] = [
  ['ies', 'y'], ['ses', 's', 'n'], ['xes', 'x'], ['zes', 'z'], ['ches', 'ch'], ['shes', 'sh'],
  ['men', 'man', 'n'], ['es', 'e'], ['es', ''], ['s', ''],
  ['ed', 'e', 'v'], ['ed', '', 'v'], ['ing', 'e', 'v'], ['ing', '', 'v'],
  ['est', 'e', 'a'], ['est', '', 'a'], ['er', 'e', 'a'], ['er', '', 'a'],
  ['ily', 'y', 'r'], ['ly', '', 'r'],
];

function englishCandidates(w: string): { key: string; pos?: PartOfSpeech }[] {
  const implied = SUFFIX_RULES.find(([suffix, , pos]) => pos && w.length > suffix.length + 1 && w.endsWith(suffix));
  const out: { key: string; pos?: PartOfSpeech }[] = [{ key: w, pos: implied?.[2] }];
  for (const [suffix, repl, pos] of SUFFIX_RULES) {
    if (w.length > suffix.length + 1 && w.endsWith(suffix)) {
      const base = w.slice(0, -suffix.length) + repl;
      out.push({ key: base, pos });
      if (!repl && /([b-df-hj-np-tv-z])\1$/.test(base)) out.push({ key: base.slice(0, -1), pos });
    }
  }
  if (w.includes('-')) out.push({ key: w.replace(/-/g, '') });
  return out;
}

function lookupEnglish(key: string): { headword: string; senses: Sense[] } | null {
  for (const cand of englishCandidates(key)) {
    let raw = wordnet.find(cand.key);
    let headword = cand.key;
    let pos = cand.pos;
    if (raw?.startsWith('@')) {
      // Irregular form: "@go:v" — "went" is the verb go, not the noun.
      const [base, p] = raw.slice(1).split(':');
      raw = wordnet.find(base);
      headword = base;
      pos = p as PartOfSpeech;
      if (raw?.startsWith('@')) raw = null;
    }
    if (raw) {
      const senses = raw.split(SENSE_SEP).map(s => ({ pos: s[0] as PartOfSpeech, def: s.slice(2) }));
      const sorted = pos
        ? [...senses.filter(s => s.pos === pos), ...senses.filter(s => s.pos !== pos)]
        : senses;
      return { headword, senses: sorted };
    }
  }
  return null;
}

// ── Sanskrit: glossary ────────────────────────────────────────────────────

// Case endings (and sandhi variants) to strip back to a glossary term.
const SANSKRIT_ENDINGS: [string, string[]][] = [
  ['ebhyah', ['a']], ['ebhyas', ['a']], ['ebhyo', ['a']], ['abhyam', ['a', '']],
  ['bhyah', ['', 'a']], ['bhyas', ['', 'a']], ['bhyo', ['', 'a']], ['bhyam', ['', 'a']],
  ['ebhih', ['a']], ['ebhis', ['a']], ['bhih', ['', 'a']], ['bhis', ['', 'a']],
  ['anam', ['a', 'an', '']], ['inam', ['i', 'in']], ['unam', ['u']],
  ['asya', ['a']], ['esu', ['a']], ['isu', ['i', 'in']], ['usu', ['u']], ['asu', ['a', 'as']],
  ['aya', ['a']], ['ena', ['a']], ['ina', ['in', 'i']], ['una', ['u']],
  ['aih', ['a']], ['ais', ['a']],
  ['nam', ['', 'n']], ['sya', ['']], ['su', ['']],
  ['ani', ['a', 'an']], ['ini', ['in', 'i']],
  ['ah', ['a', '']], ['as', ['a', '']], ['am', ['a', '']], ['au', ['a', '']],
  ['ih', ['i']], ['is', ['i']], ['uh', ['u']], ['us', ['u']], ['im', ['i']], ['um', ['u']],
  ['e', ['a', 'i', '']], ['o', ['a', 'u', '']],
  ['i', ['in', 'i']], ['a', ['an', 'a', '']],
  ['h', ['']], ['s', ['']], ['m', ['']], ['r', ['']], ['t', ['']], ['n', ['']],
];

function lookupGlossaryStem(key: string): { entry: GlossaryEntry; viaStem: boolean } | null {
  const forms = key.includes('-') ? [key, key.replace(/-/g, '')] : [key];
  for (const w of forms) {
    const exact = lookupGlossary(w);
    if (exact) return { entry: exact, viaStem: false };
  }
  for (const w of forms) {
    for (const [ending, adds] of SANSKRIT_ENDINGS) {
      if (w.length - ending.length >= 2 && w.endsWith(ending)) {
        const stem = w.slice(0, -ending.length);
        for (const add of adds) {
          const hit = lookupGlossary(stem + add);
          if (hit) return { entry: hit, viaStem: true };
        }
      }
    }
  }
  return null;
}

// ── Sanskrit: Prabhupāda's word-for-word ──────────────────────────────────

const BOOK_LABEL: Record<string, string> = { bg: 'BG', sb: 'SB', cc: 'CC', iso: 'Īśo', noi: 'NOI', bs: 'Bs' };
const CC_LILA: Record<number, string> = { 1: 'Ādi', 2: 'Madhya', 3: 'Antya' };

function refLabel(r: { bookSlug: string; canto?: number; chapter: number; verse: string }): string {
  const book = BOOK_LABEL[r.bookSlug] ?? r.bookSlug.toUpperCase();
  if (r.bookSlug === 'cc' && r.canto) return `CC ${CC_LILA[r.canto] ?? r.canto} ${r.chapter}.${r.verse}`;
  return r.canto != null ? `${book} ${r.canto}.${r.chapter}.${r.verse}` : `${book} ${r.chapter}.${r.verse}`;
}

/** Does a synonyms entry's Sanskrit side name the tapped word? */
function pairMatches(pairWord: string, target: string): boolean {
  if (sandhiKey(pairWord) === target) return true;
  // "ca eva", "sa evāyam" — an entry can cover a few words.
  return pairWord.split(/\s+/).some(w => sandhiKey(w) === target);
}

interface SynonymSearch {
  /** Skip entries that gloss several words at once ("sañjayaḥ uvāca —
   * Sañjaya said"): their meaning belongs to the phrase, not this word. */
  singleOnly?: boolean;
  /** Also accept his renderings of other forms of the same stem (SLP1):
   * "cetasā — by consciousness" for cetasām. */
  stem?: string | null;
}

/** Stem (SLP1) candidates of a written word, for matching other forms. */
function stemsOf(word: string): Set<string> {
  const slp = iastToSlp1(word.split('-').pop() ?? word);
  return new Set(slp ? [slp, ...stemCandidates(slp).map(c => c.stem)] : []);
}

async function lookupSynonyms(word: string, currentVerse?: Verse | null, opts: SynonymSearch = {}): Promise<WordMeaning[]> {
  const target = sandhiKey(word);
  if (target.length < 2) return [];
  const matches = (pairWord: string) => (opts.singleOnly && /\s/.test(pairWord.trim())
    ? sandhiKey(pairWord) === target : pairMatches(pairWord, target));

  const byMeaning = new Map<string, WordMeaning>();
  const add = (pairWord: string, meaning: string, row: SynonymRow | null) => {
    const m = meaning.replace(/\s+/g, ' ').trim();
    if (!m) return;
    const k = m.toLowerCase();
    let entry = byMeaning.get(k);
    if (!entry) {
      entry = { word: pairWord, meaning: m, refs: [], inThisVerse: !row };
      byMeaning.set(k, entry);
    }
    if (row && entry.refs.length < 3) {
      const ref = { ...row, label: refLabel(row) };
      if (!entry.refs.some(r => r.label === ref.label)) entry.refs.push(ref);
    }
  };

  // The verse on screen first: its own synonyms are the exact meaning here.
  if (currentVerse?.synonyms) {
    for (const p of parseSynonyms(currentVerse.synonyms)) {
      if (p.meaning && matches(p.word)) add(p.word, p.meaning, null);
    }
  }

  // Then the rest of the offline library. The prefix drops the last letter so
  // one query also catches the word's other sandhi spellings (-aḥ/-o/-aś).
  const prefix = target.length > 3 ? target.slice(0, -1) : target;
  let rows: SynonymRow[] = [];
  try {
    rows = await getSynonymCandidates(prefix, 400, currentVerse?.language ?? 'en');
  } catch {
    rows = [];
  }
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const p of parseSynonyms(row.synonyms)) {
      if (!p.meaning || !matches(p.word)) continue;
      add(p.word, p.meaning, row);
      const k = p.meaning.replace(/\s+/g, ' ').trim().toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  // Nothing for this exact form: his renderings of another form of the same
  // stem ("cetasā" for cetasām), each labelled with the form it glosses.
  if (!byMeaning.size && opts.stem) {
    const stemPrefix = sandhiKey(slp1ToIast(opts.stem)).slice(0, Math.max(3, sandhiKey(slp1ToIast(opts.stem)).length - 1));
    let more: SynonymRow[] = [];
    try { more = await getSynonymCandidates(stemPrefix, 400, currentVerse?.language ?? 'en'); } catch { more = []; }
    for (const row of more) {
      for (const p of parseSynonyms(row.synonyms)) {
        const single = p.word.trim();
        if (!p.meaning || /[\s-]/.test(single)) continue;
        if (!stemsOf(single).has(opts.stem)) continue;
        add(single, `${p.meaning} (his rendering of the form ${single})`, row);
        const k = p.meaning.replace(/\s+/g, ' ').trim().toLowerCase();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }

  // This verse's meaning first, then the most common renderings.
  return [...byMeaning.values()]
    .sort((a, b) =>
      Number(b.inThisVerse) - Number(a.inThisVerse) ||
      (counts.get(b.meaning.toLowerCase()) ?? 0) - (counts.get(a.meaning.toLowerCase()) ?? 0))
    .slice(0, MAX_MEANINGS);
}

// ── Entry point ───────────────────────────────────────────────────────────

const DIACRITIC = /[Ā-ɏḀ-ỿ]/;

export interface LookupOptions {
  /** The word came from the transliteration or a synonyms entry, so read it
   * as Sanskrit even when spelt in plain ASCII ("ca", "eva"). */
  sanskritFirst?: boolean;
  /** The verse on screen — its own synonyms are checked first. */
  verse?: Verse | null;
}

export async function lookupWord(selected: string, opts: LookupOptions = {}): Promise<LookupResult> {
  const word = cleanDisplayWord(selected.trim().split(/\s+/)[0] ?? '');
  const key = normalizeWord(word);
  const isSanskrit = !!opts.sanskritFirst || DIACRITIC.test(word);
  const result: LookupResult = {
    word, isSanskrit, meanings: [], glossary: null, glossaryViaStem: false,
    headword: null, senses: [], parts: [], sandhi: null,
  };
  if (!key) return result;

  const g = lookupGlossaryStem(key);
  result.glossary = g?.entry ?? null;
  result.glossaryViaStem = g?.viaStem ?? false;

  if (!isSanskrit) {
    // An English word: WordNet, unless the glossary already knows it
    // ("karma", "yoga" — explained in Prabhupāda's sense, not WordNet's).
    if (!result.glossary) {
      await preloadDictionary();
      const e = lookupEnglish(key);
      if (e) {
        result.headword = e.headword;
        result.senses = e.senses;
        return result;
      }
    } else {
      return result;
    }
  }

  // A leading avagraha ("’śubhāt" in "mokṣyase ’śubhāt") is an elided a-.
  const token = /^['’]/.test(selected.trim()) ? "'" + word : word;
  const [meanings, sandhi] = await Promise.all([
    lookupSynonyms(word, opts.verse),
    sandhiFor(token, opts.verse).catch(() => null),
  ]);
  result.meanings = meanings;
  // A one-word offline "split" that only repeats the glossary or the
  // word-for-word adds nothing; a real split, or his own entry, does.
  const adds = sandhi && (sandhi.from === 'prabhupada' || sandhi.parts.length > 1 ||
    (!result.glossary && !meanings.length) || sandhi.parts[0].source === 'apte' && !meanings.length);
  if (adds) result.sandhi = sandhi;
  if (result.meanings.length || result.glossary || result.sandhi) return result;

  // A hyphenated compound with no entry of its own: explain its pieces.
  if (word.includes('-')) {
    const pieces = word.split('-').filter(p => normalizeWord(p));
    result.parts = await Promise.all(pieces.map(async p => ({
      word: p,
      meanings: (await lookupSynonyms(p, opts.verse)).slice(0, 2),
      glossary: lookupGlossaryStem(normalizeWord(p))?.entry ?? null,
    })));
    if (!result.parts.some(p => p.meanings.length || p.glossary)) result.parts = [];
  }
  return result;
}

// ── Sandhi-viccheda and grammar ───────────────────────────────────────────

/** The verse's reference as the analysis shows it ("BG 2.42", "SB 1.2.3"). */
export function verseLabel(v: Pick<Verse, 'bookSlug' | 'canto' | 'chapter' | 'verse' | 'verseRange'>): string {
  return refLabel({ bookSlug: v.bookSlug, canto: v.canto, chapter: v.chapter, verse: String(v.verseRange ?? v.verse) });
}

function offlinePart(p: OfflinePiece): SandhiPart {
  const src = p.source;
  // Never Apte's English: it gives the range of a word's meanings, which
  // can differ in sense from Prabhupāda's. withLibraryMeanings() fills these
  // from his own word-for-word instead.
  // An Apte-only stem the glossary also knows by another spelling
  // (ātman ~ ātmā) takes the glossary's meaning.
  const gloss = src.kind === 'apte' ? lookupGlossaryStem(normalizeWord(p.stem ?? p.word)) : null;
  if (gloss) {
    return {
      word: p.word, meaning: gloss.entry.def, source: 'glossary', stem: p.stem, verb: false, entryWords: null,
      members: [], grammar: null, join: p.join, start: p.start, ref: null, alsoRendered: [], original: null, phrase: null,
    };
  }
  const meaning =
    src.kind === 'particle' ? src.particle.meaning
      : src.kind === 'glossary' ? src.entry.def
        : null;
  return {
    word: p.word,
    meaning,
    source: src.kind,
    stem: src.kind === 'glossary' ? (p.stem ? src.entry.term : null) : p.stem,
    verb: src.kind === 'apte' && !!src.verb,
    entryWords: null,
    members: [],
    grammar: null,
    join: p.join,
    start: p.start,
    ref: null,
    alsoRendered: [],
    original: null,
    phrase: null,
  };
}

/** A compound's members, with their sense *in this compound* when it is a
 * known epithet (param-tapa: "the enemy" + "one who scorches"). */
function compoundMembers(word: string): SandhiPart[] {
  const members = word.split('-');
  const key = members.map((m, i) => (i === members.length - 1 ? m.replace(/(aḥ|am|au|āḥ|ān|ā|a|o|e|ḥ)$/, 'a') : m))
    .join('-').toLowerCase();
  const senses = COMPOUND_MEMBERS[key] ?? COMPOUND_MEMBERS[key.replace(/a$/, 'u')] ?? COMPOUND_MEMBERS[word.toLowerCase()];
  return members.map((m, i) => {
    const part = memberPart(m);
    return senses?.[i] ? { ...part, meaning: senses[i], source: 'derived' as const } : part;
  });
}

/** A member of a compound in his list, with its offline meaning if any. */
function memberPart(member: string): SandhiPart {
  // A compound's first member is the bare stem; an n-stem shows without its
  // n (ātma- ← ātman, karma- ← karman), so that is tried as it stands.
  const slp = iastToSlp1(member);
  // The n-stem first: brahma- in a compound is brahman (spirit), not Brahmā.
  const g = lookupGlossaryStem(normalizeWord(member + 'n')) ?? lookupGlossaryStem(normalizeWord(member));
  if (slp && g) {
    return {
      word: member, meaning: g.entry.def, source: 'glossary', stem: null, verb: false, entryWords: null,
      members: [], grammar: null, join: null, start: null, ref: null, alsoRendered: [], original: null, phrase: null,
    };
  }
  const pieces = offlineSanskrit.split(member);
  if (pieces?.length === 1) return offlinePart(pieces[0]);
  return {
    word: member, meaning: null, source: null, stem: null, verb: false, entryWords: null,
    members: [], grammar: null, join: null, start: null, ref: null, alsoRendered: [], original: null, phrase: null,
  };
}

function grammarView(g: WordGrammar | null, word: string): WordGrammarView | null {
  if (!g) return null;
  // In a compound only the last member takes the ending.
  const form = iastToSlp1(word.split('-').pop() ?? word) ?? '';
  if (g.kind === 'fixed') {
    return {
      note: g.note, best: null, others: [],
      origin: form ? originFromNote(g.note, form) : null,
      verb: form ? verbFromNote(g.note, form) : null,
    };
  }
  const [labelled, ...rest] = g.readings.map(labelReading);
  const d = form ? deriveReading(g.readings[0], form) : null;
  const r0 = g.readings[0];
  // A lexicon (Vidyut) verb is broken down from its own derivation and table.
  const lexVerb = r0.lex?.kind === 'verb' ? r0.lex : null;
  const verb = lexVerb
    ? verbView(verbAnalysisFromLexicon(lexVerb, verbTables.find(lexVerb.tableKey)?.split(',') ?? null))
    : r0.kind === 'verb' && !r0.unverified && r0.verb && !r0.verb.form ? verbView(analyseVerb(form, r0.stem, r0.prefix, r0.verb)) : null;
  // The verb's own table can correct person / number (paryupāsate: "they").
  const first = verb && r0.verb?.person && (verb.person !== r0.verb.person || verb.number !== r0.verb.number)
    ? labelReading({ ...r0, verb: { ...r0.verb, tense: verb.tense, person: verb.person, number: verb.number } })
    : labelled;
  return {
    note: null,
    best: first,
    // "or …" only for readings that say something different.
    // A verb whose own table settled it, or a verb / gerund at all, has no
    // noun reading worth offering (avāpya is not a vocative).
    // Only the same word's other readings (karman's, not karmin's).
    others: first !== labelled || r0.kind === 'verb' ? [] : rest.filter((o, i) => o.form !== first.form && rest.findIndex(x => x.form === o.form) === i
      && o.stem.split(' ')[0] === first.stem.split(' ')[0]).slice(0, 2),
    origin: d ? { base: d.base, baseMeaning: baseMeaningOf(d), steps: d.steps } : null,
    verb,
    source: { grammar: g, word },
  };
}

/**
 * An adjective takes the gender, case and number of its noun (sve sve
 * karmaṇi: locative singular, not the nominative plural its ending also
 * allows). When a describing word's first reading agrees with no noun
 * near it but another of its readings agrees with one right beside it,
 * that reading is the one the verse uses.
 */
function agreeAdjectives(lines: VerseAnalysis['lines']): void {
  const parts = lines.filter(l => !l.heading).flatMap(l => l.tokens.flatMap(t => t.sandhi?.parts ?? []));
  const readingsOf = (p: SandhiPart) => {
    const g = p.grammar?.source?.grammar;
    return g?.kind === 'readings' ? g.readings : null;
  };
  const describing = (r: GrammarReading) => r.kind === 'noun' && (!!r.adjective || (r.lex?.kind === 'noun' && (!!r.lex.krt || r.lex.lexGenders.length === 3)));
  const agree = (a: GrammarReading, b: GrammarReading) => a.case === b.case && a.number === b.number
    && (!a.gender?.length || !b.gender?.length || a.gender.some(x => b.gender!.includes(x)));
  const nounAt = parts.map(p => {
    const r = readingsOf(p)?.[0];
    return r && r.kind === 'noun' && !describing(r) && r.case !== 8 ? r : null;
  });
  const nearNoun = (i: number, r: GrammarReading, span: number) => nounAt.some((n, j) => n && j !== i && Math.abs(j - i) <= span && agree(r, n));
  parts.forEach((p, i) => {
    const rs = readingsOf(p);
    if (!rs || rs.length < 2 || nearNoun(i, rs[0], 4)) return;
    // The same adjective in another gender / case (sva), or the adjective
    // whose feminine the first reading took for a noun (samā "year" → sama).
    const sameWord = (r: GrammarReading) => r.stem === rs[0].stem && describing(rs[0])
      || rs[0].stem === r.stem.replace(/a$/, 'A') && rs[0].gender?.join('') === 'f';
    const j = rs.findIndex((r, k) => k > 0 && describing(r) && sameWord(r) && nearNoun(i, r, 3));
    if (j < 0) return;
    const reordered = [rs[j], ...rs.filter((_, k) => k !== j)];
    p.grammar = grammarView({ kind: 'readings', readings: reordered }, p.grammar!.source!.word);
  });
}

/** Joins inside a token that fuse a compound rather than separate words. */
const isCompoundJoin = (j: SandhiJoin | null) => !!j && /^Samāsa|^Joined without change/.test(j.rule);

/** Grammar for each part; parts fused into the next by a compound join (or
 * by vowel sandhi inside a hyphenated compound) are members, not words.
 * Prabhupāda's English for a word ("in the place…", "O son of Pṛthā")
 * settles which case an ambiguous ending is. */
function withGrammar(parts: SandhiPart[], allMembers = false, tokenHasHyphen = false): SandhiPart[] {
  return parts.map((p, i) => {
    // A compound member is a piece before a hyphen of the written word, or
    // one joined by a compound join — never a free word fused to the next by
    // vowel sandhi (dṛṣṭvā + idam, parasya + ātmā, śraddhayā + anvitāḥ).
    const member = allMembers || isCompoundJoin(p.join) || (tokenHasHyphen && i < parts.length - 1);
    // His gloss of a phrase ("sve sve — in his own") still points to the case.
    const hint = p.source === 'prabhupada' ? p.meaning : p.phrase?.meaning ?? null;
    const stem = p.source === 'apte' ? (p.stem ?? p.word) : null;
    // A suffix written after a hyphen (vibhūti-mat, guhya-tamam) is not a
    // word of its own (mat is not asmad here).
    const suffix = i > 0 && tokenHasHyphen ? taddhitaNote(p.word) : null;
    if (suffix) return { ...p, meaning: null, source: null, grammar: grammarView({ kind: 'fixed', note: suffix }, p.word) };
    return { ...p, grammar: grammarView(offlineSanskrit.grammar(p.word, hint, { member, stem }), p.word) };
  });
}

/** Taddhita suffixes Prabhupāda's word-for-word sometimes writes as a member. */
function taddhitaNote(word: string): string | null {
  const w = word.replace(/(aḥ|am|ā|āḥ|āni|ān|ān|e|au|ena|āt|asya|ānām|ī|aiḥ|eṣu|a)$/, '');
  if (/^(mat|mān|mantaḥ|matā|mate|matām|matī)$/.test(word) || w === 'mat') {
    return 'suffix -mat (taddhita, matup, 5.2.94) — "having, possessed of"; with the word before it, one derived word';
  }
  if (/^(vat|vān|vantaḥ|vatā|vate|vatī)$/.test(word) || w === 'vat') {
    return 'suffix -vat (taddhita, matup → vatup, 8.2.9; or "like", vati, 5.1.115) — one derived word with the word before it';
  }
  if (w === 'tam' && !/^tama(ḥ|s)/.test(word)) return 'suffix -tama (taddhita, tamap, 5.3.55) — "most", the superlative';
  if (w === 'tar') return 'suffix -tara (taddhita, tarap, 5.3.57) — "more", the comparative';
  if (w === 'may') return 'suffix -maya (taddhita, mayaṭ, 4.3.82 / 5.4.21) — "made of, full of"';
  return null;
}

async function sandhiFor(
  word: string, verse: Verse | null | undefined, strict = false, cursor?: { at?: MatchCursor },
): Promise<SandhiResult | null> {
  await Promise.all([apte.load(), forms.load().catch(() => {}), verbTables.load().catch(() => {})]);
  const slp = iastToSlp1(word);
  const wfw = verse ? wordForWordFromSynonyms(verseLabel(verse), verse.synonyms) : null;
  const match = slp && wfw ? matchInVerse(slp, wfw, cursor?.at) : null;
  if (match && cursor) cursor.at = match.cursor;
  // A word of a verse whose word-for-word we have but can't find in it: an
  // offline split is only trusted when every piece is a word we are sure of
  // (particle or glossary) — otherwise "unanalysed", never a made-up split
  // like yotsya → yā + utsya.
  if (!match && strict && wfw) {
    const pieces = offlineSanskrit.split(word);
    const sure = pieces?.every(p => p.source.kind === 'particle' || p.source.kind === 'glossary');
    if (!pieces || !sure) return null;
  }
  if (match) {
    const parts: SandhiPart[] = match.parts.map(({ word: w, entry, join, start }) => {
      // One meaning for several words: each word still needs its own
      // (particles, glossary, his other renderings); the phrase is kept.
      const phrase = entry.words.length > 1 ? { words: entry.words.join(' '), meaning: entry.meaning } : null;
      const own = phrase ? offlineSanskrit.split(w) : null;
      const ownPart = own?.length === 1 ? offlinePart(own[0]) : null;
      // A word said twice (āmreḍita, sve sve — "each his own"): his meaning
      // is the pair's, and belongs to each.
      const repeated = !!phrase && entry.words.every(x => x === entry.words[0]);
      return {
        word: w,
        meaning: phrase && !repeated ? ownPart?.meaning ?? null : entry.meaning,
        source: phrase && !repeated ? ownPart?.source ?? null : 'prabhupada',
        stem: null,
        verb: false,
        entryWords: null,
        members: w.includes('-') ? withGrammar(compoundMembers(w), isCompoundJoin(join), true) : [],
        grammar: null,
        join,
        start,
        ref: null,
        alsoRendered: [],
        original: null,
        phrase,
      };
    });
    return { from: 'prabhupada', verse: match.verse, parts: simpler(withGrammar(await withLibraryMeanings(parts), false, word.includes('-'))) };
  }
  const pieces = offlineSanskrit.split(word);
  if (!pieces) return null;
  return { from: 'offline', verse: null, parts: simpler(withGrammar(await withLibraryMeanings(pieces.map(offlinePart)), false, word.includes('-'))) };
}

/**
 * Simpler wording of his meanings, same sense (services/sanskrit/simplify.ts);
 * his exact words are kept in `original` and shown alongside. Grammar is
 * worked out before this, from his exact English.
 */
function simpler(parts: SandhiPart[]): SandhiPart[] {
  return parts.map(p => {
    const members = simpler(p.members);
    if (!p.meaning || (p.source !== 'prabhupada' && p.source !== 'library')) return { ...p, members };
    const s = simplifyMeaning(p.meaning);
    return {
      ...p,
      members,
      meaning: s.text,
      original: s.changed ? s.original : null,
      alsoRendered: p.alsoRendered.map(a => ({ ...a, meaning: simplifyMeaning(a.meaning).text })),
    };
  });
}

const MAX_RENDERINGS = 3;

/**
 * Give every piece (and compound member) with no meaning of its own
 * Prabhupāda's renderings of that same word elsewhere in the library, his
 * commonest first. They are shown together, labelled with their verses: his
 * rendering in one verse can be specific to it ("sat — cause" in BG 13.13,
 * "eternal" in sac-cid-ānanda), so no single one is presented as the sense
 * here. A piece he never glosses keeps no meaning rather than a dictionary's.
 */
async function withLibraryMeanings(parts: SandhiPart[]): Promise<SandhiPart[]> {
  const fill = async (p: SandhiPart): Promise<SandhiPart> => {
    const members = p.members.length ? await Promise.all(p.members.map(fill)) : p.members;
    // His entry for this verse, the glossary (his usage) and the particle
    // list (context-free words: ca, eva, na) stand as they are.
    if (p.meaning) return { ...p, members };
    // Only his renderings of this same form: another form's gloss carries its
    // own case ("by the Lord" for bhagavati), which would mislead.
    const found = (await lookupSynonyms(p.word, null, { singleOnly: true }).catch(() => [])).slice(0, MAX_RENDERINGS);
    if (!found.length) {
      // A participle he doesn't gloss on its own: build its meaning from
      // prefix + root + -ta (apa + √hṛ + -ta → "carried away") — not for a
      // word he glosses as part of a phrase (a name: "sūtaḥ uvāca").
      const part = p.phrase ? null : participleMeaning(p.word);
      return part ? { ...p, members, meaning: part, source: 'derived' } : { ...p, members };
    }
    return {
      ...p,
      members,
      meaning: found[0].meaning,
      source: 'library',
      ref: found[0].refs[0] ?? null,
      alsoRendered: found.slice(1).map(f => ({ meaning: f.meaning, ref: f.refs[0] ?? null })),
    };
  };
  return Promise.all(parts.map(fill));
}

export interface LineToken {
  /** As written in the verse ("nānyad"). */
  written: string;
  /** Null: the word could not be analysed (it is still listed). */
  sandhi: SandhiResult | null;
}

export interface VerseAnalysis {
  /** One entry per line of the transliteration. `heading`: a speaker line
   * ("sañjaya uvāca") — a sentence of its own, not part of the verse's. */
  lines: { text: string; tokens: LineToken[]; heading: boolean }[];
  /** Every word matched in the verse's word-for-word, some, or none. */
  coverage: 'prabhupada' | 'mixed' | 'offline';
  verse: string;
}

/**
 * Sandhi-viccheda and grammar of every word of a verse's transliteration —
 * the whole-verse worksheet. Each word is split against the verse's own
 * word-for-word first, like a single-word lookup.
 */
export async function analyseVerse(verse: Verse): Promise<VerseAnalysis> {
  const lines: VerseAnalysis['lines'] = [];
  let total = 0;
  let his = 0;
  const rawLines = (verse.transliteration ?? '').split('\n').map(l => l.trim())
    // Combined verses carry "TEXT 3" / "TEXTS 16-18" headers between slokas.
    .filter(l => l && !/^texts?\s+[\d–-]+$/i.test(l));
  // A compound broken over a line end ("…ati-uṣṇa-" / "tīkṣṇa-…") is one
  // word: its tail is joined onto the line it starts on.
  const lineTexts: string[] = [];
  for (const l of rawLines) {
    const prev = lineTexts[lineTexts.length - 1];
    if (prev !== undefined && /-$/.test(prev)) {
      const [first, ...rest] = l.split(/\s+/);
      lineTexts[lineTexts.length - 1] = prev + first;
      if (rest.length) lineTexts.push(rest.join(' '));
    } else {
      lineTexts.push(l);
    }
  }
  // Words are matched to his list in order, so the nth "naḥ" gets his nth gloss.
  const cursor: { at?: MatchCursor } = {};
  for (const [li, text] of lineTexts.entries()) {
    const tokens: LineToken[] = [];
    for (const raw of text.split(/\s+/)) {
      const word = cleanDisplayWord(raw);
      if (!word || !/\p{L}/u.test(word)) continue;
      const token = /^['’]/.test(raw) ? "'" + word : word;
      const sandhi = await sandhiFor(token, verse, true, cursor);
      tokens.push({ written: token.replace(/^'/, '’'), sandhi });
      total++;
      if (sandhi?.from === 'prabhupada') his++;
    }
    // "sañjaya uvāca", "śrī-bhagavān uvāca", "arjuna uvāca": the speaker line.
    const heading = li === 0 && lineTexts.length > 1 && /^(\S+\s+){1,2}uvāca$/.test(text);
    lines.push({ text, tokens, heading });
  }
  agreeAdjectives(lines);
  return {
    lines,
    coverage: his === total && his > 0 ? 'prabhupada' : his > 0 ? 'mixed' : 'offline',
    verse: verseLabel(verse),
  };
}
