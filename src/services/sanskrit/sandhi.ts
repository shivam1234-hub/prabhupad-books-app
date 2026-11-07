import { isVoiced, isVowel } from './sanskritTranslit';

/**
 * Sandhi-viccheda: undo the sound changes that fuse Sanskrit words together
 * ("caiva" = ca + eva, "prājño" = prājñaḥ, "cāparājitaḥ" = ca + aparājitaḥ).
 *
 * Everything here works in SLP1 (./sanskritTranslit.ts). The splitter
 * does not know any words itself: the caller passes a `Recognizer` that says
 * whether a candidate piece is a real word, and at what cost. The same engine
 * therefore serves both
 *   - a verse's own word-for-word list (Śrīla Prabhupāda's synonyms — the
 *     pieces can only be words he lists), and
 *   - the offline lexicon (particles, the glossary, Apte).
 *
 * The search is a small dynamic programme over (position, letters the next
 * word must start with): at each point it either ends a word as written, or
 * applies one reverse-sandhi rule that says what the two neighbouring words
 * ended/began with before they fused. The cheapest full cover wins; every
 * word costs 1 plus the recognizer's cost, so fewer, better-known words win.
 */

export interface Analysis<T> { cost: number; info: T }
/** `final`: the piece ends the written token, so it may carry a case ending
 * and word-final sandhi (-ś for -ḥ …); inner pieces are compound members or
 * words fused by vowel sandhi. */
export type Recognizer<T> = (form: string, final: boolean) => Analysis<T> | null;

/** How the end of a word was changed where it met the next one. */
export interface SandhiJoin {
  /** The letters as written (SLP1): "E" for ca + eva → caiva. */
  written: string;
  /** The rule, in words: "Vṛddhi: a + e → ai". */
  rule: string;
}

export interface SplitPart<T> {
  form: string;
  info: T;
  /** The join after this word, when there is one (or a change to its last
   * letters from the word that followed it in the verse). */
  join?: SandhiJoin;
  /** A change to its first letters from the word before it ("'smin"). */
  start?: SandhiJoin;
}

interface Junction {
  /** Letters as written at the join. */
  surface: string;
  /** What the left word ended with before the join. */
  left: string[];
  /** What the right word began with (prefixed to the letters that follow). */
  right: string[];
  /** Condition on the written letter right after `surface`. */
  next?: (ch: string | undefined) => boolean;
  /** Condition on the written letter right before `surface`. */
  prev?: (ch: string | undefined) => boolean;
  /** Name of the rule, shown to the reader. */
  rule: string;
}

const oneOf = (set: string) => (ch: string | undefined) => !!ch && set.includes(ch);
const A_A = ['a', 'A'];

