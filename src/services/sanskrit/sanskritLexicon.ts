import { allParticles, Particle } from '@/constants/sanskritParticles';
import { allGlossaryEntries, GlossaryEntry, lookupGlossary } from '@/constants/sanskritGlossary';
import { iastToSlp1, slp1ToIast } from './sanskritTranslit';
import { Recognizer, SandhiJoin, splitSandhi } from './sandhi';
import { analyseGrammar, CaseNo, Gender, NumberNo, PARADIGMS, suffixReadings, GrammarReading, presentParticipleRoot, stemCandidates } from './sanskritGrammar';
import { NOUN_GENDER } from '@/constants/sanskritGenders';
import { parseLexReadings } from './formLexicon';
import { ROOT_MEANINGS } from '@/constants/sanskritRoots';

/**
 * Offline sandhi-viccheda for Sanskrit words that the verse's own
 * word-for-word doesn't cover (a word in a purport, or a verse whose synonyms
 * aren't downloaded): split with ./sandhi.ts and give each piece a meaning
 * from, in order,
 *   1. the particle list (constants/sanskritParticles.ts),
 *   2. the curated glossary in Prabhupāda's sense (constants/sanskritGlossary.ts),
 *   3. Apte's dictionary (assets/dictionary/apte.dict), which Prabhupāda
 *      cites — shown as the range of meanings, not the sense in a verse.
 *
 * Pure (Apte comes in as a lookup function), so it runs under plain Node.
 */

export type PieceSource =
  | { kind: 'particle'; particle: Particle }
  | { kind: 'glossary'; entry: GlossaryEntry }
  | { kind: 'apte'; stem: string; senses: string[]; verb?: boolean };

export interface OfflinePiece {
  /** The word as it stood before sandhi, IAST ("eva", "kṣetre"). */
  word: string;
  /** Dictionary form it was found under, IAST, when that differs ("kṣetra"). */
  stem: string | null;
  source: PieceSource;
  /** Sandhi at its end / start, with `written` in IAST. */
  join: SandhiJoin | null;
  start: SandhiJoin | null;
}

/** Grammar of a separated word: a particle's own note, or readings of its
 * ending, best first. */
export type WordGrammar =
  | { kind: 'fixed'; note: string }
  | { kind: 'readings'; readings: GrammarReading[] };

const joinToIast = (j: SandhiJoin | undefined): SandhiJoin | null =>
  j ? { written: slp1ToIast(j.written), rule: j.rule } : null;

/** Apte lookup by SLP1 stem: its senses joined by \x1f, or null. */
export type ApteFind = (slp1: string) => string | null;

const MIN_STEM = 2;
const isVowelStart = (s: string) => /^[aAiIuUfFeEoO]/.test(s);
const ENDING_COST = 0.3;

// Verb endings on a bare root, with their cost as a reading: present
// (classes 1/4/6/10), future, gerund and infinitive — the forms that fill the
// verses. Longest first so "-ayiṣyāmi" is tried before "-āmi".
const VERB_ENDINGS: [string, number][] = ([
  ['ayizyAmi', 1.3], ['ayizyati', 1.3], ['izyAmi', 1.3], ['izyati', 1.3], ['syAmi', 1.3], ['syati', 1.3],
  ['ayanti', 1.3], ['ayati', 1.3], ['yanti', 1.3], ['yati', 1.3], ['anti', 1.4], ['ati', 1.4],
  ['yate', 1.4], ['ate', 1.5], ['Ami', 1.5], ['itvA', 1.3], ['tvA', 1.3], ['itum', 1.4], ['tum', 1.4],
  ['ya', 1.5],
] as [string, number][]).sort((a, b) => b[0].length - a[0].length);

/** Apte defines verb roots with an infinitive: "To go, move in general". */
const isRoot = (apteRaw: string) => /^To\s/.test(apteRaw);

const NASAL_FOR: Record<string, string> = {};
for (const [nasal, stops] of [['N', 'kKgG'], ['Y', 'cCjJ'], ['R', 'wWqQ'], ['n', 'tTdD'], ['m', 'pPbB']]) {
  for (const s of stops) NASAL_FOR[s] = nasal;
}
/** Anusvāra before a stop → that stop's own nasal ("saṁkīrtana" and
 * "saṅkīrtana" are one word), as scripts/build-apte.py does for its keys. */
