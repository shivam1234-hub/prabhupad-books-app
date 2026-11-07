import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import { getDailySloka, saveDailySloka } from '@/database/queries';
import { fetchVerse } from './vedabaseApi';
import { BOOKS } from '@/constants/books';
import { format } from 'date-fns';

const DAILY_SLOKA_TASK = 'DAILY_SLOKA_TASK';
const BG_BOOKS = ['bg', 'sb'];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function scheduleDailySlokaNotification(
  hour: number,
  minute: number,
  bookSlug?: string
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🪷 Sloka of the Day',
      body: 'Your daily verse from Srila Prabhupada\'s teachings awaits you.',
      data: { type: 'daily_sloka' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function showDailySlokaNotification(
  reference: string,
  translation: string,
  verseId: string
): Promise<void> {
  const snippet = translation.length > 120 ? translation.slice(0, 120) + '…' : translation;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🪷 ${reference}`,
      body: snippet,
      data: { type: 'daily_sloka', verseId },
      ...(Platform.OS === 'android' && {
        color: '#F59E0B',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sticky: false,
      }),
    },
    trigger: null,
  });
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

  const availableBooks = BOOKS.filter((b) => BG_BOOKS.includes(b.slug));
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

TaskManager.defineTask(DAILY_SLOKA_TASK, async () => {
  try {
    const sloka = await pickDailySloka();
    if (!sloka) return BackgroundFetch.BackgroundFetchResult.NoData;

    const verse = await fetchVerse(sloka.bookSlug, sloka.chapter, sloka.verse, sloka.canto);
    if (!verse?.translation) return BackgroundFetch.BackgroundFetchResult.NoData;

    const book = BOOKS.find((b) => b.slug === sloka.bookSlug);
    const ref = sloka.canto
      ? `${book?.title} ${sloka.canto}.${sloka.chapter}.${sloka.verse}`
      : `${book?.title} ${sloka.chapter}.${sloka.verse}`;

    await showDailySlokaNotification(ref, verse.translation, verse.id);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(DAILY_SLOKA_TASK, {
      minimumInterval: 60 * 60 * 12,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Already registered
  }
}