const JUNCTIONS: Junction[] = [
  // Vowel sandhi.
  { surface: 'A', left: A_A, right: A_A, rule: 'Savarṇa-dīrgha: like vowels merge into a long one' },
  { surface: 'I', left: ['i', 'I'], right: ['i', 'I'], rule: 'Savarṇa-dīrgha: like vowels merge into a long one' },
  { surface: 'U', left: ['u', 'U'], right: ['u', 'U'], rule: 'Savarṇa-dīrgha: like vowels merge into a long one' },
  { surface: 'F', left: ['f'], right: ['f'], rule: 'Savarṇa-dīrgha: like vowels merge into a long one' },
  { surface: 'e', left: A_A, right: ['i', 'I'], rule: 'Guṇa: a/ā + i/ī → e' },
  { surface: 'o', left: A_A, right: ['u', 'U'], rule: 'Guṇa: a/ā + u/ū → o' },
  { surface: 'E', left: A_A, right: ['e', 'E'], rule: 'Vṛddhi: a/ā + e/ai → ai' },
  { surface: 'O', left: A_A, right: ['o', 'O'], rule: 'Vṛddhi: a/ā + o/au → au' },
  { surface: 'ar', left: A_A, right: ['f'], rule: 'Guṇa: a/ā + ṛ → ar' },
  { surface: 'y', left: ['i', 'I'], right: [''], next: isVowel, rule: 'Yaṇ: i/ī → y before an unlike vowel' },
  { surface: 'v', left: ['u', 'U'], right: [''], next: isVowel, rule: 'Yaṇ: u/ū → v before an unlike vowel' },
  { surface: 'ay', left: ['e'], right: [''], next: isVowel, rule: 'Ayādi: e → ay before a vowel' },
  { surface: 'Ay', left: ['E'], right: [''], next: isVowel, rule: 'Ayādi: ai → āy before a vowel' },
  { surface: 'av', left: ['o'], right: [''], next: isVowel, rule: 'Ayādi: o → av before a vowel' },
  { surface: 'Av', left: ['O'], right: [''], next: isVowel, rule: 'Ayādi: au → āv before a vowel' },
  { surface: "o'", left: ['aH'], right: ['a'], rule: "Visarga: -aḥ → -o, and the next a- drops (avagraha ')" },
  { surface: "e'", left: ['e'], right: ['a'], rule: "Pūrva-rūpa: a- drops after -e (avagraha ')" },
  // Visarga.
  { surface: 'o', left: ['aH', 'as'], right: [''], next: isVoiced, rule: 'Visarga: -aḥ → -o before a voiced sound' },
  { surface: 'r', left: ['H', 's'], right: [''], prev: oneOf('iIuUeEoO'), next: isVoiced, rule: 'Visarga: -ḥ → -r before a voiced sound' },
  { surface: 'S', left: ['H', 's'], right: [''], next: oneOf('cCS'), rule: 'Visarga: -ḥ → -ś before c/ch/ś' },
  { surface: 'z', left: ['H', 's'], right: [''], next: oneOf('wWz'), rule: 'Visarga: -ḥ → -ṣ before ṭ/ṭh/ṣ' },
  { surface: 's', left: ['H'], right: [''], next: oneOf('tTs'), rule: 'Visarga: -ḥ → -s before t/th/s' },
  // Final consonants before the next word.
  { surface: 'd', left: ['t'], right: [''], next: isVoiced, rule: 'Jaśtva: t → d before a voiced sound' },
  { surface: 'g', left: ['k'], right: [''], next: isVoiced, rule: 'Jaśtva: k → g before a voiced sound' },
  { surface: 'q', left: ['w'], right: [''], next: isVoiced, rule: 'Jaśtva: ṭ → ḍ before a voiced sound' },
  { surface: 'b', left: ['p'], right: [''], next: isVoiced, rule: 'Jaśtva: p → b before a voiced sound' },
  { surface: 'c', left: ['t'], right: [''], next: oneOf('cC'), rule: 'Ścutva: t → c before c/ch' },
  { surface: 'cC', left: ['t'], right: ['S', 'C'], rule: 't + ś → cch' },
  { surface: 'cC', left: [''], right: ['C'], prev: isVowel, rule: 'ch → cch after a short vowel' },
  { surface: 'j', left: ['t'], right: [''], next: oneOf('jJ'), rule: 'Ścutva: t → j before j' },
  { surface: 'l', left: ['t'], right: [''], next: oneOf('l'), rule: 't → l before l' },
  { surface: 'n', left: ['t'], right: [''], next: oneOf('nm'), rule: 'Anunāsika: t → n before a nasal' },
  { surface: 'dD', left: ['t'], right: ['h'], rule: 't + h → ddh' },
  { surface: 'gG', left: ['k'], right: ['h'], rule: 'k + h → ggh' },
  { surface: 'N', left: ['k'], right: [''], next: oneOf('nm'), rule: 'Anunāsika: k → ṅ before a nasal' },
  // Anusvāra and nasals standing for a final m / n.
  { surface: 'M', left: ['m'], right: [''], next: ch => !!ch && !isVowel(ch), rule: 'Anusvāra: final m → ṁ before a consonant' },
  { surface: 'N', left: ['m'], right: [''], next: oneOf('kKgG'), rule: 'Parasavarṇa: m → ṅ before k/g' },
  { surface: 'Y', left: ['m', 'n'], right: [''], next: oneOf('cCjJS'), rule: 'Parasavarṇa: m/n → ñ before c/j/ś' },
  { surface: 'R', left: ['m'], right: [''], next: oneOf('wWqQ'), rule: 'Parasavarṇa: m → ṇ before ṭ/ḍ' },
  { surface: 'n', left: ['m'], right: [''], next: oneOf('tTdDn'), rule: 'Parasavarṇa: m → n before t/d/n' },
  { surface: 'MS', left: ['n'], right: [''], next: oneOf('cC'), rule: 'n → ṁś before c/ch' },
  { surface: 'Ms', left: ['n'], right: [''], next: oneOf('tT'), rule: 'n → ṁs before t/th' },
  { surface: 'YC', left: ['n'], right: ['S'], rule: 'n + ś → ñch' },
  { surface: 'nn', left: ['n'], right: [''], next: isVowel, rule: 'Ṅamuṭ: n doubles after a short vowel before a vowel' },
  { surface: 'NN', left: ['N'], right: [''], next: isVowel, rule: 'Ṅamuṭ: ṅ doubles after a short vowel before a vowel' },
];

