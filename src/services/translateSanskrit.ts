/**
 * Prepares English verse text for machine translation: Sanskrit words written
 * with diacritics ("Śrī Kṛṣṇa", "Paramātmā") are rewritten in the target
 * language's own script first. The translator does not know IAST and mangles
 * it ("śrī kaa"), but it passes words already in the target script through.
 * Pure (no React Native), so it can be tested with Node.
 */
import { iastToSlp1 } from './sanskrit/sanskritTranslit';
import type { TranslateLang } from '@/types';

const CONS: Record<string, string> = {
  k: 'क', K: 'ख', g: 'ग', G: 'घ', N: 'ङ', c: 'च', C: 'छ', j: 'ज', J: 'झ', Y: 'ञ',
  w: 'ट', W: 'ठ', q: 'ड', Q: 'ढ', R: 'ण', t: 'त', T: 'थ', d: 'द', D: 'ध', n: 'न',
  p: 'प', P: 'फ', b: 'ब', B: 'भ', m: 'म', y: 'य', r: 'र', l: 'ल', v: 'व',
  S: 'श', z: 'ष', s: 'स', h: 'ह',
};
const VOWEL: Record<string, string> = {
  a: 'अ', A: 'आ', i: 'इ', I: 'ई', u: 'उ', U: 'ऊ', f: 'ऋ', F: 'ॠ', x: 'ऌ', X: 'ॡ',
  e: 'ए', E: 'ऐ', o: 'ओ', O: 'औ',
};
const SIGN: Record<string, string> = {
  a: '', A: 'ा', i: 'ि', I: 'ी', u: 'ु', U: 'ू', f: 'ृ', F: 'ॄ', x: 'ॢ', X: 'ॣ',
  e: 'े', E: 'ै', o: 'ो', O: 'ौ',
};
const VIRAMA = '्';

/** SLP1 → Devanagari. */
export function slp1ToDevanagari(slp: string): string {
  let out = '';
  for (let i = 0; i < slp.length; i++) {
    const ch = slp[i];
    if (CONS[ch]) {
      const next = slp[i + 1];
      if (next !== undefined && next in SIGN) { out += CONS[ch] + SIGN[next]; i++; }
      else out += CONS[ch] + VIRAMA;
    } else if (VOWEL[ch]) out += VOWEL[ch];
    else if (ch === 'M') out += 'ं';
    else if (ch === 'H') out += 'ः';
    else if (ch === "'") out += 'ऽ';
    else out += ch;
  }
  return out;
}

// The Brahmic scripts share Devanagari's layout, one Unicode block apart.
const BLOCK_OFFSET: Partial<Record<TranslateLang, number>> = {
  bn: 0x0980 - 0x0900, gu: 0x0a80 - 0x0900, te: 0x0c00 - 0x0900, kn: 0x0c80 - 0x0900,
};

function fromDevanagari(dev: string, lang: TranslateLang): string {
  const off = BLOCK_OFFSET[lang];
  if (!off) return dev;
  let out = '';
  for (const ch of dev) {
    // Bengali writes va with the ba letter.
    if (lang === 'bn' && ch === 'व') { out += 'ব'; continue; }
    const c = ch.codePointAt(0)!;
    out += c >= 0x0900 && c <= 0x097f ? String.fromCodePoint(c + off) : ch;
  }
  return out;
}

/** "Kṛṣṇa" → "Krishna": for scripts that can't spell Sanskrit letter for letter. */
function plainRoman(word: string): string {
  return word.normalize('NFC')
    .replace(/[ṛṝ]/g, 'ri').replace(/[ṚṜ]/g, 'Ri')
    .replace(/[śṣ]/g, 'sh').replace(/[ŚṢ]/g, 'Sh')
    .replace(/c(?!h)/g, 'ch').replace(/C(?!h)/g, 'Ch')
    .normalize('NFD').replace(/\p{M}/gu, '');
}

const DIACRITIC = /[āīūṛṝḷḹṁṃḥṅñṭḍṇśṣĀĪŪṚṜḶṀṂḤṄÑṬḌṆŚṢ]/;
const PLAIN_ONLY = new Set<TranslateLang>(['ta', 'ur']);

function convertWord(word: string, lang: TranslateLang): string {
  if (PLAIN_ONLY.has(lang)) return plainRoman(word);
  const parts = word.split('-').map(part => {
    const slp = iastToSlp1(part);
    return slp ? fromDevanagari(slp1ToDevanagari(slp), lang) : null;
  });
  // Any part that isn't Sanskrit (an English word in a compound): leave it all.
  return parts.every(p => p !== null) ? parts.join('-') : word;
}

/** Rewrites every IAST word in `text` for translation into `lang`. */
export function prepareForTranslation(text: string, lang: TranslateLang): string {
  return text.normalize('NFC').replace(
    // A word (with hyphenated compounds), keeping a possessive ’s outside it.
    /[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu,
    w => (DIACRITIC.test(w) ? convertWord(w, lang) : w),
  );
}
