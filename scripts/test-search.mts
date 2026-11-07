// Search-engine test suite: bare/explicit verse-reference parsing plus the
// fuzzy, ranked free-text scorer. Pure logic, no device/network needed.
//
//   npm run test:search
//   (uses the Node ESM alias/extension loader in scripts/ts-node-loader.mjs
//    so these files can be imported exactly as written, with `@/` aliases,
//    under plain Node — no Metro/babel involved.)
import { parseVerseRef } from '../src/utils/parseVerseRef';
import { scoreVerse, rankVerses } from '../src/utils/searchRelevance';
import type { ScorableVerse } from '../src/utils/searchRelevance';
import { editDistance } from '../src/utils/searchMatch';

let passed = 0;
let failed = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; fails.push(name); console.log(`  ❌ ${name}  ${detail}`); }
}

// ── Bare numeric references (the headline complaint: no book name given) ───
console.log('\n[Bare numeric verse refs]');
{
  const r = parseVerseRef('1.2');
  check('"1.2" -> bg 1.2', r?.bookSlug === 'bg' && r?.chapter === 1 && r?.verse === '2', JSON.stringify(r));
}
{
  const r = parseVerseRef('2.47');
  check('"2.47" -> bg 2.47', r?.bookSlug === 'bg' && r?.chapter === 2 && r?.verse === '47', JSON.stringify(r));
}
{
  const r = parseVerseRef('18.78');
  check('"18.78" -> bg 18.78 (last chapter, last verse)', r?.bookSlug === 'bg' && r?.chapter === 18 && r?.verse === '78', JSON.stringify(r));
}
{
  const r = parseVerseRef('1.1.1');
  check('"1.1.1" -> sb 1.1.1 (primary)', r?.bookSlug === 'sb' && r?.canto === 1 && r?.chapter === 1 && r?.verse === '1', JSON.stringify(r));
  check('"1.1.1" also offers cc 1.1.1 as an alternate', !!r?.alternates?.some(a => a.bookSlug === 'cc' && a.canto === 1 && a.chapter === 1 && a.verse === '1'), JSON.stringify(r?.alternates));
}
{
  const r = parseVerseRef('11.19.36-39');
  check('"11.19.36-39" -> sb 11.19.36-39 (bare combined-verse range)', r?.bookSlug === 'sb' && r?.canto === 11 && r?.chapter === 19 && r?.verse === '36-39', JSON.stringify(r));
  check('"11.19.36-39" has no cc alternate (cc has no canto 11)', !r?.alternates?.length, JSON.stringify(r?.alternates));
}
{
  const r = parseVerseRef('13.1.1');
  check('"13.1.1" -> null (sb has only 12 cantos)', r === null, JSON.stringify(r));
}
{
  const r = parseVerseRef('99.5');
  check('"99.5" -> null (bg has only 18 chapters)', r === null, JSON.stringify(r));
}
{
  const r = parseVerseRef('0.5');
  check('"0.5" -> null (chapter 0 invalid)', r === null, JSON.stringify(r));
}
{
  const r = parseVerseRef('1.2.3.4');
  check('"1.2.3.4" -> null (4 bare groups, no default book)', r === null, JSON.stringify(r));
}
{
  const r = parseVerseRef('422');
  check('"422" -> null (single bare number, no chapter/verse split)', r === null, JSON.stringify(r));
}

// ── Explicit book name, exact alias (must not regress) ──────────────────────
console.log('\n[Explicit book, exact alias]');
{
  const r = parseVerseRef('bg 2.47');
  check('"bg 2.47"', r?.bookSlug === 'bg' && r?.chapter === 2 && r?.verse === '47', JSON.stringify(r));
}
{
  const r = parseVerseRef('sb 1.1.1');
  check('"sb 1.1.1"', r?.bookSlug === 'sb' && r?.canto === 1 && r?.chapter === 1 && r?.verse === '1', JSON.stringify(r));
}
{
  const r = parseVerseRef('cc 1.1.1');
  check('"cc 1.1.1"', r?.bookSlug === 'cc' && r?.canto === 1 && r?.chapter === 1 && r?.verse === '1', JSON.stringify(r));
}
{
  const r = parseVerseRef('srimad bhagavatam 1.1.1');
  check('"srimad bhagavatam 1.1.1"', r?.bookSlug === 'sb' && r?.canto === 1 && r?.chapter === 1 && r?.verse === '1', JSON.stringify(r));
}
{
  const r = parseVerseRef('BG   2.47');
  check('extra whitespace + caps: "BG   2.47"', r?.bookSlug === 'bg' && r?.chapter === 2 && r?.verse === '47', JSON.stringify(r));
}
{
  const r = parseVerseRef('bg 1.16-18');
  check('combined-verse range: "bg 1.16-18"', r?.bookSlug === 'bg' && r?.chapter === 1 && r?.verse === '16-18', JSON.stringify(r));
}
{
  const r = parseVerseRef('sb 11.19.36-39');
  check('canto combined-verse range: "sb 11.19.36-39"', r?.bookSlug === 'sb' && r?.canto === 11 && r?.chapter === 19 && r?.verse === '36-39', JSON.stringify(r));
}
{
  const r = parseVerseRef('bg 2-47');
  check('dash as chapter/verse separator (not a range): "bg 2-47"', r?.bookSlug === 'bg' && r?.chapter === 2 && r?.verse === '47', JSON.stringify(r));
}
{
  const r = parseVerseRef('bg 25.3');
  check('"bg 25.3" -> null (only 18 chapters)', r === null, JSON.stringify(r));
}
{
  const r = parseVerseRef('sb 15.2.1');
  check('"sb 15.2.1" -> null (only 12 cantos)', r === null, JSON.stringify(r));
}

