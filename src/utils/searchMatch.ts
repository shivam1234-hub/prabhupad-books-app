// Shared, diacritic-insensitive search helpers used by both the native (FTS)
// and web (in-memory) search paths so results match across platforms.
//
// Sanskrit transliteration is full of diacritics — "tapo divyaṁ", "kṛṣṇa",
// "bhagavān". Users type plain ASCII ("tapo divyam", "krsna", "bhagavan"), so we
// fold diacritics away on both the stored text and the query before comparing.

// Combining diacritical marks block (U+0300–U+036F), matched via constructor so
// the range is unambiguous in source.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

// Lowercase + strip combining diacritical marks (ā→a, ṁ→m, ṛ→r, ś→s, ṣ→s, ḥ→h…).
export function foldText(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

// Per-character fold cache for foldIndexed: '' = drop (a bare combining mark).
const charFold = new Map<number, string>();
function foldChar(code: number): string {
  let f = charFold.get(code);
  if (f === undefined) {
    const ch = String.fromCharCode(code);
    const r = foldText(ch);
    f = r.length <= 1 ? r : ch; // keep the 1:1 mapping for odd multi-char folds
    charFold.set(code, f);
  }
  return f;
}

export interface FoldedText {
  text: string;
  // folded index -> original index; null when they are identical (the usual
  // case, since stored text uses precomposed letters like ṛ ṣ ā).
  map: number[] | null;
}

// Same result as foldText, but character-by-character via a lookup table
// instead of normalizing the whole string, and it reports where each folded
// character came from, so a match found in the folded text can be highlighted
// in the original without re-scanning it. Much cheaper than foldText on long
// purports, especially on Hermes.
const NON_ASCII = /[^\x00-\x7f]/g;
export function foldIndexed(s: string): FoldedText {
  const lower = s.toLowerCase();
  // toLowerCase can change length for a few exotic letters (e.g. İ); then use
  // the plain lowercase fold, whose output can't be mapped back reliably.
  if (lower.length !== s.length) return { text: foldText(s), map: null };
  let out = '';
  let map: number[] | null = null;
  let runStart = 0; // start of the pending run of chars that fold to themselves
  NON_ASCII.lastIndex = 0;
  // ASCII is already final after toLowerCase, so only visit non-ASCII chars —
  // the regex engine skips the (vast) ASCII stretches natively.
  for (let m = NON_ASCII.exec(lower); m; m = NON_ASCII.exec(lower)) {
    const i = m.index;
    const f = foldChar(lower.charCodeAt(i));
    if (f === lower[i]) continue;
    out += lower.slice(runStart, i);
    if (map) for (let k = runStart; k < i; k++) map.push(k);
    if (f === '') {
      if (!map) {
        map = [];
        for (let k = 0; k < out.length; k++) map.push(k);
      }
    } else {
      out += f;
      if (map) map.push(i);
    }
    runStart = i + 1;
  }
  if (runStart === 0) return { text: lower, map: null };
  out += lower.slice(runStart);
  if (map) for (let k = runStart; k < lower.length; k++) map.push(k);
  return { text: out, map };
}

// Split a query into normalized word terms (letters/numbers only, any script).
// Punctuation separates words exactly like the FTS tokenizer does, so
// "so-called" is "so" + "called" (not "socalled", which matches nothing).
export function queryTerms(q: string): string[] {
  return foldText(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// FTS5 candidate expression: any term as a word prefix. 1–2 letter terms
// ("so", "of") would pull in most of the library, so they're left out
// whenever a longer term is present — ranking still uses every term.
export function ftsWordsExpr(terms: string[]): string {
  const useful = terms.filter((t) => t.length >= 3);
  return (useful.length ? useful : terms).map((t) => `"${t}"*`).join(' OR ');
}

// FTS5 exact-phrase expression, or null for one word. The tokenizer drops
// punctuation, so "so called scholars" also finds "so-called scholars"; the
// trailing * makes the LAST word a prefix, so "soka bhaya" finds "śoka-bhayam".
export function ftsPhraseExpr(terms: string[]): string | null {
  return terms.length >= 2 ? `"${terms.join(' ')}"*` : null;
}

// True when EVERY term appears (as a substring, any order) in the haystack —
// the flexible, Google/Slack-style AND match.
export function matchesAllTerms(haystack: string, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const h = foldText(haystack);
  return terms.every((t) => h.includes(t));
}

// Edit distance with adjacent-transposition as a single edit (so "gtia" is
// distance 1 from "gita", not 2) — the single most common human typo pattern,
// so it matters more here than the rest of true Damerau-Levenshtein does.
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Same metric as editDistance, but only answers "is it <= max?" — reuses
// three row buffers and stops once whole rows exceed max, so the
// typo-tolerant search fallback doesn't allocate a table per word.
let rowA = new Int32Array(32), rowB = new Int32Array(32), rowC = new Int32Array(32);
export function withinEditDistance(a: string, b: string, max: number): boolean {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > max) return false;
  if (n + 1 > rowA.length) {
    rowA = new Int32Array(n + 1); rowB = new Int32Array(n + 1); rowC = new Int32Array(n + 1);
  }
  let prev2 = rowA, prev = rowB, cur = rowC; // rows i-2, i-1, i
  for (let j = 0; j <= n; j++) prev[j] = j;
  let prevMin = 0;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const bj = b.charCodeAt(j - 1);
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ai === bj ? 0 : 1));
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    // Transpositions reach back two rows, so stop only once two consecutive
    // rows are entirely over the limit — nothing later can come back under it.
    if (rowMin > max && prevMin > max) return false;
    prevMin = rowMin;
    const t = prev2; prev2 = prev; prev = cur; cur = t;
  }
  return prev[n] <= max;
}

// Typo tolerance scaled to word length — short words get almost no slack
// (else everything fuzzy-matches everything), long words get more.
export function fuzzyThreshold(len: number): number {
  if (len <= 4) return 1;
  if (len <= 9) return 2;
  return 3;
}
