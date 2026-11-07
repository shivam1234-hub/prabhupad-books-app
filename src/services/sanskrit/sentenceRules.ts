/**
 * The sentence rules that let a reader put a verse back together once its
 * words are separated — agreement, fixed-vibhakti words, the passive,
 * yad … tad, free word order and the particles' positions — and a detector
 * that says which of them are at work in a given verse, and how.
 *
 * The detector reads only the grammar the analysis already found for each
 * word (case, number, gender, person), so it can point out, not prove: the
 * reader is shown the words that fit each rule.
 */

export interface RuleWord {
  word: string;
  /** "nominative" … "vocative", when the grammar names exactly one. */
  case: string | null;
  number: 'singular' | 'dual' | 'plural' | null;
  genders: string[];
  /** A finite verb's person (1 | 2 | 3) and number. */
  verb: { person: 1 | 2 | 3; number: 'singular' | 'dual' | 'plural'; passive: boolean; causative?: boolean } | null;
  /** aham / tvam and their forms: a person, never what an "of …" depends on. */
  personal?: boolean;
  /** A pronoun's stem ("yad", "tad"), when it is one. */
  pronoun: string | null;
  /** An adjective / participle: it describes a noun rather than naming one. */
  adjective: boolean;
  /** A gerund (-tvā / -ya, "having …"): non-finite, shares the main verb's doer. */
  gerund: boolean;
  /** The root of a verb or gerund (IAST), for verb-specific notes. */
  root?: string | null;
  /** A participle ("acting", "seeing"): an adjective that can take an object. */
  participle?: boolean;
  /** A past (passive) participle, kta: takes no object (except a goal with motion roots). */
  pastParticiple?: boolean;
  /** His English for the word, when known (some roles read it). */
  meaning?: string | null;
  /** A gerundive (kṛtya: -tavya, -anīya, -ya), "to be …-ed". */
  gerundive?: boolean;
  /** An infinitive ("to fight"): like a gerund, takes objects. */
  infinitive?: boolean;
  /** Line of the verse the word stands on (0-based), for half-verse clauses. */
  line?: number;
  /** Dictionary stem (IAST), when known — an -in agent stem is adjectival. */
  stem?: string | null;
  /** The stem wasn't found in any dictionary: weaker as a group's head. */
  unverified?: boolean;
  /** An ending that can be either case (neuter -am: nominative or accusative);
   * the sentence decides which (structure()). */
  caseOptions?: string[];
}

export interface SentenceRule {
  /** Rule number in the guide (1–9). */
  no: number;
  title: string;
  /** How it shows in this verse, in a sentence or two. */
  text: string;
}

/** Words that force a vibhakti on the noun beside them (upapada-vibhakti). */
export const UPAPADA: { word: string; forces: string[]; sense: string; example: string }[] = [
  { word: 'prati', forces: ['accusative'], sense: 'towards', example: 'gṛhaṁ prati — towards the house' },
  { word: 'anu', forces: ['accusative'], sense: 'after', example: 'rāmam anu — after Rāma' },
  { word: 'saha', forces: ['instrumental'], sense: 'with', example: 'rāmeṇa saha — with Rāma' },
  { word: 'sārdham', forces: ['instrumental'], sense: 'with', example: 'rāmeṇa sārdham — with Rāma' },
  { word: 'vinā', forces: ['accusative', 'instrumental', 'ablative'], sense: 'without', example: 'jalaṁ vinā — without water' },
  { word: 'namaḥ', forces: ['dative'], sense: 'salutation', example: 'gaṇeśāya namaḥ — salutations to Gaṇeśa' },
  { word: 'svasti', forces: ['dative'], sense: 'well-being to', example: 'prajābhyaḥ svasti — well-being to the people' },
  { word: 'svāhā', forces: ['dative'], sense: 'offering to', example: 'agnaye svāhā — offering to Agni' },
  { word: 'ṛte', forces: ['ablative'], sense: 'except', example: 'jñānāt ṛte — except knowledge' },
  { word: 'upari', forces: ['genitive'], sense: 'above', example: 'vṛkṣasya upari — above the tree' },
  { word: 'adhaḥ', forces: ['genitive'], sense: 'below', example: 'vṛkṣasya adhaḥ — below the tree' },
];

// Roots whose active forms take no direct object (to be, become, stand, sit,
// lie, turn, be born, die, live, dwell, sink, fall, rise, fear, rejoice).
const INTRANSITIVE = new Set(['as', 'bhū', 'sthā', 'ās', 'śī', 'vṛt', 'jan', 'mṛ', 'jīv', 'vas', 'sad', 'pat', 'ruh',
  'bhī', 'hṛṣ', 'śam', 'śuc', 'muh', 'kup', 'klam', 'svap', 'nand', 'ram', 'lasa', 'dīp', 'bhā', 'rāj']);
const MOTION = new Set(['gam', 'yā', 'i', 'vraj', 'car', 'pad', 'āp', 'labh', 'viś', 'nī', 'dhāv', 'sṛ']);

/** Can this word take a direct object? A finite verb in the active of a
 * transitive root, a gerund / infinitive / present participle, or a past
 * participle of a motion root (gataḥ … prakṛtim: the goal). */
function isTransitiveAction(w: RuleWord): boolean {
  const root = (w.root ?? '').replace(/^√/, '');
  // A causative always takes an object: janayet, "he should cause (confusion)".
  if (w.verb) return !w.verb.passive && (!!w.verb.causative || !INTRANSITIVE.has(root));
  if (w.gerund || w.infinitive) return true;
  if (w.pastParticiple) return MOTION.has(root);
  if (w.participle) return !INTRANSITIVE.has(root);
  // Desideratives in -u take an object like a verb (cikīrṣuḥ loka-saṅgraham, 2.3.69).
  if (/(ṣ|s)u$/.test(w.stem ?? '') && /^(ci|ji|mu|di|bu|pi|li|śu|ti)/.test(w.stem ?? '')) return true;
  return false;
}

const list = (ws: string[]) => ws.length <= 2 ? ws.join(' and ') : `${ws.slice(0, -1).join(', ')} and ${ws[ws.length - 1]}`;
const gendersMeet = (a: string[], b: string[]) => !a.length || !b.length || a.some(g => b.includes(g));
/** The sarvādi words declined like pronouns but used as adjectives (1.1.27). */
export const SARVADI = new Set(['sarva', 'viśva', 'ubhaya', 'anya', 'anyatara', 'itara', 'eka', 'sva', 'para', 'apara', 'pūrva',
  'uttara', 'dakṣiṇa', 'adhara', 'katara', 'katama', 'sama', 'sima', 'tvat', 'nema']);
const CONNECTIVES = new Set(['ca', 'api', 'eva', 'hi', 'tu', 'vā', 'iva', 'ha', 'sma', 'vai', 'nu']);

export type MappedWord = RuleWord & { meaning: string | null };

export interface MapWord { word: string; meaning: string | null; /** "who say “na anyat asti”" */ says?: string }

export interface MapGroup {
  /** "masculine nominative plural". */
  label: string;
  head: MapWord;
  /** Words that describe or rename the head (same gender, number, vibhakti). */
  descriptions: MapWord[];
  /** Pronouns pointing to it (yām, imām). */
  pointers: MapWord[];
  /** Genitives that depend on it: "of the senses" on ucchoṣaṇam. */
  genitives: MapWord[];
}

