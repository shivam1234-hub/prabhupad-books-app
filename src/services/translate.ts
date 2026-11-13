/**
 * Machine translation of a verse's translation and purport into an Indian
 * language, on the device (Google ML Kit, Android). This is NOT a BBT
 * translation: the screen labels it as such and keeps the original one tap
 * away. The Sanskrit, transliteration and word-for-word are never translated.
 */
import type { TranslateLang, Verse } from '@/types';
import {
  isTranslationAvailable, isModelDownloaded, downloadModel, translateTexts,
} from 'on-device-translate';

export type { TranslateLang };

/** The Indian languages ML Kit translates into, with their own names. */
export const TRANSLATE_LANGUAGES: { code: TranslateLang; native: string; english: string }[] = [
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'ur', native: 'اردو', english: 'Urdu' },
];

export const languageName = (code: TranslateLang) =>
  TRANSLATE_LANGUAGES.find(l => l.code === code) ?? TRANSLATE_LANGUAGES[0];

export { isTranslationAvailable, isModelDownloaded, downloadModel };

export interface TranslatedVerse {
  translation?: string;
  purport?: string;
}

// Paragraphs as VerseContent splits them, so each translates on its own.
const paras = (s: string | undefined) => (s ? s.split(/\n{2,}/) : []);

// This session's translations, so going back to a verse is instant.
const cache = new Map<string, TranslatedVerse>();
const MAX_CACHED = 60;

/** Translates the verse's translation and purport. The model must be downloaded. */
export async function translateVerse(verse: Verse, lang: TranslateLang): Promise<TranslatedVerse> {
  const key = `${verse.id}|${lang}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const t = paras(verse.translation);
  const p = paras(verse.purport);
  const out = await translateTexts([...t, ...p], lang);
  const result: TranslatedVerse = {
    translation: t.length ? out.slice(0, t.length).join('\n\n') : undefined,
    purport: p.length ? out.slice(t.length).join('\n\n') : undefined,
  };

  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
