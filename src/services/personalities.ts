/**
 * Finds the less familiar personalities (constants/personalities.ts) named in
 * a piece of verse text, for the tap-to-preview card. Pure (no I/O).
 */
import { PERSONALITIES, Personality } from '@/constants/personalities';
import { fold } from '@/services/purport/citations';

export interface PersonalityMention {
  person: Personality;
  start: number;
  end: number;
}

let compiled: { re: RegExp; byGroup: Personality[] } | null = null;

/** One regex for every name, one capture group per personality. */
function matcher() {
  if (compiled) return compiled;
  // Longer patterns first, so "Svāyambhuva Manu" wins over "Manu" when both
  // could start at the same place.
  const list = [...PERSONALITIES].sort((a, b) => b.names.length - a.names.length);
  const re = new RegExp(
    // Whole names only: no letter may touch either end (’ and - may).
    `(?<![\\p{L}\\p{M}])(?:${list.map(p => `(${p.names})`).join('|')})(?![\\p{L}\\p{M}])`,
    'gu',
  );
  compiled = { re, byGroup: list };
  return compiled;
}

const CAPITAL = /\p{Lu}/u;

/**
 * Every personality named in `text`, in order. Only names written with a
 * capital letter count, so common words that fold to the same letters
 * ("bhīma", "sāgara") are skipped.
 */
export function findPersonalities(text: string): PersonalityMention[] {
  const { re, byGroup } = matcher();
  const f = fold(text);
  const out: PersonalityMention[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(f); m; m = re.exec(f)) {
    if (!CAPITAL.test(text[m.index])) continue;
    const g = m.findIndex((v, i) => i > 0 && v !== undefined);
    if (g < 1) continue;
    // "Bhṛgu’s": the possessive is left out of the link by the lookahead.
    out.push({ person: byGroup[g - 1], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export function getPersonality(id: string): Personality | undefined {
  return PERSONALITIES.find(p => p.id === id);
}