export interface MapClause {
  /** "main clause", "relative clause (ye …)", "clause: object of prapaśyāmi". */
  kind: string;
  verb: MapWord;
  /** The doer's group, or null when the ending itself names it ("I"). */
  doer: MapGroup | null;
  /** "I (from the ending of pravakṣyāmi)" when no doer word is present. */
  impliedDoer: string | null;
  objects: { group: MapGroup; note?: string }[];
  /** Gerunds sharing this clause's doer, each with its own objects. */
  gerunds: { word: MapWord; objects: { group: MapGroup; note?: string }[] }[];
  /** Further doers joined by ca. */
  coDoers: MapGroup[];
  /** A nominal sentence's predicates: what the subject is. */
  predicates?: MapGroup[];
  /** Further words naming the same doer (samānādhikaraṇa). */
  sameDoer?: MapGroup[];
}

export interface SentenceMap {
  /** One entry per finite verb: who does it, to what. */
  clauses: MapClause[];
  doers: MapGroup | null;
  /** Finite verbs of the sentence (not those inside a quotation). */
  verbs: MapWord[];
  /** Gerunds (-tvā / -ya): "having …", sharing the main verb's doer. */
  gerunds: MapWord[];
  /** Each object with the verb or gerund it belongs to. */
  objects: { group: MapGroup; verb: string | null; note?: string }[];
  /** A quotation closed by iti, with its own verb: "na anyat asti". */
  quoted: { words: string; verbs: string[] } | null;
  /** Each input word's part in the map (doer of …, said of …), by position. */
  roleAt?: (string | null)[];
  /** A yad-clause that is itself the object of the main verb. */
  clauseObject: { from: string; to: string; of: string } | null;
  /** A relative clause and the noun it describes (null: "those who …"). */
  relative: { from: string; to: string; describes: string | null } | null;
  governed: { word: MapWord; by: string; sense: string }[];
  addressed: MapWord[];
  /** Other groups by case ("in / on", "by / with"). */
  others: { label: string; groups: MapGroup[] }[];
  /** "Ask who?": each description, what it describes, and why. */
  askWho: { word: string; describes: string; why: string }[];
  /** Genitive dependencies: indriyāṇām → ucchoṣaṇam. */
  depends: { word: string; on: string }[];
}

/** Everything the rules and the map need, worked out once. */
interface Structure {
  words: MappedWord[];
  inQuote: Set<MappedWord>;
  quoteWords: MappedWord[];
  governed: Map<MappedWord, typeof UPAPADA[number]>;
  finite: MappedWord[];
  gerunds: MappedWord[];
  mainVerb: MappedWord | null;
  /** Head word → its group. */
  groups: Map<MappedWord, { members: MappedWord[]; pointers: MappedWord[]; genitives: MappedWord[] }>;
  /** A word → the head it belongs to. */
  headOf: Map<MappedWord, MappedWord>;
  /** Accusative head → the verb / gerund it belongs to. */
  objectVerb: Map<MappedWord, MappedWord | null>;
  yadClause: { yad: MappedWord; verb: MappedWord; main: MappedWord } | null;
  /** A relative clause: yat … mokṣyase describing jñānam; ye … paryupāsate. */
  relative: { yad: MappedWord; verb: MappedWord; noun: MappedWord | null } | null;
  clauseOf: (w: MappedWord) => MappedWord | null;
  /** Genitives that name the doer of a kta / kṛtya beside them. */
  agentOf: Map<MappedWord, MappedWord>;
}

/** Distance between two words, not counting the small connectives. */
function distance(words: MappedWord[], a: number, b: number): number {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  let d = 0;
  for (let i = lo + 1; i <= hi; i++) if (!CONNECTIVES.has(words[i].word)) d++;
  return d;
}

function nearest(words: MappedWord[], from: MappedWord, pool: MappedWord[]): MappedWord | null {
  const i = words.indexOf(from);
  let best: MappedWord | null = null;
  let bestD = Infinity;
  for (const w of pool) {
    const j = words.indexOf(w);
    const d = distance(words, i, j);
    // A tie goes to the word that follows ("surāṇām … ādhipatyam").
    if (d < bestD || (d === bestD && j > i)) { best = w; bestD = d; }
  }
  return best;
}