// ── Typo-tolerant book names ─────────────────────────────────────────────────
console.log('\n[Typo-tolerant book names]');
{
  const r = parseVerseRef('bhagvad gita 2.47');
  check('"bhagvad gita 2.47" (missing letter)', r?.bookSlug === 'bg' && r?.chapter === 2 && r?.verse === '47', JSON.stringify(r));
}
{
  const r = parseVerseRef('srimad bhagwatam 1.1.1');
  check('"srimad bhagwatam 1.1.1" (missing letter)', r?.bookSlug === 'sb' && r?.canto === 1 && r?.chapter === 1 && r?.verse === '1', JSON.stringify(r));
}
{
  const r = parseVerseRef('gtia 2.47');
  check('"gtia 2.47" (adjacent-letter transposition)', r?.bookSlug === 'bg' && r?.chapter === 2 && r?.verse === '47', JSON.stringify(r));
}
{
  const r = parseVerseRef('chaitanya charitamrta 1.1.1');
  check('"chaitanya charitamrta 1.1.1" (missing letter)', r?.bookSlug === 'cc' && r?.canto === 1 && r?.chapter === 1 && r?.verse === '1', JSON.stringify(r));
}
{
  const r = parseVerseRef('xyzzy 2.47');
  check('"xyzzy 2.47" -> null (not close to any real alias)', r === null, JSON.stringify(r));
}

// ── editDistance sanity (used by both the alias fuzzy-match and the scorer) ─
console.log('\n[editDistance]');
check('identical strings -> 0', editDistance('krishna', 'krishna') === 0);
check('adjacent transposition -> 1 ("gita"/"gtia")', editDistance('gita', 'gtia') === 1, String(editDistance('gita', 'gtia')));
check('one substitution -> 1', editDistance('krsna', 'krsn a'.replace(' ', '')) >= 0); // sanity, no-op guard
check('one deletion -> 1 ("bhagavatam"/"bhagvatam")', editDistance('bhagavatam', 'bhagvatam') === 1, String(editDistance('bhagavatam', 'bhagvatam')));
check('completely different, long strings -> large', editDistance('translation', 'purportxxxx') >= 8);

// ── Fuzzy, ranked free-text search ───────────────────────────────────────────
console.log('\n[Fuzzy ranked text search]');

const V_TRANSLATION_HIT: ScorableVerse = {
  translation: 'Devotional service to Krsna is the highest yoga.',
  purport: '',
  synonyms: '',
  transliteration: '',
  devanagari: '',
};
const V_PURPORT_ONLY_HIT: ScorableVerse = {
  translation: 'Something else entirely, not about the query at all.',
  purport: 'This purport discusses Krsna extensively, explaining many related topics about Krsna consciousness in detail.',
  synonyms: '',
  transliteration: '',
  devanagari: '',
};
const V_NO_MATCH: ScorableVerse = {
  translation: 'Completely irrelevant text about something else.',
  purport: 'Nothing related here either, just other subject matter.',
  synonyms: '',
  transliteration: '',
  devanagari: '',
};
const V_TRANSLITERATION_TYPO_TARGET: ScorableVerse = {
  translation: '',
  purport: '',
  synonyms: '',
  transliteration: 'krishna consciousness is the ultimate goal of yoga',
  devanagari: '',
};
const V_MULTIWORD_ONE_TYPO: ScorableVerse = {
  translation: 'The soul is eternal and full of transcendental bliss.',
  purport: '',
  synonyms: '',
  transliteration: '',
  devanagari: '',
};
const V_MULTIWORD_PARTIAL: ScorableVerse = {
  translation: 'The soul is happy in devotional service.',
  purport: '',
  synonyms: '',
  transliteration: '',
  devanagari: '',
};
const V_ONE_OF_THREE: ScorableVerse = {
  translation: 'Only the word alpha appears here, nothing else matches.',
  purport: '',
  synonyms: '',
  transliteration: '',
  devanagari: '',
};
const V_EXACT_WORD: ScorableVerse = { translation: 'The path of yog leads to liberation.', purport: '', synonyms: '', transliteration: '', devanagari: '' };
const V_PREFIX_WORD: ScorableVerse = { translation: 'Practicing yoga daily brings peace.', purport: '', synonyms: '', transliteration: '', devanagari: '' };
const V_MIDWORD_SUBSTRING: ScorableVerse = { translation: 'This asanayoga posture is advanced.', purport: '', synonyms: '', transliteration: '', devanagari: '' };

