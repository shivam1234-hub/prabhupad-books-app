/**
 * "Verses Most Quoted by Śrīla Prabhupāda" (Bhaktivedanta Archives), bundled
 * so it works offline: the 180 verses he quoted most, ranked by how often; the
 * auspicious invocation prayers; and the full text of every selected verse.
 * Built by scripts/build-most-quoted.py.
 */
import data from '@/data/mostQuotedVerses.json';
import type { LibraryRef } from '@/services/purport/citations';
import { fold } from '@/services/purport/citations';

export interface QuotedVerse {
  id: number;
  /** Index into SECTIONS. */
  section: number;
  /** "Bhagavad-gītā 2.13", "Śrī Śrī Śikṣāṣṭaka (3)". */
  title: string | null;
  author?: string;
  /** Verse lines; a blank line separates stanzas of a combined verse. */
  text: string;
  synonyms: string;
  translation: string;
  /** Who is speaking to whom, or where else the verse is found. */
  attribution?: string;
  note?: string;
  /** Where to read it in the library, when the book is in it. */
  ref?: LibraryRef;
}

export interface RankedEntry {
  rank: number;
  /** "1400+", "100+". */
  times: string;
  /** As in the list (no diacritics). */
  firstLine: string;
  /** As in the list ("Bg 18.66", "Kali-S Upan."). */
  source: string;
  verseId?: number;
  ref?: LibraryRef;
}

export interface Prayer {
  title: string;
  author?: string;
  verseIds: number[];
}

const D = data as unknown as {
  sections: string[];
  ranked: RankedEntry[];
  prayers: Prayer[];
  verses: QuotedVerse[];
};

export const SECTIONS = D.sections;
export const RANKED = D.ranked;
export const PRAYERS = D.prayers;
export const QUOTED_VERSES = D.verses;

const byId = new Map(QUOTED_VERSES.map(v => [v.id, v]));
export const quotedVerse = (id: number | undefined) => (id == null ? undefined : byId.get(id));

/** Rank of each verse in the most-quoted list. */
const rankOf = new Map<number, RankedEntry>();
for (const r of RANKED) if (r.verseId != null && !rankOf.has(r.verseId)) rankOf.set(r.verseId, r);
export const rankFor = (verseId: number) => rankOf.get(verseId);

const SPEAKER = /\buvāca$/;

/** The opening line of a verse, skipping a "śrī-bhagavān uvāca" line. */
export function firstLine(v: QuotedVerse): string {
  const lines = v.text.split('\n').filter(l => l.trim());
  return (lines.length > 1 && SPEAKER.test(lines[0].trim()) ? lines[1] : lines[0]) ?? '';
}

/** "Bhagavad-gītā 2.13" — the verse's own heading, or the list's source. */
export function rankedTitle(r: RankedEntry): string {
  return quotedVerse(r.verseId)?.title ?? r.source;
}

/** "Selected Verses from Bhagavad-gītā" → "Bhagavad-gītā". */
export function sectionName(i: number): string {
  const s = (SECTIONS[i] ?? '').replace(/^Selected Verse(?: Song)?s? from (?:the )?/i, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Search text for a verse: title, verse and translation, without diacritics. */
const haystack = new Map<number, string>();
export function matchesQuery(v: QuotedVerse | undefined, q: string, extra = ''): boolean {
  if (!q) return true;
  if (!v) return fold(extra).includes(q);
  let h = haystack.get(v.id);
  if (h == null) {
    h = fold(`${v.title ?? ''} ${v.text} ${v.translation}`).replace(/\s+/g, ' ');
    haystack.set(v.id, h);
  }
  return h.includes(q) || (!!extra && fold(extra).includes(q));
}

export { fold };