function structure(words: MappedWord[]): Structure {
  // Fixed-vibhakti words: gatim ← prati.
  const governed = new Map<MappedWord, typeof UPAPADA[number]>();
  words.forEach((w, i) => {
    const u = UPAPADA.find(x => x.word === w.word);
    const near = u && [words[i - 1], words[i + 1]].filter(Boolean).find(x => x.case && u.forces.includes(x.case));
    if (u && near) governed.set(near, u);
  });

  const finiteAll = words.filter(w => w.verb);
  // The quotation closed by iti: back from iti to the word that belongs to
  // the outer sentence (someone addressed, a gerund, or a doer of the outer verb).
  const inQuote = new Set<MappedWord>();
  const quoteWords: MappedWord[] = [];
  const itiAt = words.findIndex(w => w.word === 'iti');
  if (itiAt > 0) {
    const outerVerb = finiteAll.filter(v => words.indexOf(v) > itiAt).pop() ?? null;
    for (let i = itiAt - 1; i >= 0 && quoteWords.length < 5; i--) {
      const w = words[i];
      if (w.case === 'vocative' || w.gerund) break;
      if (outerVerb && w.case === 'nominative' && w.number === outerVerb.verb?.number && !w.pronoun) break;
      quoteWords.unshift(w);
      inQuote.add(w);
    }
    // A quotation needs its own verb or a negation / statement; otherwise it isn't one.
    if (!quoteWords.some(w => w.verb) && quoteWords.length > 2) { quoteWords.length = 0; inQuote.clear(); }
  }

  const finite = finiteAll.filter(w => !inQuote.has(w));
  const sameHalf = (a: MappedWord, b: MappedWord) =>
    a.line === undefined || b.line === undefined || Math.floor(a.line / 2) === Math.floor(b.line / 2);

  // Words whose ending allows nominative or accusative (neuter -am, yat):
  // a 3rd-person verb without a clear subject takes one as its doer (a
  // pronoun first: yat for apanudyāt); the rest are objects — but only
  // when something in the sentence can take an object. With √as / √bhū, a
  // passive, or no verb at all, they are nominative.
  const transitiveActions = words.filter(w => !inQuote.has(w) && isTransitiveAction(w));
  const ambiguous = words.filter(w => w.caseOptions?.length && !inQuote.has(w));
  for (const v of finite.filter(x => x.verb!.person === 3)) {
    const hasSubject = words.some(w => w.case === 'nominative' && w.number === v.verb!.number && !inQuote.has(w));
    if (hasSubject) continue;
    const pool = ambiguous.filter(w => !w.case && w.number === v.verb!.number);
    const pick = nearest(words, v, pool.filter(w => w.pronoun)) ?? nearest(words, v, pool);
    if (pick) pick.case = 'nominative';
  }
  // Accusative only when something that takes an object is its own: the
  // finite verb of its half-verse (nearest), or a gerund / infinitive /
  // participle close by. sattvam … viddhi is an object; tat tat … māti
  // ("it was enough") is not.
  for (const w of ambiguous) {
    if (w.case) continue;
    const local = finite.filter(v => sameHalf(v, w));
    const ownVerb = nearest(words, w, local.length ? local : finite);
    const verbTakes = !!ownVerb && isTransitiveAction(ownVerb) && (sameHalf(ownVerb, w) || distance(words, words.indexOf(ownVerb), words.indexOf(w)) <= 6);
    const nonFinite = transitiveActions.some(a => !a.verb && distance(words, words.indexOf(a), words.indexOf(w)) <= 3);
    w.case = verbTakes || nonFinite ? 'accusative' : 'nominative';
  }
  const gerunds = words.filter(w => w.gerund && !inQuote.has(w));
  const nominal = (w: MappedWord) => !!w.case && !w.verb && !w.gerund && !inQuote.has(w);

  // Heads: nouns name things; adjectives and pronouns attach to a noun that
  // agrees with them (nearest), and become heads only when no noun does.
  const groups: Structure['groups'] = new Map();
  const headOf = new Map<MappedWord, MappedWord>();
  const agree = (a: MappedWord, b: MappedWord) => a.case === b.case && a.number === b.number && gendersMeet(a.genders, b.genders);
  const nouns = words.filter(w => nominal(w) && !w.adjective && !w.pronoun && w.case !== 'genitive' && w.case !== 'vocative');
  for (const n of nouns) { groups.set(n, { members: [n], pointers: [], genitives: [] }); headOf.set(n, n); }
  // Genitive nouns can take their own adjectives (avyayasya … brahmaṇaḥ).
  const genitiveNouns = words.filter(w => nominal(w) && !w.adjective && !w.pronoun && w.case === 'genitive');
  for (const n of genitiveNouns) { groups.set(n, { members: [n], pointers: [], genitives: [] }); headOf.set(n, n); }
  nouns.push(...genitiveNouns);
  // A nominative relative or correlative pronoun (yaḥ … saḥ) is the subject
  // of its own clause, not a word pointing into another clause's noun.
  const ownHead = (w: MappedWord) => (w.pronoun === 'yad' || w.pronoun === 'tad' || w.pronoun === 'etad') && w.case === 'nominative';
  for (const w of words.filter(x => nominal(x) && (x.adjective || x.pronoun) && x.case !== 'vocative')) {
    if (ownHead(w)) { groups.set(w, { members: [w], pointers: [], genitives: [] }); headOf.set(w, w); continue; }
    // Describing words of the doer may range over the whole verse (and past
    // it); others describe a noun near them — not one three lines away.
    // Distance to a noun counts from the nearest word already describing it,
    // so a list of describing words continues with the same noun across a
    // line (akṣaram … sarvatra-gam acintyam ca kūṭa-stham acalaṁ dhruvam).
    const reach = (n: MappedWord) => Math.min(...[n, ...(groups.get(n)?.members ?? []), ...(groups.get(n)?.pointers ?? [])]
      .map(m => distance(words, words.indexOf(m), words.indexOf(w))));
    const limit = w.pronoun ? 6 : 4;
    // Near nouns compete; when no noun is near, the only noun that agrees at
    // all is the one (2.43's bahulām reaching back to vācam in 2.42).
    const agreeing = nouns.filter(n => agree(n, w) && !governed.has(n));
    // A list of adjectives already under way (akṣaram, anirdeśyam, avyaktam …)
    // is a candidate too: kūṭa-stham continues it rather than jumping to a
    // noun further on.
    const lists = [...groups.keys()].filter(k => (k.adjective || (k.pronoun && k.pronoun !== 'yad'))
      && agree(k, w) && !governed.has(k) && reach(k) <= limit);
    const nearOnes = [...agreeing.filter(n => w.case === 'nominative' || reach(n) <= limit), ...lists];
    const candidates = nearOnes.length ? nearOnes : agreeing.length === 1 ? agreeing : [];
    const head = candidates.length
      ? candidates.reduce((a, b) => (reach(b) < reach(a) || (reach(b) === reach(a) && words.indexOf(b) > words.indexOf(a)) ? b : a))
      : null;
    if (head) {
      const g = groups.get(head) ?? (groups.set(head, { members: [head], pointers: [], genitives: [] }), groups.get(head)!);
      if (w.pronoun) g.pointers.push(w); else g.members.push(w);
      headOf.set(w, head);
    } else if (w.case !== 'genitive') {
      groups.set(w, { members: [w], pointers: [], genitives: [] });
      headOf.set(w, w);
    }
  }
  // Adjective-only groups that agree with each other are one group
  // (kāmātmānaḥ, svarga-parāḥ describing the same unwise people).
  for (const [h, g] of [...groups].sort((a, b) => words.indexOf(b[0]) - words.indexOf(a[0]))) {
    // A relative / correlative pronoun belongs to its own clause, not the main doer.
    if ((!h.adjective && !h.pronoun) || ownHead(h)) continue;
    // Into a real noun if one agrees, else into the earliest agreeing group
    // (avipaścitaḥ leads kāmātmānaḥ, svarga-parāḥ …).
    const agreeingAll = [...groups.keys()].filter(k => k !== h && agree(k, h) && groups.has(k) && !governed.has(k));
    const agreeingNear = agreeingAll.filter(k => h.case === 'nominative' || distance(words, words.indexOf(k), words.indexOf(h)) <= 4);
    const agreeing = agreeingNear.length ? agreeingNear
      : agreeingAll.filter(k => !k.adjective && !k.pronoun).length === 1 ? agreeingAll.filter(k => !k.adjective && !k.pronoun) : [];
    const other = agreeing.find(k => !k.adjective && !k.pronoun)
      ?? agreeing.filter(k => words.indexOf(k) < words.indexOf(h)).sort((a, b) => words.indexOf(a) - words.indexOf(b))[0];
    if (other) {
      groups.get(other)!.members.push(...g.members);
      groups.get(other)!.pointers.push(...g.pointers);
      for (const m of [...g.members, ...g.pointers]) headOf.set(m, other);
      groups.delete(h);
    }
  }
  // The word that names the thing heads its group: a noun before a plain
  // adjective, before a participle (rāga-dveṣa-vimuktaiḥ … indriyaiḥ: "by
  // the senses, freed …"), before a sarvādi word (sarveṣu bhūteṣu).
  const rank = (w: MappedWord) => !w.adjective && !w.pronoun ? 0
    : w.pronoun ? 4 : SARVADI.has(w.stem ?? '') ? 3 : w.participle || w.pastParticiple ? 2 : w.word.includes('-') ? 1.5 : 1;
  for (const [h, g] of [...groups]) {
    if (ownHead(h)) continue;
    const best = g.members.reduce((a, b) => (rank(b) < rank(a) ? b : a), h);
    if (best === h) continue;
    groups.delete(h);
    groups.set(best, g);
    for (const m of [...g.members, ...g.pointers, ...g.genitives]) headOf.set(m, best);
  }
  // Nominative nouns that agree in number with the main verb name the same
  // doer (samānādhikaraṇa) unless ca joins them — then they are two doers.
  const verbFor = (w: MappedWord) => finite.find(v => v.verb!.person === 3) ?? finite[0] ?? null;
  const mainVerb = finite.length ? finite[finite.length - 1] : null;
  const noms = [...groups.keys()].filter(h => h.case === 'nominative');
  if (noms.length > 1 && !words.some(w => w.word === 'ca')) {
    noms.sort((a, b) => words.indexOf(a) - words.indexOf(b));
    // The head is a noun the dictionary knows (buddhiḥ), not an unverified
    // form that only looks like one (vyavasāyātmikā).
    const plainNoms = noms.filter(n => !ownHead(n));
    // A real noun leads — not an adjective, participle, or -in agent word
    // (āhārāḥ, not vidāhinaḥ).
    const leader = plainNoms.find(n => !n.adjective && !n.pronoun && !n.unverified && !n.participle && !/in$/.test(n.stem ?? ''))
      ?? plainNoms.find(n => !n.adjective && !n.pronoun && !n.unverified) ?? plainNoms[0];
    const first = leader;
    const rest = leader ? plainNoms.filter(n => n !== leader) : [];
    for (const r of rest) {
      if (!first || r.number !== first.number) continue;
      const g = groups.get(r)!;
      groups.get(first)!.members.push(...g.members);
      groups.get(first)!.pointers.push(...g.pointers);
      for (const m of [...g.members, ...g.pointers]) headOf.set(m, first);
      groups.delete(r);
    }
  }
  void verbFor;

  // A compound heading a group is usually an epithet (a bahuvrīhi such as
  // kāmātmānaḥ, "whose self is desire"): the earliest plain word of the group
  // names the person it describes (avipaścitaḥ), so that word leads.
  for (const [h, g] of [...groups]) {
    if (!h.word.includes('-') || h.pronoun || h.case !== 'nominative') continue;
    // …but never a participle ("caran", acting): it describes, it doesn't name.
    const plain = g.members.filter(m => !m.word.includes('-') && !m.unverified && !m.participle)
      .sort((a, b) => words.indexOf(a) - words.indexOf(b))[0];
    if (!plain) continue;
    groups.delete(h);
    groups.set(plain, g);
    for (const m of [...g.members, ...g.pointers]) headOf.set(m, plain);
  }

  // A genitive can be the doer: of a kta of thinking / knowing / honouring
  // (mama matam, "thought by Me", 2.3.67 with 3.2.188), or of a kṛtya
  // (me dveṣyaḥ, "to be hated by Me", 2.3.71).
  const agentOf = new Map<MappedWord, MappedWord>();
  for (const gword of words.filter(w => nominal(w) && w.case === 'genitive')) {
    const i = words.indexOf(gword);
    const by = words.find(w => w !== gword && Math.abs(words.indexOf(w) - i) <= 2
      && (w.gerundive || (w.pastParticiple && ['man', 'budh', 'jñā', 'pūj', 'arc', 'iṣ', 'vid'].includes((w.root ?? '').replace(/^√/, '')))));
    if (by) agentOf.set(gword, by);
  }
  // Genitives depend on a noun ("drying up of the senses"), never on each other.
  for (const gword of words.filter(w => nominal(w) && w.case === 'genitive' && !agentOf.has(w))) {
    // A noun, not a pronoun: "mama" is "my grief" (śokam), not "my which".
    const pool = words.filter(w => nominal(w) && w.case !== 'genitive' && w.case !== 'vocative' && !w.pronoun && !w.personal);
    // A noun near it (within the half-verse), before an adjective or participle.
    const nounsNear = pool.filter(w => !w.adjective && !w.participle && sameHalf(w, gword));
    const on = nearest(words, gword, nounsNear) ?? nearest(words, gword, pool);
    if (on) {
      const head = headOf.get(on) ?? on;
      groups.get(head)?.genitives.push(gword);
      // "Of …" belongs to the noun of the group, not the adjective beside it
      // (tava saumyam … rūpam: "Your form").
      headOf.set(gword, groups.has(head) ? head : on);
    }
  }

  // Each object (accusative head) with its verb: the nearest finite verb,
  // gerund or participle (viṣayān … caran, "acting upon the sense objects").
  const objectVerb = new Map<MappedWord, MappedWord | null>();
  for (const h of groups.keys()) {
    if (h.case !== 'accusative' || governed.has(h)) continue;
    // Never the word itself or one describing it (ghnataḥ is not its own
    // object); a participle only when it stands close — otherwise the verb.
    const own = new Set([h, ...(groups.get(h)?.members ?? [])]);
    // A participle he renders as a person ("a learned person") names, it doesn't act.
    const takers = transitiveActions.filter(a => !own.has(a)
      && (a.verb || a.gerund || a.infinitive || (distance(words, words.indexOf(a), words.indexOf(h)) <= 3 && !/^(a|an|the)\s/i.test(a.meaning ?? ''))));
    const local = takers.filter(a => sameHalf(a, h));
    // A transitive finite verb on the object's own line comes first (sarva-karmāṇi … joṣayet).
    const sameLine = takers.filter(a => a.verb && a.line !== undefined && a.line === h.line);
    const pool = sameLine.length ? sameLine : local.length ? local : takers;
    objectVerb.set(h, pool.length ? nearest(words, h, pool) : null);
  }

  // A yad-clause (yat … apanudyāt) that is itself the object of the other
  // verb: only a neuter yat ("what") that describes no noun. A yad that
  // agrees with a noun (yat → jñānam) or is a doer (ye …) makes a relative
  // clause describing that noun / answered by tad.
  let yadClause: Structure['yadClause'] = null;
  let relative: Structure['relative'] = null;
  const yad = words.find(w => w.pronoun === 'yad');
  const tad = words.some(w => w.pronoun === 'tad' || w.pronoun === 'etad');
  if (yad && finite.length >= 2) {
    const verb = nearest(words, yad, finite)!;
    const main = finite.find(v => v !== verb)!;
    const noun = headOf.get(yad);
    if (noun && noun !== yad) relative = { yad, verb, noun };
    else if (!tad && yad.caseOptions?.length && yad.number === 'singular') yadClause = { yad, verb, main };
    else relative = { yad, verb, noun: null };
  }

  // The main verb is the one outside a yad-clause (prapaśyāmi, not apanudyāt):
  // a gerund shares its doer.
  const main = yadClause ? yadClause.main : relative ? finite.find(v => v !== relative!.verb) ?? mainVerb : mainVerb;
  // Each word's clause: the finite verb of its own half-verse when it has
  // one, else the nearest finite verb.
  const clauseOf = (w: MappedWord): MappedWord | null => {
    const local = finite.filter(v => sameHalf(v, w));
    const pool = local.length ? local : finite;
    return pool.length ? nearest(words, w, pool) : null;
  };
  return { words, inQuote, quoteWords, governed, finite, gerunds, mainVerb: main, groups, headOf, objectVerb, yadClause, relative, clauseOf, agentOf };
}