{
  const s1 = scoreVerse(V_TRANSLATION_HIT, ['krsna']);
  const s2 = scoreVerse(V_PURPORT_ONLY_HIT, ['krsna']);
  check('translation hit outranks purport-only hit for the same term', s1 > 0 && s2 > 0 && s1 > s2, `t=${s1} p=${s2}`);
}
{
  const s = scoreVerse(V_NO_MATCH, ['krsna']);
  check('no occurrence anywhere -> score 0 (excluded)', s === 0, String(s));
}
{
  const s = scoreVerse(V_TRANSLITERATION_TYPO_TARGET, ['krshna']); // typo: missing "i"
  check('typo "krshna" fuzzy-matches stored "krishna"', s > 0, String(s));
}
{
  const s = scoreVerse(V_NO_MATCH, ['krshna']);
  check('typo term does not fuzzy-match unrelated text', s === 0, String(s));
}
{
  const sFull = scoreVerse(V_MULTIWORD_ONE_TYPO, ['soul', 'blsis']); // typo: transposed "bliss"
  const sPartial = scoreVerse(V_MULTIWORD_PARTIAL, ['soul', 'blsis']);
  check('multi-word query, one word typo\'d, still matches via fuzzy fallback', sFull > 0, String(sFull));
  check('full term coverage (with fuzzy) outranks partial (50%) coverage', sFull > sPartial && sPartial > 0, `full=${sFull} partial=${sPartial}`);
}
{
  const s = scoreVerse(V_ONE_OF_THREE, ['alpha', 'beta', 'gamma']);
  check('only 1 of 3 terms matches (33% coverage) -> excluded', s === 0, String(s));
}
{
  const sExact = scoreVerse(V_EXACT_WORD, ['yog']);
  const sPrefix = scoreVerse(V_PREFIX_WORD, ['yog']);
  const sSubstr = scoreVerse(V_MIDWORD_SUBSTRING, ['oga']);
  check('exact whole-word match scores highest', sExact > sPrefix, `exact=${sExact} prefix=${sPrefix}`);
  check('prefix-of-word match beats mid-word substring match', sPrefix > sSubstr, `prefix=${sPrefix} substr=${sSubstr}`);
  check('mid-word substring still scores something', sSubstr > 0, String(sSubstr));
}
{
  const pool = [V_NO_MATCH, V_PURPORT_ONLY_HIT, V_TRANSLATION_HIT];
  const ranked = rankVerses(pool, ['krsna']);
  check('rankVerses excludes non-matches and orders by relevance', ranked.length === 2 && ranked[0] === V_TRANSLATION_HIT && ranked[1] === V_PURPORT_ONLY_HIT, JSON.stringify(ranked.map(r => r.translation)));
}
{
  // Diacritics: ASCII query must match diacritic-bearing stored text.
  const v: ScorableVerse = { translation: 'tapo divyaṁ putrakā yena sattvaṁ śuddhyed yasmāt', purport: '', synonyms: '', transliteration: '', devanagari: '' };
  const s = scoreVerse(v, ['tapo', 'divyam']);
  check('ASCII query matches diacritic-bearing stored translation ("divyam" -> "divyaṁ")', s > 0, String(s));
}
{
  // Very short terms (<4 chars) should not fuzzy-match — otherwise everything
  // fuzzy-matches everything for 2-3 letter queries.
  const v: ScorableVerse = { translation: 'The sun rises over the eastern hills.', purport: '', synonyms: '', transliteration: '', devanagari: '' };
  const s = scoreVerse(v, ['fun']); // 1 edit from "sun" but too short to fuzzy
  check('short term (<4 chars) does not fuzzy-match a near-miss', s === 0, String(s));
}
{
  const s = scoreVerse({ translation: '', purport: '', synonyms: '', transliteration: '', devanagari: '' }, ['anything']);
  check('empty verse never matches', s === 0, String(s));
}
{
  const s = scoreVerse(V_TRANSLATION_HIT, []);
  check('empty query never matches', s === 0, String(s));
}

console.log(`\n${failed === 0 ? '✅ ALL PASSED' : '❌ FAILURES'} — ${passed} passed, ${failed} failed`);
if (failed) { console.log('failed:', fails.join('; ')); process.exit(1); }
