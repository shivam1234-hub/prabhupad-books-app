// Non-native notification path.
//
// In a plain browser this stays a stub — a web page cannot schedule a future
// notification. In the Electron desktop build the main process owns a timer, so
// the daily sloka really does fire at the configured time as an OS notification,
// which is the desktop equivalent of the phone's lock-screen sloka.
import { getDailySloka, saveDailySloka } from '@/database/queries';
import { fetchVerse } from './vedabaseApi';
import { BOOKS } from '@/constants/books';
import { format } from 'date-fns';
import { getBridge } from '@/database/desktopBridge';
import { useSettingsStore } from '@/store/settingsStore';

export async function requestNotificationPermissions(): Promise<boolean> {
  // Electron notifications need no in-app permission prompt; the OS handles it.
  if (getBridge()) return true;
  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  return false;
}

export async function scheduleDailySlokaNotification(hour: number, minute: number): Promise<void> {
  const bridge = getBridge();
  if (!bridge) return; // browser can't schedule future notifications
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  try {
    await bridge.scheduleDailySloka(hhmm, true);
  } catch { /* best-effort — the in-app Today screen still shows the sloka */ }
}

export async function showDailySlokaNotification(reference: string, translation: string, _verseId: string): Promise<void> {
  const bridge = getBridge();
  if (bridge) {
    // "Show the verse in the notification" off: only the reference.
    const showVerse = useSettingsStore.getState().settings.lockScreenEnabled !== false;
    const snippet = !showVerse ? 'Open Vedabase to read today’s śloka.'
      : translation.length > 160 ? translation.slice(0, 160) + '…' : translation;
    try { await bridge.notify(`\u{1F337} ${reference}`, snippet); } catch { /* non-fatal */ }
    return;
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    const snippet = translation.length > 120 ? translation.slice(0, 120) + '…' : translation;
    new Notification(`🪷 ${reference}`, { body: snippet, icon: '/icon.png' });
  }
}

export async function pickDailySloka(): Promise<{
  bookSlug: string;
  canto?: number;
  chapter: number;
  verse: string;
} | null> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const existing = await getDailySloka(today);
  if (existing) return existing;

  // Settings → Source book: one book, or (All) the verse books.
  const choice = useSettingsStore.getState().settings.slokaOfDayBook;
  const SOURCE_BOOKS = choice && choice !== 'all' ? [choice as string] : ['bg', 'sb', 'noi', 'iso'];
  const availableBooks = BOOKS.filter((b) => SOURCE_BOOKS.includes(b.slug));
  if (!availableBooks.length) return null;
  const randomBook = availableBooks[Math.floor(Math.random() * availableBooks.length)];

  let canto: number | undefined;
  let chapter: number;
  let verseCount: number;

  if (randomBook.hasCantos && randomBook.cantos) {
    const randomCanto = randomBook.cantos[Math.floor(Math.random() * randomBook.cantos.length)];
    canto = randomCanto.number;
    const randomChapter = randomCanto.chapters[Math.floor(Math.random() * randomCanto.chapters.length)];
    chapter = randomChapter.number;
    verseCount = randomChapter.verseCount;
  } else if (randomBook.chapters) {
    const randomChapter = randomBook.chapters[Math.floor(Math.random() * randomBook.chapters.length)];
    chapter = randomChapter.number;
    verseCount = randomChapter.verseCount;
  } else {
    return null;
  }

  const verse = String(Math.floor(Math.random() * verseCount) + 1);
  await saveDailySloka(today, randomBook.slug, chapter, verse, canto);
  return { bookSlug: randomBook.slug, canto, chapter, verse };
}

// On desktop this stands in for the background task expo-background-fetch runs
// on the phone: main fires `sloka-due` at the chosen time and we do the same
// pick -> fetch -> notify sequence here, reusing the shared logic.
export async function registerBackgroundTask(): Promise<void> {
  const bridge = getBridge();
  if (!bridge) return; // no-op in a plain browser

  // The phone's schedule survives restarts because the OS holds it; a desktop
  // timer does not, so re-arm from the saved setting on every launch. _layout
  // awaits loadSettings() before calling this, so the store is already hydrated.
  const { slokaOfDayEnabled, slokaOfDayTime } = useSettingsStore.getState().settings;
  try {
    await bridge.scheduleDailySloka(slokaOfDayTime, slokaOfDayEnabled);
  } catch { /* best-effort */ }

  bridge.onSlokaDue(async () => {
    try {
      const sloka = await pickDailySloka();
      if (!sloka) return;
      // Chapter lengths for some books are estimates: if the picked number
      // doesn't exist, use the chapter's first text rather than skip the day.
      const verse = (await fetchVerse(sloka.bookSlug, sloka.chapter, sloka.verse, sloka.canto))
        ?? (sloka.verse !== '1' ? await fetchVerse(sloka.bookSlug, sloka.chapter, '1', sloka.canto) : null);
      if (!verse?.translation) return;
      const book = BOOKS.find((b) => b.slug === sloka.bookSlug);
      const ref = sloka.canto
        ? `${book?.title} ${sloka.canto}.${sloka.chapter}.${sloka.verse}`
        : `${book?.title} ${sloka.chapter}.${sloka.verse}`;
      await showDailySlokaNotification(ref, verse.translation, verse.id);
    } catch { /* a missed daily notification must never break the app */ }
  });
}