/** How a word can end when it is the last one written in the token, with the
 * extra cost of reading it that way and the rule that changed it (the word
 * after it in the verse is not part of the token, so only its effect shows). */
function finalForms(body: string, wordFinal = true): [string, number, string?][] {
  const out: [string, number, string?][] = [[body, 0]];
  const last = body[body.length - 1];
  const stem = body.slice(0, -1);
  const add = (form: string, cost: number, rule: string) => { if (form) out.push([form, cost, rule]); };
  switch (last) {
    case 'S': add(stem + 'H', 0, 'Visarga: -ḥ → -ś before c/ch/ś'); break;
    case 's': add(stem + 'H', 0, 'Visarga: -ḥ → -s before t/th/s'); break;
    case 'z': add(stem + 'H', 0, 'Visarga: -ḥ → -ṣ before ṭ/ṭh/ṣ'); break;
    case 'r': add(stem + 'H', 0.1, 'Visarga: -ḥ → -r before a voiced sound'); break;
    case 'o':
      add(stem + 'aH', 0, 'Visarga: -aḥ → -o before a voiced sound');
      add(stem + 'as', 0.2, 'Visarga: -as → -o before a voiced sound');
      break;
    case 'a':
      // saḥ / eṣaḥ lose their -ḥ before any consonant (6.1.132); any other
      // -aḥ loses it before a vowel other than a.
      add(body + 'H', 0.15, /^(sa|eza)$/.test(body)
        ? 'saḥ / eṣaḥ lose the -ḥ before a consonant (6.1.132), or -aḥ drops before a vowel'
        : 'Visarga: -aḥ drops before a vowel other than a');
      // yotsye + iti → yotsay iti → yotsya iti: e → ay before a vowel, then
      // the y drops (Pāṇini 8.3.19); likewise o → av → a.
      // Only at the end of a word: a compound member in -a (ātma-) is a stem.
      if (wordFinal) {
        add(stem + 'e', 0.2, 'Ayādi: -e → -ay before a vowel, and the y drops (8.3.19): -e → -a');
        add(stem + 'o', 0.3, 'Ayādi: -o → -av before a vowel, and the v drops (8.3.19): -o → -a');
      }
      break;
    case 'A': add(body + 'H', 0.15, 'Visarga: -āḥ drops before a voiced sound'); break;
    case 'd': add(stem + 't', 0, 'Jaśtva: t → d before a voiced sound'); break;
    case 'g': add(stem + 'k', 0, 'Jaśtva: k → g before a voiced sound'); break;
    case 'q': add(stem + 'w', 0, 'Jaśtva: ṭ → ḍ before a voiced sound'); break;
    case 'b': add(stem + 'p', 0, 'Jaśtva: p → b before a voiced sound'); break;
    // yat + śokam → yac chokam: t → c before ś (ścutva), then ś → ch (śaś cho'ṭi, 8.4.63).
    case 'c': add(stem + 't', 0.1, 'Ścutva: t → c before c / ch / ś (and a following ś becomes ch, 8.4.63)'); break;
    case 'j': add(stem + 't', 0.1, 'Ścutva: t → j before j'); break;
    case 'l': add(stem + 't', 0.1, 't → l before l'); break;
    case 'n':
      add(stem + 't', 0.3, 'Anunāsika: t → n before a nasal');
      // param + tapaḥ → paran-tapaḥ: m takes the nasal of the t that follows.
      add(stem + 'm', 0.1, 'Parasavarṇa: m → n before t / d');
      if (body.endsWith('nn')) add(stem, 0, 'Ṅamuṭ: n doubles after a short vowel before a vowel');
      break;
    case 'M': add(stem + 'm', 0, 'Anusvāra: final m → ṁ before a consonant'); break;
    case 'Y': add(stem + 'n', 0, 'Parasavarṇa: n → ñ before c/j/ś'); add(stem + 'm', 0.1, 'Parasavarṇa: m → ñ before c/j'); break;
    case 'N': add(stem + 'm', 0.1, 'Parasavarṇa: m → ṅ before k/g'); add(stem + 'k', 0.2, 'Anunāsika: k → ṅ before a nasal'); break;
    case 'y': add(stem + 'i', 0, 'Yaṇ: i → y before an unlike vowel'); add(stem + 'I', 0.1, 'Yaṇ: ī → y before an unlike vowel'); break;
    case 'v': add(stem + 'u', 0, 'Yaṇ: u → v before an unlike vowel'); add(stem + 'U', 0.1, 'Yaṇ: ū → v before an unlike vowel'); break;
  }
  // bhūmau + asapatnam → bhūmāv asapatnam: au → āv before a vowel (ayādi);
  // ai → āy, e → ay, o → av likewise.
  if (body.endsWith('Av')) add(body.slice(0, -2) + 'O', 0, 'Ayādi: -au → -āv before a vowel');
  if (body.endsWith('Ay')) add(body.slice(0, -2) + 'E', 0, 'Ayādi: -ai → -āy before a vowel');
  if (body.endsWith('av')) add(body.slice(0, -2) + 'o', 0.1, 'Ayādi: -o → -av before a vowel');
  if (body.endsWith('ay')) add(body.slice(0, -2) + 'e', 0.1, 'Ayādi: -e → -ay before a vowel');
  if (/M[Ss]$/.test(body)) add(body.slice(0, -2) + 'n', 0, 'n → ṁś / ṁs before c / t');
  return out;
}

