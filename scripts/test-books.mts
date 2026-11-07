// End-to-end parser/URL tests against LIVE vedabase.io pages.
// Runs the real code from src/services/vedabaseParser.ts — no device needed.
//
//   npm run test:books         (requires Node >= 22.6 for TS type-stripping)
//
// Fetches via `curl` (the host trusts the network's TLS chain; Node fetch may
// not). Covers every book URL scheme + the edge cases we've hit: combined
// verses, $-ref resolution, flat books, and prose pages.
import { execFileSync } from 'node:child_process';
import {
  buildVerseUrl,
  buildChapterUrl,
  parseVerseFromRsc,
  extractVerseList,
  isChallengeOrEmpty,
  isFlatBook,
} from '../src/services/vedabaseParser.ts';

const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

function fetchHtml(url: string): string {
  return execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA, url], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

let passed = 0;
let failed = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; fails.push(name); console.log(`  ❌ ${name}  ${detail}`); }
}

// ── Pure URL-scheme assertions (no network) ─────────────────────────────────
console.log('\n[URL schemes]');
check('BG verse', buildVerseUrl('bg', 1, '1') === 'https://vedabase.io/en/library/bg/1/1/');
check('SB canto verse', buildVerseUrl('sb', 1, '1', 1) === 'https://vedabase.io/en/library/sb/1/1/1/');
check('CC lila (adi)', buildVerseUrl('cc', 1, '1', 1) === 'https://vedabase.io/en/library/cc/adi/1/1/');
check('CC lila (madhya)', buildVerseUrl('cc', 5, '1', 2) === 'https://vedabase.io/en/library/cc/madhya/5/1/');
check('ISO flat', buildVerseUrl('iso', 1, '7') === 'https://vedabase.io/en/library/iso/7/');
check('KB flat', buildVerseUrl('kb', 1, '12') === 'https://vedabase.io/en/library/kb/12/');
check('flat detection', isFlatBook('kb') && isFlatBook('pqpa') && !isFlatBook('bg'));

// ── Live page assertions ────────────────────────────────────────────────────
type Case = {
  name: string; book: string; chapter: number; verse: string; canto?: number;
  expect: (d: any) => [boolean, string];
};
const verseCases: Case[] = [
  { name: 'BG 1.1 (full verse)', book: 'bg', chapter: 1, verse: '1',
    expect: d => [!!d?.translation && !!d?.verse_text && !!d?.synonyms && !!d?.purport, JSON.stringify(Object.keys(d||{}))] },
  { name: 'BG 1.16-18 (combined: all slokas labeled)', book: 'bg', chapter: 1, verse: '16-18',
    expect: d => [/TEXT 16/.test(d?.verse_text) && /TEXT 17/.test(d?.verse_text) && /TEXT 18/.test(d?.verse_text), (d?.verse_text||'').slice(0,40)] },
  { name: 'SB 1.1.1 ($-ref translation resolved)', book: 'sb', chapter: 1, verse: '1', canto: 1,
    expect: d => [!!d?.translation && !d.translation.startsWith('$'), (d?.translation||'').slice(0,30)] },
  { name: 'CC adi 1.1 (lila URL loads)', book: 'cc', chapter: 1, verse: '1', canto: 1,
    expect: d => [!!d?.translation, (d?.translation||'').slice(0,30)] },
  { name: 'ISO 7 (flat verse)', book: 'iso', chapter: 1, verse: '7',
    expect: d => [!!d?.translation, (d?.translation||'').slice(0,30)] },
  { name: 'NOI 1 (flat verse)', book: 'noi', chapter: 1, verse: '1',
    expect: d => [!!d?.translation, (d?.translation||'').slice(0,30)] },
  { name: 'KB 1 (flat prose body)', book: 'kb', chapter: 1, verse: '1',
    expect: d => [!!d?.translation && d.translation.length > 500, `${(d?.translation||'').length} chars`] },
  { name: 'PQPA 1 (prose body)', book: 'pqpa', chapter: 1, verse: '1',
    expect: d => [!!d?.translation && d.translation.length > 500, `${(d?.translation||'').length} chars`] },
  { name: 'TLC 1 (prose body)', book: 'tlc', chapter: 1, verse: '1',
    expect: d => [!!d?.translation && d.translation.length > 500, `${(d?.translation||'').length} chars`] },
];