/** The group's gender: the head's own when it has one, else the gender most
 * of its words share (one stray reading doesn't relabel the group). */
const genderOfGroup = (members: RuleWord[]) => {
  if (members[0]?.genders.length === 1) return members[0].genders[0];
  const counts = new Map<string, number>();
  for (const m of members) for (const g of m.genders) counts.set(g, (counts.get(g) ?? 0) + 1);
  const best = [...counts].sort((a, b) => b[1] - a[1]);
  return best.length && (best.length === 1 || best[0][1] > best[1][1]) ? best[0][0] : undefined;
};

function toGroup(st: Structure, head: MappedWord): MapGroup {
  const g = st.groups.get(head)!;
  const words = st.words;
  const said = (w: MappedWord): string | undefined => {
    const i = words.indexOf(w);
    if (words[i - 1]?.word !== 'iti' || w.case !== 'nominative' || !st.quoteWords.length) return undefined;
    return `who say “${st.quoteWords.map(x => x.word).join(' ')}”`;
  };
  const m = (w: MappedWord): MapWord => ({ word: w.word, meaning: w.meaning, says: said(w) });
  const gender = genderOfGroup([head, ...g.members.filter(x => x !== head)]);
  return {
    label: `${gender ? `${gender} ` : ''}${head.case} ${head.number ?? ''}`.trim(),
    head: m(head),
    descriptions: g.members.filter(x => x !== head).map(m),
    pointers: g.pointers.map(m),
    genitives: g.genitives.map(m),
  };
}

/** The tad that answers a yad: the same gender and number (its case is its
 * own clause's), the nearest such; else the nearest tad at all. */
function tadPartner(words: MappedWord[], yad: MappedWord): MappedWord | null {
  const tads = words.filter(w => (w.pronoun === 'tad' || w.pronoun === 'etad') && w !== yad);
  const agreeing = tads.filter(t => t.number === yad.number && gendersMeet(t.genders, yad.genders));
  return nearest(words, yad, agreeing.length ? agreeing : tads);
}