/** Ways the token's first letters may have been changed by the word before
 * it ("tac chrutvā": chrutvā ← śrutvā; "so 'ham": 'ham ← aham). */
function initialForms(s: string): [string, number, string?][] {
  const out: [string, number, string?][] = [[s, 0]];
  if (s.startsWith("'")) out.push(['a' + s.slice(1), 0, "Pūrva-rūpa: a- drops after -e/-o (avagraha ')"]);
  if (s.startsWith('C')) out.push(['S' + s.slice(1), 0.1, "ś → ch after t / c (śaś cho'ṭi, 8.4.63): the word begins with ś-"]);
  return out;
}

const JUNCTION_COST = 0.05;
const MAX_LEN = 60;

/**
 * Best split of one written token (SLP1; hyphens are compound joins and so
 * always word boundaries) into recognised words, or null if some part can't
 * be covered.
 */
export function splitSandhi<T>(token: string, recognize: Recognizer<T>): SplitPart<T>[] | null {
  const pieces = token.split('-').filter(Boolean);
  if (!pieces.length || token.length > MAX_LEN) return null;
  const cache = new Map<string, Analysis<T> | null>();
  const rec = (form: string, final: boolean) => {
    const k = (final ? '1' : '0') + form;
    if (!cache.has(k)) cache.set(k, recognize(form, final));
    return cache.get(k)!;
  };

  const out: SplitPart<T>[] = [];
  for (let p = 0; p < pieces.length; p++) {
    const isLast = p === pieces.length - 1;
    let best: { cost: number; parts: SplitPart<T>[] } | null = null;
    const starts: [string, number, string?][] = p === 0 ? initialForms(pieces[p]) : [[pieces[p], 0]];
    for (const [start, startCost, startRule] of starts) {
      const r = splitPiece(start, isLast, rec);
      if (r && (!best || r.cost + startCost < best.cost)) {
        const parts = r.parts;
        if (startRule && parts.length) {
          parts[0] = { ...parts[0], start: { written: pieces[p].slice(0, 1), rule: startRule } };
        }
        best = { cost: r.cost + startCost, parts };
      }
    }
    if (!best) return null;
    // A hyphen is a compound join the text marks itself.
    const last = best.parts[best.parts.length - 1];
    if (!isLast && !last.join) {
      best.parts[best.parts.length - 1] = { ...last, join: { written: '-', rule: 'Samāsa: compound members, joined with a hyphen' } };
    }
    out.push(...best.parts);
  }
  return out;
}

