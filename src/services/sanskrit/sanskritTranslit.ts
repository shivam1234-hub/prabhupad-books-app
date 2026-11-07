/**
 * IAST ⇄ SLP1 for the sandhi splitter.
 *
 * SLP1 spells every Sanskrit sound with exactly one ASCII letter (ā = A,
 * ṣ = z, ś = S, kh = K, ai = E …), so sandhi rules become single-character
 * comparisons and the Apte lexicon (scripts/build-apte.py) can be sorted and
 * binary-searched as plain ASCII. IAST is only for input and display.
 */

// Longest first: "kh" must win over "k", "ai" over "a".
const IAST_TO_SLP1: [string, string][] = [
  ['kh', 'K'], ['gh', 'G'], ['ch', 'C'], ['jh', 'J'], ['ṭh', 'W'], ['ḍh', 'Q'],
  ['th', 'T'], ['dh', 'D'], ['ph', 'P'], ['bh', 'B'], ['ai', 'E'], ['au', 'O'],
  ['ā', 'A'], ['ī', 'I'], ['ū', 'U'], ['ṛ', 'f'], ['ṝ', 'F'], ['ḷ', 'x'], ['ḹ', 'X'],
  ['ṁ', 'M'], ['ṃ', 'M'], ['ḥ', 'H'], ['ṅ', 'N'], ['ñ', 'Y'], ['ṭ', 'w'], ['ḍ', 'q'],
  ['ṇ', 'R'], ['ś', 'S'], ['ṣ', 'z'], ["'", "'"], ['’', "'"],
];

const SLP1_TO_IAST: Record<string, string> = {};
for (const [iast, slp] of IAST_TO_SLP1) if (!(slp in SLP1_TO_IAST)) SLP1_TO_IAST[slp] = iast;
SLP1_TO_IAST.M = 'ṁ'; // Prabhupāda's books (and vanisource) write anusvāra as ṁ

const PLAIN = /[a-z-]/;

/**
 * IAST (any case, NFC or NFD) → SLP1. Letters outside Sanskrit's alphabet
 * make it return null, so English words never reach the splitter.
 */
export function iastToSlp1(word: string): string | null {
  const s = word.normalize('NFC').toLowerCase()
    // r̥ / l̥ (ring below) are the ISO-15919 spellings of ṛ / ḷ.
    .replace(/r̥/g, 'ṛ').replace(/l̥/g, 'ḷ');
  let out = '';
  for (let i = 0; i < s.length;) {
    const pair = IAST_TO_SLP1.find(([iast]) => s.startsWith(iast, i));
    if (pair) {
      out += pair[1];
      i += pair[0].length;
      continue;
    }
    const ch = s[i];
    // f, q, w, x, z are SLP1 letters for other sounds; plain IAST never uses them.
    if (!PLAIN.test(ch) || 'fqwxz'.includes(ch)) return null;
    out += ch;
    i++;
  }
  return out;
}

export function slp1ToIast(slp: string): string {
  let out = '';
  for (const ch of slp) out += SLP1_TO_IAST[ch] ?? ch;
  return out;
}

export const VOWELS = 'aAiIuUfFxXeEoO';
export const isVowel = (ch: string | undefined) => !!ch && VOWELS.includes(ch);
/** Vowels, semivowels, nasals, voiced stops and h — what makes a preceding
 * t turn to d, or -aḥ to -o. */
export const isVoiced = (ch: string | undefined) => !!ch && (VOWELS + 'gGNjJYqQRdDnbBmyrlvh').includes(ch);