/** Relative adverbs and their correlatives: yathā … tathā ("as … so"). */
const CORRELATIVES: Record<string, { partners: string[]; sense: string }> = {
  yathā: { partners: ['tathā', 'evam'], sense: 'as … so' },
  yadā: { partners: ['tadā'], sense: 'when … then' },
  yatra: { partners: ['tatra'], sense: 'where … there' },
  yāvat: { partners: ['tāvat'], sense: 'as long as … so long' },
  yataḥ: { partners: ['tataḥ'], sense: 'from where … from there' },
  yadi: { partners: ['tarhi', 'tadā', 'tataḥ'], sense: 'if … then' },
  cet: { partners: ['tarhi', 'tadā', 'tataḥ'], sense: 'if … then' },
};

/** A subordinate clause opened by a relative adverb (yadā …), and its partner. */
function adverbialClause(st: Structure, v: MappedWord): { rel: MappedWord; partner: MappedWord | null } | null {
  const rel = st.words.find(w => CORRELATIVES[w.word] && st.clauseOf(w) === v);
  if (!rel || st.finite.length < 2) return null;
  const partner = st.words.find(w => CORRELATIVES[rel.word].partners.includes(w.word) && st.clauseOf(w) !== v) ?? null;
  return { rel, partner };
}

const CASE_ROLE: Record<string, string> = {
  instrumental: 'by / with', dative: 'for / to', ablative: 'from', locative: 'in / on',
};

