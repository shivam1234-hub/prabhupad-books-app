import { Platform } from 'react-native';
import { format } from 'date-fns';
import { Verse } from '@/types';
import { saveDailySloka } from '@/database/queries';
import { generateAndDownloadWallpaper, shortVerseRef } from './generateWallpaper';
import { generateAndSetWallpaper, type WallpaperFlag } from 'wallpaper-setter';

export const verseReference = shortVerseRef;

/**
 * One-tap action used from any sloka: pins the verse as today's sloka (so it
 * shows on the Home screen) AND applies it as the wallpaper on the home & lock
 * screen — no extra navigation. On web it downloads the wallpaper PNG instead.
 */
export async function setVerseAsWallpaperAndToday(
  verse: Verse,
  isDark: boolean,
  accent: string,
  flag: WallpaperFlag = 'both',
): Promise<void> {
  // 1. Pin as today's sloka so the Home screen reflects it immediately.
  const today = format(new Date(), 'yyyy-MM-dd');
  await saveDailySloka(today, verse.bookSlug, verse.chapter, String(verse.verse), verse.canto);

  // 2. Apply the wallpaper (the three-field, auto-fitting design).
  if (Platform.OS === 'web') {
    await generateAndDownloadWallpaper({ verse, isDark, accent });
    return;
  }
  await generateAndSetWallpaper(
    {
      transliteration: verse.transliteration ?? '',
      wordForWord: verse.synonyms ?? '',
      translation: verse.translation ?? '',
      reference: verseReference(verse),
      isDark,
    },
    flag,
  );
}
