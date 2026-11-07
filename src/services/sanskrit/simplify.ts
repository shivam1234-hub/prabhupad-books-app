/**
 * Simpler wording for Śrīla Prabhupāda's word-for-word, keeping his sense.
 *
 * His renderings are the authority for what a word means; this only rewords
 * the recurring phrases that make them hard for a newcomer ("the Supreme
 * Personality of Godhead", "fruitive work", "sense gratification", "unto").
 * Each rule is a fixed, reviewed phrase → phrase swap with the same meaning —
 * nothing is generated or guessed — and the reader is always shown his exact
 * words beside the simpler line, so the two can be compared.
 *
 * Rules are applied in order (longer phrases first, so "the Supreme
 * Personality of Godhead said" is handled before its parts).
 */

const RULES: [RegExp, string][] = [
  // The Lord.
  [/\bthe Supreme Personality of Godhead\b/gi, 'the Supreme Lord'],
  [/\bSupreme Personality of Godhead\b/gi, 'Supreme Lord'],
  [/\bthe Personality of Godhead\b/gi, 'the Lord'],
  [/\bPersonality of Godhead\b/gi, 'the Lord'],
  [/\bthe Supersoul\b/gi, 'the Lord in the heart (Supersoul)'],
  // The living being and matter.
  [/\bliving entities\b/gi, 'living beings'],
  [/\bliving entity\b/gi, 'living being'],
  [/\bconditioned souls\b/gi, 'souls bound by matter'],
  [/\bconditioned soul\b/gi, 'soul bound by matter'],
  [/\bmiserable material existence\b/gi, 'the suffering of material life'],
  [/\bmaterial existence\b/gi, 'material life'],
  [/\bcosmic manifestation\b/gi, 'universe'],
  [/\bmodes of material nature\b/gi, 'qualities of material nature'],
  [/\bmodes of nature\b/gi, 'qualities of nature'],
  [/\bnescience\b/gi, 'ignorance'],
  // Action and its results.
  [/\bfruitive activities\b/gi, 'work done for its results'],
  [/\bfruitive activity\b/gi, 'work done for its results'],
  [/\bfruitive work\b/gi, 'work done for its results'],
  [/\bfruitive reactions\b/gi, 'results of work'],
  [/\bsense gratification\b/gi, 'sense enjoyment'],
  [/\bprescribed duties\b/gi, 'assigned duties'],
  [/\bprescribed duty\b/gi, 'assigned duty'],
  [/\bthe performance of\b/gi, 'doing'],
  [/\bperformance of\b/gi, 'doing'],
  // Knowledge and practice.
  [/\bempiric philosophers\b/gi, 'speculative philosophers'],
  [/\bmental speculators\b/gi, 'speculators'],
  [/\bthe linking process of\b/gi, 'the yoga of'],
  [/\bdisciplic succession\b/gi, 'chain of teachers (paramparā)'],
  [/\bbona fide\b/gi, 'genuine'],
  // Old-style words.
  [/\bunto\b/gi, 'to'],
  [/\bverily\b/gi, 'truly'],
  [/\bthereafter\b/gi, 'then'],
  [/\bthereupon\b/gi, 'then'],
  [/\bwhereupon\b/gi, 'then'],
  [/\bhenceforward\b/gi, 'from now on'],
];

export interface SimplifiedMeaning {
  /** The simpler line (same as `original` when nothing needed rewording). */
  text: string;
  /** His exact words. */
  original: string;
  changed: boolean;
}

/** Keep the case of the first letter the way the phrase had it. */
function matchCase(found: string, repl: string): string {
  return /^[A-Z]/.test(found) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
}

export function simplifyMeaning(original: string): SimplifiedMeaning {
  let text = original;
  for (const [re, repl] of RULES) text = text.replace(re, m => matchCase(m, repl));
  text = text.replace(/\s{2,}/g, ' ').trim();
  return { text, original, changed: text !== original };
}