/** The shape of the sentence, as the verse's endings show it. */
export function buildSentenceMap(input: MappedWord[]): SentenceMap {
  const words = input.map(w => ({ ...w }));
  const st = structure(words);
  const heads = [...st.groups.keys()].sort((a, b) => words.indexOf(a) - words.indexOf(b));
  const nomHead = heads.find(h => h.case === 'nominative') ?? null;
  const objects = heads.filter(h => h.case === 'accusative' && !st.governed.has(h)).map(h => {
    const verb = st.objectVerb.get(h) ?? null;
    const vac = verb?.root === 'vac' && h.genders.includes('masculine');
    return {
      group: toGroup(st, h),
      verb: verb?.word ?? null,
      // √vac takes two objects: the person spoken to and the words said.
      note: vac ? `the person spoken to — √vac takes two objects (dvikarmaka): the one addressed and what is said` : undefined,
    };
  });
  const askWho: SentenceMap['askWho'] = [];
  for (const h of heads) {
    const g = st.groups.get(h)!;
    for (const d of [...g.members.filter(x => x !== h), ...g.pointers]) {
      askWho.push({ word: d.word, describes: h.word, why: `${toGroup(st, h).label}, matching ${h.word}` });
    }
  }
  const others: SentenceMap['others'] = [];
  // What an oblique word does, when the sentence shows it: the doer of a
  // passive (taiḥ … dattān, "given by them"), the receiver of √dā, or a
  // locative absolute (kalau sampravṛtte, "when Kali has begun").
  const obliqueRole = (h: MappedWord): string | null => {
    const i = words.indexOf(h);
    const near = (w: MappedWord) => Math.abs(words.indexOf(w) - i) <= 4;
    if (h.case === 'instrumental') {
      const v = st.clauseOf(h);
      if (v?.verb?.passive) return `instrumental — the doer of the passive ${v.word} (anukta kartā, 2.3.18)`;
      // A kta used as a verb ("given", "remembered"), not as a noun
      // (jīvitena, "life"), nor with a sense of parting or joining (vimuktaḥ
      // "freed from", yuktaḥ "endowed with").
      const kta = words.find(w => w.pastParticiple && (w.case === 'nominative' || w.case === 'accusative')
        && !MOTION.has((w.root ?? '').replace(/^√/, '')) && !['muc', 'yuj', 'hā', 'tyaj'].includes((w.root ?? '').replace(/^√/, ''))
        && /\b(\w{3,}ed|given|done|made|known|seen|born|spoken|said|told|taken|held|heard|brought|sent|thought|taught|bound|kept|won)\b/i.test(w.meaning ?? '')
        && !/\bfrom\b/i.test(w.meaning ?? '') && near(w) && w !== h && !st.groups.get(h)?.members.includes(w));
      if (kta) return `instrumental — by whom: the doer of ${kta.word} (2.3.18)`;
    }
    if (h.case === 'dative') {
      const v = st.clauseOf(h);
      const giver = [v, ...st.gerunds].find(w => w && (w.root ?? '').replace(/^√/, '') === 'dā');
      if (giver) return `dative — the receiver of ${giver.word} (sampradāna, 1.4.32)`;
    }
    if (h.case === 'locative') {
      const g = st.groups.get(h);
      const part = [h, ...(g?.members ?? [])].find(w => w.participle || w.pastParticiple);
      if (part && g && g.members.length > 1) return `locative absolute — "when / while …": ${part.word} tells what is happening (sati saptamī, 2.3.37)`;
    }
    return null;
  };
  for (const c of Object.keys(CASE_ROLE)) {
    const hs = heads.filter(h => h.case === c && !st.governed.has(h));
    const plain = hs.filter(h => !obliqueRole(h)).map(h => toGroup(st, h));
    if (plain.length) others.push({ label: `${c} (${CASE_ROLE[c]})`, groups: plain });
    for (const h of hs.filter(x => obliqueRole(x))) others.push({ label: obliqueRole(h)!, groups: [toGroup(st, h)] });
  }
  for (const [gw, by] of st.agentOf) {
    others.push({ label: `genitive — the doer of ${by.word}, "by …" (${by.gerundive ? 'kṛtya, 2.3.71' : 'kta, 2.3.67'})`, groups: [toGroup(st, gw)] });
  }
  const depends: SentenceMap['depends'] = [];
  for (const w of words.filter(x => x.case === 'genitive')) {
    const on = st.headOf.get(w);
    if (on) depends.push({ word: w.word, on: on.word });
  }
  // One clause per finite verb.
  const objectNote = (h: MappedWord, verb: MappedWord | null) =>
    verb?.root === 'vac' && h.genders.includes('masculine')
      ? 'the person spoken to — √vac takes two objects (dvikarmaka): the one addressed and what is said' : undefined;
  const usedDoers = new Set<MappedWord>();
  const roleAt = new Map<MappedWord, string>();
  const nomHeads = heads.filter(h => h.case === 'nominative');
  const FIRST = new Set(['aham', 'vayam', 'āvām']);
  const SECOND = new Set(['tvam', 'yūyam', 'yuvām']);
  const personOf = (h: MappedWord): 1 | 2 | 3 => (FIRST.has(h.word) ? 1 : SECOND.has(h.word) ? 2 : 3);
  const coordinated = words.some(w => w.word === 'ca');
  const clauses: MapClause[] = st.finite.map(v => {
    const person = v.verb!.person;
    const numberName = v.verb!.number;
    const inRelative = st.relative?.verb === v || st.yadClause?.verb === v;
    // Doer candidates: nominatives of this verb's own clause that agree in
    // person and number (aham only with a 1st-person verb).
    const pool = nomHeads.filter(h => !usedDoers.has(h) && st.clauseOf(h) === v && personOf(h) === person
      && (h.number === numberName || (numberName !== 'singular' && coordinated)));
    let doerHeads: MappedWord[] = [];
    if (inRelative) {
      const y = pool.find(h => h.pronoun === 'yad') ?? (st.yadClause?.verb === v && st.yadClause.yad.case === 'nominative' ? st.yadClause.yad : null);
      doerHeads = y ? [y] : pool.slice(0, 1);
    } else {
      const main = pool.filter(h => h.pronoun !== 'yad');
      // ca joins several doers of one plural / dual verb; otherwise one doer,
      // the nearest to the verb (na me dveṣyo 'sti: dveṣyaḥ, not samaḥ).
      const nearestMain = main.length ? nearest(words, v, main) : null;
      doerHeads = numberName !== 'singular' && coordinated && main.length > 1 ? main : nearestMain ? [nearestMain] : [];
    }
    for (const d of doerHeads) usedDoers.add(d);
    // What the doer is: with a verb of being (√as, √bhū) or a passive, the
    // other nominatives of the clause in its number are said of the doer —
    // also of the "I / you" of the ending (saṁvṛttaḥ sa-cetāḥ … asmi).
    const root = (v.root ?? '').replace(/^√/, '');
    const copula = ['as', 'bhū'].includes(root) || v.verb!.passive;
    const predicateHeads = !inRelative && copula && (person !== 3 || doerHeads.length)
      ? nomHeads.filter(h => !usedDoers.has(h) && !doerHeads.includes(h) && st.clauseOf(h) === v && personOf(h) === 3
        && !h.pronoun && h.number === numberName)
      : [];
    for (const d of predicateHeads) usedDoers.add(d);
    // Other nominatives of the clause that agree with its doer in number and
    // gender name the same person (vidvān … yuktaḥ … joṣayet): not a second doer.
    // (Nouns joined by ca are separate doers; a gerundive is said of its subject.)
    const alsoDoer = doerHeads.length === 1 && !inRelative
      ? nomHeads.filter(h => !usedDoers.has(h) && st.clauseOf(h) === v && personOf(h) === person && !h.pronoun && !h.gerundive
        && !(coordinated && !h.adjective && !h.participle && !h.pastParticiple)
        && h.number === doerHeads[0].number && gendersMeet(h.genders, doerHeads[0].genders))
      : [];
    for (const d of alsoDoer) { usedDoers.add(d); roleAt.set(d, `names the doer of ${v.word} too (same person as ${doerHeads[0].word})`); }
    doerHeads.forEach((d, k) => roleAt.set(d, k ? `doer of ${v.word}, joined by ca` : `doer of ${v.word}`));
    for (const d of predicateHeads) {
      roleAt.set(d, `said of the doer of ${v.word}${doerHeads[0] ? ` (${doerHeads[0].word})` : person === 1 ? ' ("I")' : person === 2 ? ' ("you")' : ''}`);
    }
    const kind = st.yadClause?.verb === v ? `clause: the object of ${st.yadClause.main.word}`
      : st.relative?.verb === v ? `relative clause (${st.relative.yad.word} …)${st.relative.noun ? `, describing ${st.relative.noun.word}` : ''}`
        : (() => {
          const adv = adverbialClause(st, v);
          if (!adv) return 'main clause';
          const answer = adv.partner ? `, answered by ${adv.partner.word} in the ${st.clauseOf(adv.partner)?.word ?? 'main'} clause` : '';
          return `subordinate clause (${adv.rel.word} …, "${CORRELATIVES[adv.rel.word].sense.split(' … ')[0]} …")${answer}`;
        })();
    const objs = heads.filter(h => h.case === 'accusative' && !st.governed.has(h) && st.objectVerb.get(h) === v);
    const gerundsHere = st.gerunds.filter(g => st.clauseOf(g) === v).map(g => ({
      word: { word: g.word, meaning: g.meaning },
      objects: heads.filter(h => h.case === 'accusative' && !st.governed.has(h) && st.objectVerb.get(h) === g)
        .map(h => ({ group: toGroup(st, h), note: objectNote(h, g) })),
    }));
    return {
      kind: doerHeads.length > 1 ? `${kind} (doers joined by ca)` : kind,
      verb: { word: v.word, meaning: v.meaning },
      doer: doerHeads.length ? toGroup(st, doerHeads[0]) : null,
      coDoers: doerHeads.slice(1).map(h => toGroup(st, h)),
      impliedDoer: doerHeads.length ? null : person === 1 ? `"I / we", from the ending of ${v.word}`
        : person === 2 ? `"you", from the ending of ${v.word}`
          : `"he / she / it / they", from the ending of ${v.word}`,
      objects: objs.map(h => ({ group: toGroup(st, h), note: objectNote(h, v) })),
      gerunds: gerundsHere,
      predicates: predicateHeads.length ? predicateHeads.map(h => toGroup(st, h)) : undefined,
      sameDoer: alsoDoer.length ? alsoDoer.map(h => toGroup(st, h)) : undefined,
    };
  });
  // A verse (or half-verse) with nominatives but no verb of its own: a
  // nominal sentence, "is / are" understood. The first pronoun or noun is
  // the subject; the other nominatives say what it is.
  // Nominatives no verb took: those of a verbless verse, of a relative
  // clause whose doer is its yad (the tad side: saḥ stenaḥ), or a pronoun
  // that no verb agrees with (aham beside a 3rd-person asti) — together with
  // the unused nominatives right next to it (aham samaḥ, "I am equal").
  const relVerbs = [st.relative?.verb, st.yadClause?.verb].filter(Boolean);
  const unused = nomHeads.filter(h => !usedDoers.has(h));
  const pronounSubject = unused.find(h => h.pronoun || FIRST.has(h.word) || SECOND.has(h.word));
  // Only these form a nominal sentence: a verse with no verb; the tad side of
  // a relative clause whose own doer is its yad; a pronoun no verb took,
  // with the nominatives right beside it. Anything else stays unattached
  // rather than inventing a sentence.
  const leftover = unused.filter(h => !st.finite.length
    || (relVerbs.includes(st.clauseOf(h) ?? undefined) && (h.pronoun === 'tad' || h.pronoun === 'etad'
      || (pronounSubject && distance(words, words.indexOf(h), words.indexOf(pronounSubject)) <= 2)))
    || h === pronounSubject && !st.finite.some(v => st.clauseOf(h) === v && personOf(h) === v.verb!.person && h.number === v.verb!.number)
    || (pronounSubject && h !== pronounSubject && !h.pronoun && distance(words, words.indexOf(h), words.indexOf(pronounSubject)) <= 2
      && !st.finite.some(v => st.clauseOf(pronounSubject) === v && personOf(pronounSubject) === v.verb!.person)));
  if (leftover.length) {
    // One nominal sentence per pronoun subject (aham samaḥ … teṣu cāpy aham),
    // each with the other leftovers nearest to it as its predicates; with no
    // pronoun, the first noun is the subject.
    const isPron = (h: MappedWord) => !!h.pronoun || FIRST.has(h.word) || SECOND.has(h.word);
    const subjects = leftover.filter(isPron);
    if (!subjects.length) subjects.push(leftover.find(h => !h.adjective && !h.participle) ?? leftover[0]);
    const rest = leftover.filter(h => !subjects.includes(h));
    const predicatesOf = new Map<MappedWord, MappedWord[]>(subjects.map(sj => [sj, []]));
    for (const r of rest) predicatesOf.get(nearest(words, r, subjects)!)!.push(r);
    for (const subject of subjects) {
      roleAt.set(subject, 'subject of a sentence with "is" understood');
      for (const pr of predicatesOf.get(subject)!) roleAt.set(pr, `says what ${subject.word} is ("is" understood)`);
      clauses.push({
        kind: 'nominal sentence ("is / are" understood)',
        verb: { word: '(asti)', meaning: 'is' },
        doer: toGroup(st, subject),
        coDoers: [],
        impliedDoer: null,
        objects: [],
        gerunds: st.finite.length || subject !== subjects[0] ? [] : st.gerunds.map(g => ({ word: { word: g.word, meaning: g.meaning }, objects: [] })),
        predicates: predicatesOf.get(subject)!.map(h => toGroup(st, h)),
      });
    }
  }
  // Remaining doer groups (named with the main clause's doer, samānādhikaraṇa).
  return {
    clauses,
    doers: nomHead ? toGroup(st, nomHead) : null,
    verbs: st.finite.map(w => ({ word: w.word, meaning: w.meaning })),
    gerunds: st.gerunds.map(w => ({ word: w.word, meaning: w.meaning })),
    objects,
    quoted: st.quoteWords.length
      ? { words: st.quoteWords.map(w => w.word).join(' '), verbs: st.quoteWords.filter(w => w.verb).map(w => w.word) }
      : null,
    clauseObject: st.yadClause ? { from: st.yadClause.yad.word, to: st.yadClause.verb.word, of: st.yadClause.main.word } : null,
    relative: st.relative ? { from: st.relative.yad.word, to: st.relative.verb.word, describes: st.relative.noun?.word ?? null } : null,
    governed: [...st.governed].map(([w, u]) => ({ word: { word: w.word, meaning: w.meaning }, by: u.word, sense: u.sense })),
    addressed: words.filter(w => w.case === 'vocative').map(w => ({ word: w.word, meaning: w.meaning })),
    others,
    askWho,
    depends,
    roleAt: words.map(w => roleAt.get(w) ?? null),
  };
}