const canonicalNasals = (slp: string) => slp.replace(/M(?=[kKgGcCjJwWqQtTdDpPbB])/g, (_, i) => NASAL_FOR[slp[i + 1]]);

/** SLP1 → the glossary's diacritic-free key. */
const plain = (slp: string) => slp1ToIast(slp).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

interface Found { stem: string; source: PieceSource; cost: number }

export class OfflineSanskrit {
  private particles = new Map<string, Particle>();
  private glossary = new Map<string, GlossaryEntry>();

  /** Apte's senses only (its grammar class, after \x1e, stripped). */
  private findApte: ApteFind;
  /** Apte's grammar class for a stem: m / f / n genders, "a" adjective. */
  private apteKind: (slp1: string) => string;

  /** The form lexicon (Vidyut readings), by SLP1 form. */
  private findForm: ApteFind;

  constructor(findApteRaw: ApteFind, findForm: ApteFind = () => null) {
    this.findForm = findForm;
    this.findApte = (k: string) => {
      const raw = findApteRaw(k);
      return raw == null ? null : raw.split('\x1e')[0];
    };
    this.apteKind = (k: string) => {
      const raw = findApteRaw(k);
      return raw == null ? '' : raw.split('\x1e')[1] ?? '';
    };
    for (const p of allParticles()) {
      const k = iastToSlp1(p.word);
      if (k) this.particles.set(k, p);
    }
    for (const g of allGlossaryEntries()) {
      const slp = iastToSlp1(g.term.replace(/-/g, ''));
      const k = slp && canonicalNasals(slp);
      if (k && !this.glossary.has(k)) this.glossary.set(k, g);
    }
  }

  /** A stem (dictionary form) in the glossary or Apte. */
  private stemHit(stem: string): Found | null {
    const g = this.glossary.get(stem);
    if (g) return { stem, source: { kind: 'glossary', entry: g }, cost: 0.2 };
    // The glossary's plain-ASCII aliases ("radha" → Rādhārāṇī) — a name the
    // glossary knows must never fall through to Apte's secular sense.
    // Names only (capitalised terms): for common nouns the stripped vowel
    // lengths are ambiguous ("daśa", ten, is not "dāsa").
    const alias = stem.length >= 4 ? lookupGlossary(plain(stem)) : null;
    if (alias && /^\p{Lu}/u.test(alias.term) && !alias.term.includes('-')) return { stem, source: { kind: 'glossary', entry: alias }, cost: 0.25 };
    if (stem.length < 3) return null; // Apte is full of two-letter roots nobody means
    const raw = this.findApte(stem);
    // A verb root ("To leave, quit…") is never a word by itself — only with a
    // verb ending (below). Letting it stand alone splits "parityajya" into
    // √parityaj + "yaḥ".
    if (raw && !isRoot(raw)) {
      // Short (three-letter) Apte stems are often rare words: allowed, but
      // not preferred over a longer reading; nor is a stem whose only
      // senses are a plant or an animal ("vāca: a kind of fish") over the
      // common word the same ending allows ("vāc: speech").
      const obscure = /^(?:A kind of|Name of a (?:plant|tree|fish|bird)|The plant)/.test(raw) ? 0.3 : 0;
      return { stem, source: { kind: 'apte', stem, senses: raw.split('\x1f') }, cost: (stem.length === 3 ? 1.0 : 0.8) + obscure };
    }
    // The negative prefix a- / an-: "avipaścit" (not wise) = a + vipaścit.
    const neg = stem.startsWith('an') && isVowelStart(stem.slice(2)) ? stem.slice(2) : stem.startsWith('a') ? stem.slice(1) : null;
    if (neg && neg.length >= 4) {
      const inner = this.stemHit(neg);
      if (inner && inner.source.kind !== 'particle') {
        const src = inner.source;
        const notWord = src.kind === 'glossary' ? src.entry.term : slp1ToIast(neg);
        return {
          stem,
          source: { kind: 'apte', stem, senses: [`not ${notWord}: a- (negative) + ${notWord}`, ...(src.kind === 'apte' ? src.senses : [src.entry.def])] },
          cost: inner.cost + 0.3,
        };
      }
    }
    return null;
  }