function splitPiece<T>(
  s: string,
  isLastPiece: boolean,
  rec: (form: string, final: boolean) => Analysis<T> | null,
): { cost: number; parts: SplitPart<T>[] } | null {
  const n = s.length;
  const memo = new Map<string, { cost: number; parts: SplitPart<T>[] } | null>();

  // Cheapest cover of s[i..] where the next word begins with `carry`.
  const solve = (i: number, carry: string): { cost: number; parts: SplitPart<T>[] } | null => {
    const key = i + '|' + carry;
    if (memo.has(key)) return memo.get(key)!;
    memo.set(key, null); // guards against a zero-progress loop
    let best: { cost: number; parts: SplitPart<T>[] } | null = null;
    const consider = (
      form: string, extra: number, a: Analysis<T> | null,
      rest: { cost: number; parts: SplitPart<T>[] } | null, join?: SandhiJoin,
    ) => {
      if (!a || !rest) return;
      const cost = 1 + a.cost + extra + rest.cost;
      if (!best || cost < best.cost) best = { cost, parts: [{ form, info: a.info, join }, ...rest.parts] };
    };

    // The word runs to the end of the piece.
    // Before a hyphen it is a compound member, which can still show the
    // sandhi of the member after it ("parameṣv-āsaḥ": -v for -u).
    const tail = carry + s.slice(i);
    if (tail) {
      for (const [form, c, rule] of finalForms(tail, isLastPiece)) {
        const written = rule ? tail.slice(commonPrefix(tail, form)) : '';
        consider(form, c, rec(form, isLastPiece), { cost: 0, parts: [] }, rule ? { written, rule } : undefined);
      }
    }

    for (let k = i; k < n; k++) {
      const body = carry + s.slice(i, k);
      // A plain join: the word ends at k with nothing changed.
      if (body && k > i) {
        consider(body, 0, rec(body, false), solve(k, ''), { written: '', rule: 'Joined without change (a compound, samāsa)' });
      }
      // A reverse-sandhi join that starts at k.
      for (const j of JUNCTIONS) {
        if (!s.startsWith(j.surface, k)) continue;
        const after = k + j.surface.length;
        if (after >= n && j.right.every(r => r === '')) continue; // nothing left to start the next word
        if (j.next && !j.next(s[after])) continue;
        if (j.prev && !j.prev(k > 0 ? s[k - 1] : undefined)) continue;
        for (const l of j.left) {
          const form = body + l;
          if (!form) continue;
          const a = rec(form, false);
          if (!a) continue;
          for (const r of j.right) {
            if (!r && after >= n) continue;
            consider(form, JUNCTION_COST, a, solve(after, r), { written: j.surface, rule: j.rule });
          }
        }
      }
    }
    memo.set(key, best);
    return best;
  };

  return solve(0, '');
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// ── Joining (for matching a verse's hyphenated synonyms to its text) ─────────

const JOIN_VOWELS: Record<string, string> = {
  aa: 'A', aA: 'A', Aa: 'A', AA: 'A',
  ai: 'e', aI: 'e', Ai: 'e', AI: 'e',
  au: 'o', aU: 'o', Au: 'o', AU: 'o',
  ae: 'E', aE: 'E', Ae: 'E', AE: 'E',
  ao: 'O', aO: 'O', Ao: 'O', AO: 'O',
  af: 'ar', Af: 'ar',
  ii: 'I', iI: 'I', Ii: 'I', II: 'I',
  uu: 'U', uU: 'U', Uu: 'U', UU: 'U',
};

/** Fuse compound members the way the verse text writes them
 * ("sūrya-aṁśa" → "sūryāṁśa"), vowels and final t/k only — enough to find a
 * hyphenated synonym inside an unhyphenated verse word. */
export function joinSandhi(left: string, right: string): string {
  if (!left || !right) return left + right;
  const a = left[left.length - 1];
  const b = right[0];
  const vv = JOIN_VOWELS[a + b];
  if (vv) return left.slice(0, -1) + vv + right.slice(1);
  if ((a === 'i' || a === 'I') && isVowel(b)) return left.slice(0, -1) + 'y' + right;
  if ((a === 'u' || a === 'U') && isVowel(b)) return left.slice(0, -1) + 'v' + right;
  if (a === 't' && isVoiced(b)) return left.slice(0, -1) + 'd' + right;
  if (a === 'k' && isVoiced(b)) return left.slice(0, -1) + 'g' + right;
  if (a === 'H' && 'aA'.includes(left[left.length - 2] ?? '') && isVoiced(b)) {
    return left.slice(0, -2) + (left[left.length - 2] === 'a' ? 'o' : 'A') + right;
  }
  return left + right;
}
