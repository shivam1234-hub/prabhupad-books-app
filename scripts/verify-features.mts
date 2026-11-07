// Verifies the two new features end-to-end against LIVE vedabase data:
//   1. extractChapterTitle() → real chapter name (the fix for hidden names)
//   2. parseVerseFromRsc()   → full inline content for the advanced view
// Run: node scripts/verify-features.mts   (Node >= 22.6 for TS type-stripping)
import { execFileSync } from 'node:child_process';
import {
  buildChapterUrl, buildVerseUrl, parseVerseFromRsc, extractVerseList,
} from '../src/services/vedabaseParser.ts';
import { extractChapterTitle } from '../src/services/vedabaseParser.ts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const get = (url: string) =>
  execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA, url], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✅ ${n}${d ? ' — ' + d : ''}`)) : (fail++, console.log(`  ❌ ${n} ${d}`)); };

console.log('\n[1] Chapter names (extractChapterTitle from <h1>)');
for (const [label, book, ch, canto] of [
  ['BG ch.1 (title in bundled data)', 'bg', 1, null],
  ['SB 3.1 (placeholder "Chapter 1" in data)', 'sb', 1, 3],
  ['CC madhya 5 (placeholder in data)', 'cc', 5, 2],
] as const) {
  const html = get(buildChapterUrl(book, ch as number, canto as number | null));
  const title = extractChapterTitle(html);
  ok(label, !!title && !/^chapter\s+\d+$/i.test(title!), title ?? '(none)');
}

console.log('\n[2] Advanced view content (parseVerseFromRsc full sections)');
for (const [label, book, ch, verse, canto] of [
  ['BG 1.1 all sections', 'bg', 1, '1', null],
  ['SB 1.1.1 all sections', 'sb', 1, '1', 1],
] as const) {
  const html = get(buildVerseUrl(book, ch as number, verse as string, canto as number | null));
  const d = parseVerseFromRsc(html, verse as string) || {};
  const have = ['devanagari', 'verse_text', 'synonyms', 'translation', 'purport'].filter((k) => (d as any)[k]);
  ok(label, have.length >= 4, 'sections: ' + have.join(', '));
}

console.log('\n[3] Advanced view iterates the real verse list (incl. combined verses)');
const bgHtml = get(buildChapterUrl('bg', 1, null));
const ids = extractVerseList(bgHtml, 'bg', 1, null);
ok('BG ch.1 verse list', ids.length > 10 && ids.some((i) => i.includes('-')), `${ids.length} ids, e.g. ${ids.slice(0, 6).join(', ')}`);

console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