/** The rules at work in a verse, in guide order. */
export function detectSentenceRules(input: RuleWord[]): SentenceRule[] {
  const words = input.map(w => ({ meaning: null, ...w })) as MappedWord[];
  const st = structure(words);
  const out: SentenceRule[] = [];

  // 1. The verb follows the doer — the doer the sentence map gave it.
  const mapClauses = buildSentenceMap(words).clauses;
  for (const v of st.finite) {
    const { person, number, passive } = v.verb!;
    if (passive) continue;
    if (person === 3) {
      const cl = mapClauses.find(c => c.verb.word === v.word && c.doer);
      if (cl?.doer) {
        const all = [cl.doer.head.word, ...cl.doer.descriptions.map(d => d.word), ...cl.coDoers.map(c => c.head.word)];
        out.push({ no: 1, title: 'The verb follows the doer', text: `${v.word} is 3rd person ${number}, like its doer${all.length > 1 ? 's' : ''} ${list(all)} (nominative ${number}).` });
      }
      if (number === 'dual' && words.some(w => w.word === 'ca')) {
        out.push({ no: 1, title: 'Two doers joined by ca', text: `${v.word} is dual: two subjects joined with ca take a dual verb.` });
      }
    } else if (person === 2) {
      const called = words.filter(w => w.case === 'vocative').map(w => w.word);
      out.push({ no: 1, title: 'The verb follows the doer', text: `${v.word} is 2nd person ("you")${called.length ? `, addressed to ${list(called)}` : ''}.` });
    } else {
      out.push({ no: 1, title: 'The verb follows the doer', text: `${v.word} is 1st person ("I / we"): the speaker is the doer.` });
    }
  }
  for (const gz of st.gerunds) {
    const own = st.clauseOf(gz);
    out.push({ no: 7, title: 'A gerund shares its clause\'s doer', text: `${gz.word} is a gerund ("having …"), not a finite verb: its doer is the doer of ${own?.word ?? 'the sentence'}.` });
  }

  // 2 / 3. Agreement within each group.
  for (const [h, g] of st.groups) {
    const desc = g.members.filter(m => m !== h);
    if (!desc.length && !g.pointers.length) continue;
    const gg = genderOfGroup([h, ...g.members.filter(x => x !== h)]);
    const label = `${gg ? `${gg} ` : ''}${h.case} ${h.number}`;
    if (h.case === 'nominative') {
      out.push({ no: 3, title: 'Same thing, same vibhakti', text: `${list(desc.map(d => d.word))} ${desc.length > 1 ? 'are' : 'is'} ${label} like ${h.word}: they name or describe the same ${h.number === 'singular' ? 'person' : 'people'}.` });
    } else if (desc.length) {
      out.push({ no: 2, title: 'Adjectives copy their noun', text: `${list(desc.map(d => d.word))} describe${desc.length > 1 ? '' : 's'} ${h.word}: all ${label}${g.pointers.length ? `; ${list(g.pointers.map(p => p.word))} point${g.pointers.length > 1 ? '' : 's'} to it too` : ''}.` });
    }
  }
  // Genitives depend on a noun.
  const genitiveCount = [...st.groups.values()].reduce((n, g) => n + g.genitives.length, 0);
  for (const [h, g] of st.groups) {
    for (const gen of g.genitives) {
      const on = st.headOf.get(gen) ?? h;
      out.push({ no: 3, title: 'A genitive depends on a noun', text: `${gen.word} (genitive, "of …") belongs to ${on.word}${genitiveCount > 1 ? ', not to the other genitives' : ''}.` });
    }
  }

  // 4. Fixed-vibhakti words.
  for (const [w, u] of st.governed) {
    out.push({ no: 4, title: 'A word that fixes the vibhakti', text: `${w.word} is ${w.case} because of ${u.word} ("${u.sense}"), which always takes the ${u.forces.join(' / ')}, not because of the verb.` });
  }

  // Objects and their verbs, when there is more than one.
  const objs = [...st.objectVerb].filter(([, v]) => v);
  if (objs.length > 1 && new Set(objs.map(([, v]) => v)).size > 1) {
    out.push({ no: 2, title: 'Two actions, two objects', text: objs.map(([o, v]) => `${o.word} is the object of ${v!.word}`).join('; ') + '.' });
  }

  // 5. Passive.
  for (const v of words.filter(w => w.verb?.passive && !st.inQuote.has(w))) {
    const by = words.filter(w => w.case === 'instrumental').map(w => w.word);
    out.push({ no: 5, title: 'Passive (or ātmanepada)', text: `${v.word} may be passive: then the doer is in the 3rd vibhakti${by.length ? ` (${list(by)})` : ''} and the 1st-vibhakti word is what is acted on.` });
  }

  // 6. yad … tad.
  if (st.yadClause) {
    const { yad, verb, main } = st.yadClause;
    out.push({ no: 6, title: 'A yad-clause as the object', text: `There is no tad: the whole clause ${yad.word} … ${verb.word} is the object of ${main.word}.` });
  } else if (st.relative) {
    const { yad, verb, noun } = st.relative;
    const partner = tadPartner(words, yad);
    out.push({
      no: 6, title: 'A relative clause (yad …)',
      text: noun
        ? `${yad.word} … ${verb.word} is a relative clause describing ${noun.word} ("which …"): ${yad.word} takes ${noun.word}'s gender and number, its vibhakti from its own clause.`
        : `${yad.word} … ${verb.word} is a relative clause ("those who …")${partner ? `, answered by ${partner.word}` : ''}; ${yad.word} is ${yad.case ?? 'in'} its own clause.`,
    });
  } else {
    for (const y of words.filter(w => w.pronoun === 'yad')) {
      const head = st.headOf.get(y);
      const partner = tadPartner(words, y);
      out.push({
        no: 6, title: 'yad … tad',
        text: `${y.word} (a form of yad, "which / who")${head && head !== y ? ` points to ${head.word}, taking its gender and number` : ''}. ${partner ? `Its partner is ${partner.word}.` : 'Its tad partner comes later.'}`,
      });
    }
  }

  // 6. Relative adverbs and their partners (yadā … tadā).
  for (const v of st.finite) {
    const adv = adverbialClause(st, v);
    if (!adv) continue;
    const pair = CORRELATIVES[adv.rel.word];
    out.push({
      no: 6, title: `${adv.rel.word} … ${pair.partners[0]}`,
      text: `${adv.rel.word} … ${v.word} is a subordinate clause ("${pair.sense}")${adv.partner ? `; ${adv.partner.word} answers it in the ${st.clauseOf(adv.partner)?.word ?? 'main'} clause`
        : (() => {
          const tad = st.words.find(w => (w.pronoun === 'tad' || w.pronoun === 'etad') && st.clauseOf(w) !== v);
          return tad ? `; ${tad.word} in the ${st.clauseOf(tad)?.word ?? 'main'} clause takes it up` : `; its partner (${pair.partners[0]}) is understood`;
        })()}.`,
    });
  }

  // 8. Free word order.
  for (const [h, g] of st.groups) {
    const all = [...g.members, ...g.pointers];
    const idx = all.map(m => words.indexOf(m));
    const lines = new Set(all.map(m => m.line));
    if (idx.length > 1 && Math.max(...idx) - Math.min(...idx) > 3 && lines.size > 1) {
      out.push({ no: 8, title: 'Word order is free', text: `${h.word} and the words that describe it stand far apart; their matching endings tie them together.` });
      break;
    }
  }

  // 9. Particles in their fixed positions.
  words.forEach((w, i) => {
    const prev = words[i - 1]?.word;
    if (!prev) return;
    if (w.word === 'ca' && !CONNECTIVES.has(prev)) out.push({ no: 9, title: 'ca comes after', text: `ca ("and") follows ${prev}, joining it to what came before.` });
    if (w.word === 'iti' && st.quoteWords.length) out.push({ no: 9, title: 'iti closes a quotation', text: `iti works like closing quotation marks: “${st.quoteWords.map(x => x.word).join(' ')}”, thus.` });
    // Only after a real word: "ca eva" (caiva) is a pair of particles.
    const prevIsParticle = CONNECTIVES.has(prev);
    if (w.word === 'eva' && !prevIsParticle) out.push({ no: 9, title: 'eva comes after', text: `eva ("indeed, only") emphasises ${prev}.` });
    if (w.word === 'api' && !prevIsParticle) out.push({ no: 9, title: 'api comes after', text: `api ("also, even") belongs to ${prev}.` });
  });

  return out.sort((a, b) => a.no - b.no);
}