  /** Is this SLP1 form a word, and under which entry? */
  analyse(form: string): Found | null {
    const p = this.particles.get(form);
    if (p) return { stem: form, source: { kind: 'particle', particle: p }, cost: 0 };
    form = canonicalNasals(form);
    let best = this.stemHit(form);
    // Case endings, by the same paradigms the grammar analysis uses.
    for (const { stem } of stemCandidates(form)) {
      if (stem.length < MIN_STEM) continue;
      const hit = this.stemHit(stem);
      if (hit && (!best || hit.cost + ENDING_COST < best.cost)) best = { ...hit, cost: hit.cost + ENDING_COST };
    }
    // A finite verb: present-tense ending on a root Apte lists ("muhyati" ←
    // √muh). Only when nothing better matched — roots are the least certain.
    if (!best) {
      for (const [ending, cost] of VERB_ENDINGS) {
        if (form.length - ending.length < 3 || !form.endsWith(ending)) continue;
        const root = form.slice(0, -ending.length);
        const raw = this.findApte(root);
        if (raw && isRoot(raw)) return { stem: root, source: { kind: 'apte', stem: root, senses: raw.split('\x1f'), verb: true }, cost };
      }
    }
    return best;
  }

  private recognizer: Recognizer<Found> = (form, final) => {
    const hit = this.analyse(form);
    if (!hit) return null;
    // Inside a token a piece is a compound member or a word fused by vowel
    // sandhi; a bare stem is the normal shape there, an inflected one less so.
    const inflected = hit.stem !== form && hit.source.kind !== 'particle';
    return { cost: hit.cost + (!final && inflected ? 0.1 : 0), info: hit };
  };

  /**
   * Split an IAST token and explain each piece, or null if it can't be fully
   * accounted for (a partly-guessed split would be worse than none).
   */
  split(iast: string): OfflinePiece[] | null {
    const slp = iastToSlp1(iast);
    if (!slp) return null;
    const parts = splitSandhi(slp, this.recognizer);
    if (!parts) return null;
    return parts.map(({ form, info, join, start }) => ({
      word: slp1ToIast(form),
      stem: info.stem !== form ? slp1ToIast(info.stem) : null,
      source: info.source,
      join: joinToIast(join),
      start: joinToIast(start),
    }));
  }

  /** Is an SLP1 stem a word, and is it a verb root? For ./sanskritGrammar. */
  /** Is an SLP1 stem a verb root in Apte? */
  isRoot(stem: string): boolean {
    const k = canonicalNasals(stem);
    const raw = this.findApte(k);
    return (!!raw && isRoot(raw)) || k in ROOT_MEANINGS;
  }

  /** A stem's fixed gender(s), and whether it is an adjective. */
  kindOf(stem: string): { genders: Gender[]; adjective: boolean } {
    const k = canonicalNasals(stem);
    const fixed = NOUN_GENDER[k];
    if (fixed) return { genders: [fixed], adjective: false };
    const kind = this.apteKind(k);
    if (kind.includes('a')) return { genders: [], adjective: true };
    return { genders: [...kind].filter((c): c is Gender => c === 'm' || c === 'f' || c === 'n'), adjective: false };
  }

  private known = (stem: string): { known: boolean; root: boolean; senses?: string; genders?: Gender[]; adjective?: boolean; participleOf?: string } => {
    const k = canonicalNasals(stem);
    const kind = this.kindOf(k);
    const g = this.glossary.get(k);
    if (g) return { known: true, root: false, senses: g.def, ...kind };
    if (this.particles.has(k)) return { known: true, root: false };
    const raw = k.length >= 2 ? this.findApte(k) : null;
    if (raw) return { known: true, root: isRoot(raw) || k in ROOT_MEANINGS, senses: raw, ...kind };
    if (k in ROOT_MEANINGS) return { known: true, root: true, senses: ROOT_MEANINGS[k] };
    // A present participle (carat, "acting"): an adjective made from a root.
    const pp = /at$/.test(k) ? presentParticipleRoot(k, s => { const r = this.known(s); return { known: r.known, root: r.root }; }) : null;
    if (pp) return { known: true, root: false, adjective: true, genders: [], participleOf: pp.root };
    // The negative prefix a- / an- ("avipaścit" = a + vipaścit, not wise).
    const neg = k.startsWith('an') && isVowelStart(k.slice(2)) ? k.slice(2) : k.startsWith('a') ? k.slice(1) : null;
    if (neg && neg.length >= 3) {
      const inner = this.known(neg);
      if (inner.known && !inner.root) return inner;
    }
    return { known: false, root: false };
  };

