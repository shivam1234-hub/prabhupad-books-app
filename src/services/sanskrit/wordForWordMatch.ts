import { iastToSlp1, slp1ToIast } from './sanskritTranslit';
import { joinSandhi, SandhiJoin, splitSandhi } from './sandhi';
import { parseSynonyms } from '@/utils/parseSynonyms';

/**
 * Finding a written verse word in Śrīla Prabhupāda's word-for-word for that
 * verse. His synonyms already separate the sandhi ("caiva" is listed as
 * ca — and; eva — certainly), so the split is made with his words as the only
 * vocabulary: the result is his own separation, with the rule that joined
 * the words. Pure — runs under plain Node for testing.
 */

export interface SynonymEntry {
  /** The words as he spells them, hyphens kept ("dharma-kṣetre"). */
  words: string[];
  meaning: string;
}

export interface VerseWordForWord {
  /** The verse's reference, e.g. "BG 1.1" or "BG 1.16-18". */
  title: string;
  entries: SynonymEntry[];
}

export interface VerseMatchPart {
  /** The word as it stands in his list ("pāṇḍavāḥ"). */
  word: string;
  /** The whole entry it belongs to — several words can share one meaning
   * ("dhṛtarāṣṭraḥ uvāca — King Dhṛtarāṣṭra said"). */
  entry: SynonymEntry;
  /** Sandhi at its end / start as written in the verse (IAST). */
  join: SandhiJoin | null;
  start: SandhiJoin | null;
}

export interface VerseMatch {
  verse: string;
  parts: VerseMatchPart[];
  /** Where this match ended in his list, for the next word's match. */
  cursor: { entry: number; word: number };
}

/**
 * The verse's word-for-word as stored in the library ("jñeyam – the
 * knowable; yat – which; …"): each entry's Sanskrit side can hold several
 * words ("śrī-bhagavān uvāca – the Supreme Personality of Godhead said").
 */
export function wordForWordFromSynonyms(title: string, synonyms: string | undefined): VerseWordForWord | null {
  if (!synonyms) return null;
  const entries: SynonymEntry[] = [];
  for (const { word, meaning } of parseSynonyms(synonyms)) {
    const words = word.replace(/[‘’“”"]/g, '').split(/\s+/).filter(Boolean);
    const m = meaning.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
    if (words.length && m) entries.push({ words, meaning: m });
  }
  return entries.length ? { title, entries } : null;
}

// ── Matching a written word to his list ──────────────────────────────────────

interface Ref { entry: number; word: number; from: number; to: number; members: number }

function buildLexicon(verse: VerseWordForWord): Map<string, Ref[]> {
  const lex = new Map<string, Ref[]>();
  const put = (key: string | null, ref: Ref) => {
    if (!key) return;
    const list = lex.get(key);
    if (!list) lex.set(key, [ref]);
    else if (!list.some(r => r.entry === ref.entry && r.word === ref.word && r.from === ref.from && r.to === ref.to)) list.push(ref);
  };
  verse.entries.forEach((e, ei) => e.words.forEach((w, wi) => {
    const members = w.split('-').map(iastToSlp1);
    if (members.some(x => x == null)) return;
    const ms = members as string[];
    // Every run of members, both as plain letters and re-fused with sandhi:
    // the verse text may write "sūryāṁśa" where he lists "sūrya-aṁśa".
    for (let a = 0; a < ms.length; a++) {
      for (let b = a; b < ms.length; b++) {
        const run = ms.slice(a, b + 1);
        const ref = { entry: ei, word: wi, from: a, to: b, members: ms.length };
        put(run.join(''), ref);
        put(run.reduce(joinSandhi), ref);
      }
    }
  }));
  return lex;
}

const continues = (prev: Ref, r: Ref) => r.entry === prev.entry && r.word === prev.word && r.from === prev.to + 1;

/**
 * Pick one place in the list for each piece so that every listed word used
 * is used whole: "rāja-guhyaṁ" must be rāja-guhyam, not the "rāja" of the
 * rāja-vidyā before it. A small search over the pieces' options, preferring
 * listed order. Null if no whole-word reading exists.
 */
function chooseRefs(options: Ref[][], cursor?: Ref): Ref[] | null {
  const out: Ref[] = [];
  const walk = (i: number): boolean => {
    if (i === options.length) {
      const last = out[out.length - 1];
      return !last || last.to === last.members - 1;
    }
    // The first piece continues from where the previous written word ended
    // in his list, so a repeated word (naḥ … naḥ … naḥ) takes the next entry.
    const prev = out[out.length - 1] ?? cursor;
    // An unfinished listed word must be continued by this piece.
    const mustContinue = out.length > 0 && prev && prev.to < prev.members - 1;
    const ordered = [...options[i]].sort((a, b) => rank(prev, a) - rank(prev, b));
    for (const r of ordered) {
      if (mustContinue ? !continues(prev, r) : r.from !== 0) continue;
      out.push(r);
      if (walk(i + 1)) return true;
      out.pop();
    }
    return false;
  };
  return walk(0) ? out : null;
}

/** Later entries after the previous piece's first, then the rest. */
function rank(prev: Ref | undefined, r: Ref): number {
  if (!prev) return r.entry;
  if (continues(prev, r)) return -1;
  return r.entry > prev.entry || (r.entry === prev.entry && r.word > prev.word) ? r.entry - prev.entry : 1000 + r.entry;
}

/** Where the previous written word's match ended in his list. */
export interface MatchCursor { entry: number; word: number }

export function matchInVerse(slp: string, verse: VerseWordForWord, after?: MatchCursor): VerseMatch | null {
  const lex = buildLexicon(verse);
  const split = splitSandhi(slp, form => {
    const refs = lex.get(form);
    if (!refs) return null;
    // Whole listed words are the most certain reading; a member run next.
    const whole = refs.some(r => r.from === 0 && r.to === r.members - 1);
    return { cost: whole ? 0 : 0.3, info: refs };
  });
  if (!split) return null;
  const cursorRef = after ? { entry: after.entry, word: after.word, from: 0, to: 0, members: 1 } : undefined;
  const refs = chooseRefs(split.map(p => p.info), cursorRef);
  if (!refs) return null;
  const iast = (j: SandhiJoin | undefined) => (j ? { written: slp1ToIast(j.written), rule: j.rule } : null);
  const parts: VerseMatchPart[] = [];
  let last: Ref | null = null;
  refs.forEach((r, i) => {
    const { join, start } = split[i];
    // Members of one listed word ("dharma" + "kṣetre") show as that word
    // once; the join that counts is the one after its last member.
    if (last && last.entry === r.entry && last.word === r.word) {
      parts[parts.length - 1].join = iast(join);
      last = r;
      return;
    }
    const entry = verse.entries[r.entry];
    parts.push({ word: entry.words[r.word], entry, join: iast(join), start: iast(start) });
    last = r;
  });
  const lastRef = refs[refs.length - 1];
  return { verse: verse.title, parts, cursor: { entry: lastRef.entry, word: lastRef.word } };
}