// ── Across verses ──────────────────────────────────────────────────────────

/**
 * Does the sentence run on into the next verse? Only when it has no finite
 * verb of its own, or when its only verb belongs to a yad-clause still
 * waiting for its tad (yām … pravadanti, answered in the next verse).
 */
export function sentenceContinues(words: RuleWord[]): boolean {
  const st = structure(words.map(w => ({ ...w, meaning: null })) as MappedWord[]);
  if (!st.finite.length) return true;
  const yad = words.some(w => w.pronoun === 'yad');
  const tad = words.some(w => w.pronoun === 'tad' || w.pronoun === 'etad');
  return yad && !tad && st.finite.length === 1;
}

/**
 * How the next verse carries the sentence on: pronouns that point back to a
 * noun here (tayā → vācam), the same people in a new vibhakti because their
 * role changed (genitive plural), and the next verb.
 */
export function linkAcrossVerses(here: MappedWord[], next: MappedWord[], nextLabel: string): string[] {
  const out: string[] = [];
  // Nouns heading a group here, not those whose case a neighbour fixes (gatim ← prati).
  const st = structure(here.map(w => ({ ...w })));
  const heads = new Set([...st.groups.keys()].filter(h => !st.governed.has(h)).map(h => h.word));
  const nouns = here.filter(w => w.case && !w.verb && !w.pronoun && !w.adjective && heads.has(w.word));
  // A consonant stem's ending hides its gender (vāc); its agreeing words show it (puṣpitām → feminine).
  const genderOf = (n: RuleWord) => n.genders.length === 1 ? n.genders[0]
    : here.find(w => w.case === n.case && w.number === n.number && w.genders.length === 1)?.genders[0];
  for (const p of next.filter(w => w.pronoun && w.case && w.genders.length === 1)) {
    const matches = nouns.filter(n => n.number === p.number && genderOf(n) === p.genders[0]);
    // Only a single candidate is a real link; several would be a guess.
    if (matches.length === 1 && p.case !== matches[0].case) {
      out.push(`${p.word} (${p.genders[0]} ${p.case} ${p.number}${p.meaning ? `, "${p.meaning}"` : ''}) points back to ${matches[0].word}: same gender and number, new vibhakti for its new role.`);
    }
  }
  const doers = here.filter(w => w.case === 'nominative' && w.number === 'plural');
  if (doers.length) {
    const dGender = doers.map(d => d.genders).find(g => g.length === 1)?.[0];
    const sameNumber = next.filter(w => w.number === 'plural' && w.case && w.case !== 'nominative' && !w.verb && !w.pronoun
      && (!dGender || !w.genders.length || w.genders.includes(dGender) || w.word.includes('-')));
    const byCase = new Map<string, string[]>();
    for (const w of sameNumber) byCase.set(w.case!, [...(byCase.get(w.case!) ?? []), w.word]);
    for (const [c, ws] of byCase) {
      out.push(`${list(ws)} (${c} plural): likely the same people as ${doers[0].word}, now in the ${c}. Their role in the sentence has changed, so the vibhakti changes too.`);
    }
  }
  const verbs = next.filter(w => w.verb);
  if (verbs.length) out.push(`The sentence goes on to ${nextLabel}'s verb${verbs.length > 1 ? 's' : ''}: ${list(verbs.map(v => v.word))}${verbs.some(v => v.verb!.passive) ? ' (passive)' : ''}.`);
  return out;
}

/**
 * Each word's role in the sentence, in reading order: "doer of babhūva",
 * "object of avāpya", "describes śokam", "of … → depends on ucchoṣaṇam".
 * Where the ending allowed two cases, the role says which one the sentence
 * gives it.
 */
export function rolesOf(input: RuleWord[]): (string | null)[] {
  const words = input.map(w => ({ meaning: null, ...w })) as MappedWord[];
  const st = structure(words);
  const mapRoles = buildSentenceMap(words).roleAt ?? [];
  return words.map((w, i) => {
    const decided = input[i].caseOptions?.length ? `here ${w.case}: ` : '';
    if (st.inQuote.has(w)) return 'inside the quotation closed by iti';
    if (w.verb) {
      if (st.yadClause?.verb === w) return `verb of the ${st.yadClause.yad.word}-clause (the object of ${st.yadClause.main.word})`;
      if (st.relative?.verb === w) return `verb of the relative clause ${st.relative.yad.word} …${st.relative.noun ? ` (describing ${st.relative.noun.word})` : ''}`;
      return 'finite verb (main)';
    }
    if (w.gerund) return `gerund, "having …": same doer as ${st.clauseOf(w)?.word ?? 'the sentence'}`;
    if (st.governed.has(w)) return `${w.case} because of ${st.governed.get(w)!.word}`;
    if (w.case === 'vocative') return 'the person addressed';
    const head = st.headOf.get(w);
    const agentFor = st.agentOf.get(w);
    if (agentFor) return `genitive of the doer: "by …" with ${agentFor.word} (${agentFor.gerundive ? 'kṛtya, 2.3.71' : 'kta, 2.3.67'})`;
    if (w.case === 'genitive') return head ? `"of …": depends on ${head.word}` : '"of …"';
    if (head && head !== w) return `${decided}describes ${head.word}`;
    if (w.case === 'nominative') {
      if (mapRoles[i]) return `${decided}${mapRoles[i]}`;
      // No verb of its clause agrees with it in person and number.
      return `${decided}nominative${st.finite.length ? ' — no verb here agrees with it' : ''}`;
    }
    if (w.case === 'accusative') {
      const v = st.objectVerb.get(w);
      return `${decided}object${v ? ` of ${v.word}` : ''}`;
    }
    return decided ? decided.replace(/: $/, '') : null;
  });
}
