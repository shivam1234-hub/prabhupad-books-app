import { Verse } from '@/types';
import { findVersesByTransliteration } from '@/database/queries';
import { verseLabel } from '@/services/dictionary';
import { findCitations, LibraryRef } from './citations';
import { FoundVerse, lettersOnly, mapPurport, MappedLine, quoteKey, StudySource } from './purportSources';

const refOf = (v: Verse): LibraryRef => ({
  bookSlug: v.bookSlug as LibraryRef['bookSlug'], canto: v.canto, chapter: v.chapter, verse: String(v.verse),
});

/**
 * The verse a quotation is from, when a downloaded book has it: its first
 * line (letters only, diacritics off) must stand in that verse's text.
 * A half-verse quoted alone is found the same way.
 */
async function findQuote(quote: string, currentId: string): Promise<FoundVerse | null> {
  const lines = quote.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 2)) {
    const words = quoteKey(line);
    if (words.length < 2) continue;
    const key = lettersOnly(line);
    const candidates = await findVersesByTransliteration(words.slice(0, 5));
    const hit = candidates.find(v => v.id !== currentId && v.transliteration && lettersOnly(v.transliteration).includes(key));
    if (hit) return { ref: refOf(hit), label: verseLabel(hit), transliteration: hit.transliteration! };
  }
  return null;
}

// [rel, work, num, why, quote, page?] — page: the BG verse a range opens (17.8-10 → 17.8).
type StudyRow = [StudySource['rel'], string, string, string, string, string?];
type StudyData = Record<string, ([string, StudyRow[]] | null)[]>;
let bgStudy: StudyData | null = null;

// Short names the study uses → the names the citation reader knows.
const WORK_PREFIX: Record<string, string> = { BG: 'Bg.', SB: 'SB', CC: 'Cc.' };

function studySource(row: StudyRow, verse: Verse): StudySource {
  const [rel, work, num, why, quote, page] = row;
  const here = rel === 'this';
  const written = `${WORK_PREFIX[work] ?? work} ${num}`.trim();
  const cited = num ? findCitations(written)[0] : undefined;
  if (cited?.ref && page) cited.ref = { ...cited.ref, verse: page.split('.').pop()! };
  const label = here ? verseLabel(verse)
    : cited ? cited.label
      : `${work === 'BG' ? 'Bhagavad-gītā' : work === 'SB' ? 'Śrīmad-Bhāgavatam' : work === 'CC' ? 'Śrī Caitanya-caritāmṛta' : work}${num ? ` ${num}` : ''}`;
  return { rel, label, ref: here ? refOf(verse) : cited?.ref ?? null, why, quote };
}

/**
 * The study of the Bhagavad-gītā's purports: for each line, the verse of
 * śāstra it rests on. Used only for the very sentence it was made for (its
 * first letters must match), so a changed text never gets a wrong source.
 */
function withStudy(lines: MappedLine[], verse: Verse): MappedLine[] {
  if (verse.bookSlug !== 'bg') return lines;
  bgStudy ??= require('../../data/bgPurportSources.json') as StudyData;
  const rows = bgStudy[`${verse.chapter}.${verse.verseRange ?? verse.verse}`];
  if (!rows) return lines;
  return lines.map(l => {
    const r = rows[l.id];
    if (!r || lettersOnly(l.text).slice(0, 24) !== r[0]) return l;
    return { ...l, study: r[1].map(row => studySource(row, verse)) };
  });
}

/** Every line of this verse's purport, with its source. */
export async function mapVersePurport(verse: Verse): Promise<MappedLine[]> {
  const lines = await mapPurport(verse.purport ?? '', verse.bookSlug, q => findQuote(q, verse.id));
  return withStudy(lines, verse);
}