console.log('\n[Live verse pages]');
for (const c of verseCases) {
  try {
    const url = buildVerseUrl(c.book, c.chapter, c.verse, c.canto);
    const html = fetchHtml(url);
    if (isChallengeOrEmpty(html)) { check(c.name, false, 'challenge/empty page'); continue; }
    const data = parseVerseFromRsc(html, c.verse);
    const [ok, detail] = c.expect(data);
    check(c.name, ok, detail);
  } catch (e: any) {
    check(c.name, false, `threw: ${e.message}`);
  }
}

// ── Chapter verse-list extraction ────────────────────────────────────────────
console.log('\n[Chapter verse lists]');
const listCases = [
  { name: 'BG ch1 list incl combined 16-18', book: 'bg', chapter: 1, canto: undefined as number | undefined,
    expect: (ids: string[]) => [ids.includes('16-18') && ids.length >= 39, `n=${ids.length}`] as [boolean, string] },
  { name: 'CC adi ch1 list non-empty', book: 'cc', chapter: 1, canto: 1,
    expect: (ids: string[]) => [ids.length > 0, `n=${ids.length}`] as [boolean, string] },
  { name: 'KB root lists 90 pages', book: 'kb', chapter: 1, canto: undefined,
    expect: (ids: string[]) => [ids.length === 90, `n=${ids.length}`] as [boolean, string] },
];
for (const c of listCases) {
  try {
    const url = buildChapterUrl(c.book, c.chapter, c.canto);
    const html = fetchHtml(url);
    const ids = extractVerseList(html, c.book, c.chapter, c.canto);
    const [ok, detail] = c.expect(ids);
    check(c.name, ok, detail);
  } catch (e: any) {
    check(c.name, false, `threw: ${e.message}`);
  }
}

// ── Prose-book chapter titles (baked vs live) ───────────────────────────────
import { CHAPTER_TITLES } from '../src/constants/chapterTitles.ts';
console.log('\n[Prose chapter titles]');
const titleCounts: Record<string, number> = { kb: 90, nod: 51, tlc: 32, tqk: 26, tlk: 18, pqpa: 9, ssr: 8, bbd: 5, rv: 8 };
for (const [slug, n] of Object.entries(titleCounts)) {
  check(`${slug}: ${n} baked titles`, CHAPTER_TITLES[slug]?.length === n, `got ${CHAPTER_TITLES[slug]?.length}`);
}
try {
  // Drift check: live KB landing page still has 90 chapters and title[0] matches.
  const html = fetchHtml('https://vedabase.io/en/library/kb/');
  const re = /href="\/en\/library\/kb\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/g;
  const ids = new Set<string>(); let m: RegExpExecArray | null; let first = '';
  while ((m = re.exec(html)) !== null) {
    if (!ids.has(m[1])) {
      if (ids.size === 0) {
        const t = m[2].replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '').trim();
        first = t.includes(': ') ? t.split(': ').slice(1).join(': ') : t;
      }
      ids.add(m[1]);
    }
  }
  check('KB titles match live (count + first)', ids.size === 90 && first === CHAPTER_TITLES.kb[0], `live=${ids.size}, first="${first}"`);
} catch (e: any) { check('KB titles match live', false, e.message); }