  /**
   * Grammar of one separated word (IAST, as it stands after sandhi-viccheda).
   * In a compound only the last member takes an ending, so that is the one
   * analysed. `hint` is Prabhupāda's English for the word, when known.
   */
  grammar(iast: string, hint?: string | null, opts: { member?: boolean; stem?: string | null } = {}): WordGrammar | null {
    const members = iast.split('-');
    const last = members[members.length - 1];
    const slp = iastToSlp1(last);
    if (!slp) return null;
    const particle = members.length === 1 ? this.particles.get(slp) : undefined;
    if (particle) return { kind: 'fixed', note: particle.grammar };
    // Fused into the word after it, a bare stem is a compound member
    // ("bhoga" in bhogaiśvarya), not a vocative.
    if (opts.member) {
      const k = this.known(slp);
      const asAn = this.known(slp + 'n'); // ātma- ← ātman
      // A member has no ending: a bare stem, never a verb form or a gerund.
      if ((k.known && !k.root) || (asAn.known && !asAn.root) || /[aiu]$/.test(slp)) {
        return { kind: 'fixed', note: 'stem form — a member of the compound (samāsa), without an ending' };
      }
    }
    // -vas stems the lexicon lacks (a-vidvāṁsaḥ): the strong -vāṁs- stands
    // only in the masculine nominative / vocative / accusative; the ending says which.
    const vas = !this.findForm(slp) && slp.match(/^(.+v)AMs(aH|am|O)$/);
    if (vas) {
      const [c, n]: [CaseNo, NumberNo] = vas[2] === 'aH' ? [1, 2] : vas[2] === 'am' ? [2, 0] : [1, 1];
      return { kind: 'readings', readings: [{ kind: 'noun', stem: vas[1] + 'as', gender: ['m'], case: c, number: n, adjective: true, score: 1 }] };
    }
    const preferred = opts.stem ? iastToSlp1(opts.stem) : null;
    // A hyphenated word the lexicon knows whole (vibhūti-mat, guhya-tamam) is
    // one derived word; otherwise its last member carries the grammar.
    const whole = members.length > 1 ? iastToSlp1(iast.replace(/-/g, '')) : null;
    const wholeRaw = whole ? this.findForm(whole) : null;
    // guhya-tamam, vibhūti-mat: the suffix declines, the whole word is the stem.
    if (members.length > 1 && !wholeRaw) {
      const before = iastToSlp1(members.slice(0, -1).join('')) ?? '';
      const sfx = suffixReadings(slp, before, hint);
      if (sfx.length) return { kind: 'readings', readings: sfx };
    }
    const lexRaw = wholeRaw ?? this.findForm(slp);
    const readings = analyseGrammar(wholeRaw ? whole! : slp, this.known, hint, preferred ? canonicalNasals(preferred) : null,
      lexRaw ? parseLexReadings(lexRaw) : null, members.length > 1 && !wholeRaw);
    // -āḥ read only as a feminine ā-stem (samā "year") when the -a stem is an
    // adjective (sama "equal"): its masculine nominative / vocative plural is
    // the same form, and agreement with the verse's noun decides.
    const aStem = /AH$/.test(slp) ? readings.find(r => r.kind === 'noun' && /A$/.test(r.stem) && r.gender?.join('') === 'f') : undefined;
    if (aStem && !readings.some(r => r.kind === 'noun' && r.gender?.includes('m'))) {
      const base = aStem.stem.slice(0, -1) + 'a';
      const paradigm = PARADIGMS.find(x => x.id === 'a-m');
      if (this.kindOf(base).adjective && paradigm) {
        for (const r of readings.filter(x => x.kind === 'noun' && x.stem === aStem.stem && (x.case === 1 || x.case === 8))) {
          readings.push({ ...r, stem: base, gender: ['m'], paradigm, adjective: true, lex: undefined, score: r.score + 0.05 });
        }
        readings.sort((a, b) => a.score - b.score);
      }
    }
    return readings.length ? { kind: 'readings', readings } : null;
  }
}