// ── Front-matter pages (introduction, preface, foreword) ────────────────────
console.log('\n[Front matter]');
check('BG intro URL', buildVerseUrl('bg', 1, 'introduction') === 'https://vedabase.io/en/library/bg/introduction/');
check('KB preface URL', buildVerseUrl('kb', 1, 'preface') === 'https://vedabase.io/en/library/kb/preface/');
const fmCases = [
  { name: 'BG introduction loads', book: 'bg', page: 'introduction' },
  { name: 'BG preface loads', book: 'bg', page: 'preface' },
  { name: 'BS foreword loads', book: 'bs', page: 'foreword' },
  { name: 'TLC prologue loads', book: 'tlc', page: 'prologue' },
  { name: 'RKD prologue loads', book: 'rkd', page: 'prologue' },
  { name: 'RKD appendix 3 loads', book: 'rkd', page: 'appendix-3-birth-and-history-of-hanuman' },
];
for (const c of fmCases) {
  try {
    const html = fetchHtml(buildVerseUrl(c.book, 1, c.page));
    const d = parseVerseFromRsc(html, c.page);
    check(c.name, !!d?.translation && d.translation.length > 200, `${(d?.translation || '').length} chars`);
  } catch (e: any) { check(c.name, false, e.message); }
}

// ── Līlāmṛta (chapter-page book: /spl/{vol}/{ch}/) ──────────────────────────
console.log('\n[Līlāmṛta / chapter-page]');
check('SPL vol1 ch1 URL', buildVerseUrl('spl', 1, '', 1) === 'https://vedabase.io/en/library/spl/1/1/');
check('SPL vol2 ch37 URL', buildVerseUrl('spl', 37, '', 2) === 'https://vedabase.io/en/library/spl/2/37/');
for (const [name, vol, ch] of [['SPL 1.1 loads', 1, 1], ['SPL 2.37 loads', 2, 37]] as [string, number, number][]) {
  try {
    const html = fetchHtml(buildVerseUrl('spl', ch, '', vol));
    const d = parseVerseFromRsc(html, '');
    check(name, !!d?.translation && d.translation.length > 200, `${(d?.translation || '').length} chars`);
  } catch (e: any) { check(name, false, e.message); }
}
check('RKD part3 ch15 URL', buildVerseUrl('rkd', 15, '', 3) === 'https://vedabase.io/en/library/rkd/3/15/');
for (const [name, part, ch] of [['RKD 1.1 loads', 1, 1], ['RKD 3.15 loads', 3, 15]] as [string, number, number][]) {
  try {
    const html = fetchHtml(buildVerseUrl('rkd', ch, '', part));
    const d = parseVerseFromRsc(html, '');
    check(name, !!d?.translation && d.translation.length > 200, `${(d?.translation || '').length} chars`);
  } catch (e: any) { check(name, false, e.message); }
}

// ── Vanisource books (MediaWiki API) ────────────────────────────────────────
import { buildVanisourceUrl, extractVanisourceProse, isVanisourceBook } from '../src/services/vanisourceParser.ts';
import { VANISOURCE_CHAPTERS } from '../src/constants/vanisourceData.ts';
console.log('\n[Vanisource]');
check('isVanisourceBook(ej)', isVanisourceBook('ej') && !isVanisourceBook('bg'));
check('catalog has 20 books', Object.keys(VANISOURCE_CHAPTERS).length === 20, `${Object.keys(VANISOURCE_CHAPTERS).length}`);
const vsCases = [
  ['Easy Journey', 'ej'],
  ['Message of Godhead', 'mg'],
  ['Nārada Bhakti Sūtra', 'nbs'],
  ['Topmost Yoga', 'tys'],
] as [string, string][];
for (const [name, slug] of vsCases) {
  try {
    const ch = VANISOURCE_CHAPTERS[slug];
    // pick a content chapter (skip the title page at index 0 if more exist)
    const page = (ch[1] ?? ch[0]).id;
    const json = fetchHtml(buildVanisourceUrl(page));
    const prose = extractVanisourceProse(json);
    check(`${name} chapter loads`, prose.length > 120, `${prose.length} chars`);
  } catch (e: any) { check(`${name} chapter loads`, false, e.message); }
}

console.log(`\n${failed === 0 ? '✅ ALL PASSED' : '❌ FAILURES'} — ${passed} passed, ${failed} failed`);
if (failed) { console.log('failed:', fails.join('; ')); process.exit(1); }
