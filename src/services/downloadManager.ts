import { create } from 'zustand';
import { AppRegistry, Platform } from 'react-native';
import {
  KEEP_ALIVE_TASK,
  startDownloadService,
  updateDownloadService,
  stopDownloadService,
  onDownloadStopRequested,
} from 'download-service';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { BOOKS, getBook, getAllChapters } from '@/constants/books';
import { fetchAndCacheBook } from './vedabaseApi';
import {
  setDownloadStatus,
  getAllDownloadStatuses,
  getResumableBookSlugs,
  type DownloadStatus,
} from '@/database/queries';
import { useSettingsStore } from '@/store/settingsStore';
import { Language } from '@/types';

// ---------------------------------------------------------------------------
// A single, app-wide download queue that lives OUTSIDE the React tree. Screens
// only read from / dispatch to it, so navigating away never interrupts a
// download and the live status is visible from anywhere (book screen, the
// Download Manager screen, Library badges).
//
// Closing the app: on Android the queue runs under a foreground service (an
// ongoing "Downloading…" notification with a Stop button), which keeps the
// process — and this JS loop — alive after the app is left or swiped away.
//
// Persistence: every book's status is written to SQLite as it progresses, so
// if the OS kills the app anyway it resumes its queue on next launch
// (resumeInterruptedDownloads) and, when the OS grants background time, via
// the registered background-fetch task.
// ---------------------------------------------------------------------------

export type DownloadEntryStatus = DownloadStatus['status'];

export interface DownloadEntry {
  status: DownloadEntryStatus;
  done: number;
  total: number;
}

interface DownloadStoreState {
  entries: Record<string, DownloadEntry>;
  queue: string[]; // slugs pending/active, in order; queue[0] is the active one
  activeSlug: string | null;
  hydrated: boolean;
}

export const useDownloadStore = create<DownloadStoreState>(() => ({
  entries: {},
  queue: [],
  activeSlug: null,
  hydrated: false,
}));

// Convenience hook for screens that care about a single book.
export function useBookDownload(slug: string): DownloadEntry | undefined {
  return useDownloadStore((s) => s.entries[slug]);
}

// --- internal helpers ------------------------------------------------------

const DOWNLOAD_QUEUE_TASK = 'DOWNLOAD_QUEUE_TASK';
// Cap a single background invocation — the OS only grants a short window, and
// we want to persist progress and return before it kills us.
const BACKGROUND_BUDGET_MS = 25_000;

let loopRunning = false;
let cancelAll = false;
const cancelled = new Set<string>();
let deadline = 0; // epoch ms; 0 = no deadline (foreground, run to completion)

const language = (): Language =>
  useSettingsStore.getState().settings.language as Language;

const bookTotalVerses = (slug: string): number => {
  const book = getBook(slug);
  return book ? getAllChapters(book).reduce((s, c) => s + c.verseCount, 0) : 0;
};

function patchEntry(slug: string, patch: Partial<DownloadEntry>) {
  useDownloadStore.setState((s) => {
    const prev: DownloadEntry = s.entries[slug] ?? { status: 'queued', done: 0, total: 0 };
    return { entries: { ...s.entries, [slug]: { ...prev, ...patch } } };
  });
}

function setQueue(queue: string[]) {
  useDownloadStore.setState({ queue });
}

function dequeue(slug: string) {
  setQueue(useDownloadStore.getState().queue.filter((s) => s !== slug));
}

// --- foreground service (Android) -------------------------------------------

let serviceOn = false;
let lastNotify = 0;

function notifyText(): string {
  const waiting = useDownloadStore.getState().queue.length - 1;
  return waiting > 0 ? `${waiting} more book${waiting === 1 ? '' : 's'} queued` : 'Last book in the queue';
}

async function startService() {
  if (Platform.OS !== 'android' || serviceOn || deadline > 0) return;
  try {
    // Android 13+: without this the service still runs, but its notification
    // (and the Stop button) would be hidden. Ask once; never block on it.
    // Required lazily: expo-notifications is kept out of the web/desktop path.
    const Notifications: typeof import('expo-notifications') = require('expo-notifications');
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) await Notifications.requestPermissionsAsync();
  } catch {}
  try {
    startDownloadService('Preparing downloads…', notifyText());
    serviceOn = true;
  } catch {
    // The OS refuses foreground services started from the background; the
    // queue still runs while the app is open and resumes on next launch.
  }
}

function updateService(slug: string, done: number, total: number, force = false) {
  if (!serviceOn) return;
  const now = Date.now();
  if (!force && now - lastNotify < 1000) return; // keep notification updates cheap
  lastNotify = now;
  const title = `Downloading ${getBook(slug)?.title ?? slug}`;
  const pctText = total > 0 ? ` · ${Math.round((done / total) * 100)}%` : '';
  try { updateDownloadService(title + pctText, notifyText(), done, total); } catch {}
}

function stopService() {
  if (!serviceOn) return;
  serviceOn = false;
  try { stopDownloadService(); } catch {}
}

if (Platform.OS === 'android') {
  // The native module opens this headless task so RN keeps JS timers running
  // in the background; it resolves once the queue is empty (the native side
  // also finishes it on stop()).
  AppRegistry.registerHeadlessTask(KEEP_ALIVE_TASK, () => () =>
    new Promise<void>((resolve) => {
      const check = () => {
        if (!loopRunning && useDownloadStore.getState().queue.length === 0) {
          unsub();
          resolve();
        }
      };
      const unsub = useDownloadStore.subscribe(check);
      setTimeout(check, 0);
    })
  );
  onDownloadStopRequested(() => cancelAllDownloads());
}

async function downloadOne(slug: string): Promise<'done' | 'stopped' | 'skip'> {
  const book = getBook(slug);
  if (!book) {
    dequeue(slug);
    return 'skip';
  }

  useDownloadStore.setState({ activeSlug: slug });
  patchEntry(slug, { status: 'downloading', total: bookTotalVerses(slug) });
  updateService(slug, 0, bookTotalVerses(slug), true);

  const chapters = getAllChapters(book).map((c) => ({
    chapter: c.chapter,
    verseCount: c.verseCount,
    cantoPart: c.cantoPart,
    pageId: c.pageId,
  }));

  const shouldStop = () =>
    cancelAll || cancelled.has(slug) || (deadline > 0 && Date.now() > deadline);

  const { success, failed, total, stopped } = await fetchAndCacheBook(
    slug,
    chapters,
    language(),
    (done, t) => {
      patchEntry(slug, { status: 'downloading', done, total: t });
      updateService(slug, done, t);
    },
    shouldStop,
    useSettingsStore.getState().settings.downloadConcurrency ?? 8
  );

  if (stopped) {
    // Cancelled (this book or all) → settle the status and drop it from the
    // queue. Paused for background budget → keep it queued for the next pass.
    if (cancelAll || cancelled.has(slug)) {
      cancelled.delete(slug);
      const settled: DownloadEntryStatus = success > 0 ? 'partial' : 'not_downloaded';
      await setDownloadStatus(slug, settled, total, success);
      patchEntry(slug, { status: settled, done: success, total });
      dequeue(slug);
      return cancelAll ? 'stopped' : 'skip';
    }
    patchEntry(slug, { status: 'downloading', done: success, total });
    return 'stopped';
  }

  const settled: DownloadEntryStatus = failed === 0 ? 'downloaded' : 'partial';
  patchEntry(slug, { status: settled, done: success, total });
  dequeue(slug);
  return 'done';
}

async function runLoop() {
  if (loopRunning) return;
  loopRunning = true;
  cancelAll = false;
  await startService();
  try {
    while (true) {
      const slug = useDownloadStore.getState().queue[0];
      if (!slug || cancelAll) break;
      if (cancelled.has(slug)) {
        cancelled.delete(slug);
        dequeue(slug);
        continue;
      }
      try {
        const outcome = await downloadOne(slug);
        if (outcome === 'stopped') break; // background budget spent, or cancel-all
      } catch {
        // A book's download threw unexpectedly — settle it and move on so the
        // queue can't wedge or spin forever on the same slug. Completed chapters
        // are already persisted, so a later resume picks up where it left off.
        const e = useDownloadStore.getState().entries[slug];
        const settled: DownloadEntryStatus = (e?.done ?? 0) > 0 ? 'partial' : 'not_downloaded';
        patchEntry(slug, { status: settled });
        setDownloadStatus(slug, settled, e?.total ?? bookTotalVerses(slug), e?.done ?? 0).catch(() => {});
        dequeue(slug);
      }
    }
  } finally {
    loopRunning = false;
    cancelAll = false;
    useDownloadStore.setState({ activeSlug: null });
    stopService();
  }
}

// --- public API ------------------------------------------------------------

// Seed in-memory state from SQLite so the UI shows past downloads immediately.
// Merges: an actively downloading/queued entry in memory wins over the DB row.
export async function hydrateDownloads() {
  const all = await getAllDownloadStatuses();
  useDownloadStore.setState((s) => {
    const entries: Record<string, DownloadEntry> = { ...s.entries };
    for (const [slug, st] of Object.entries(all)) {
      const live = s.entries[slug];
      if (live && (live.status === 'downloading' || live.status === 'queued')) continue;
      entries[slug] = { status: st.status, done: st.downloaded, total: st.total };
    }
    return { entries, hydrated: true };
  });
}

export async function enqueueBooks(slugs: string[]) {
  const { queue, entries } = useDownloadStore.getState();
  const toAdd = slugs.filter(
    (s) => getBook(s) && !queue.includes(s) && entries[s]?.status !== 'downloaded'
  );
  for (const slug of toAdd) {
    cancelled.delete(slug);
    const total = bookTotalVerses(slug);
    const done = entries[slug]?.done ?? 0;
    patchEntry(slug, { status: 'queued', total, done });
    await setDownloadStatus(slug, 'queued', total, done);
  }
  setQueue([...useDownloadStore.getState().queue, ...toAdd]);
  runLoop();
}

export function enqueueBook(slug: string) {
  return enqueueBooks([slug]);
}

// "Download all books" — skips ones already fully offline.
export function enqueueAllBooks() {
  return enqueueBooks(BOOKS.map((b) => b.slug));
}

export function cancelBook(slug: string) {
  const { activeSlug, entries } = useDownloadStore.getState();
  if (activeSlug === slug) {
    cancelled.add(slug); // the loop will settle the status and dequeue it
    return;
  }
  const e = entries[slug];
  const settled: DownloadEntryStatus = (e?.done ?? 0) > 0 ? 'partial' : 'not_downloaded';
  dequeue(slug);
  patchEntry(slug, { status: settled });
  setDownloadStatus(slug, settled, e?.total ?? bookTotalVerses(slug), e?.done ?? 0).catch(() => {});
}

export function cancelAllDownloads() {
  const { queue, activeSlug, entries } = useDownloadStore.getState();
  cancelAll = true;
  for (const slug of queue) {
    if (slug === activeSlug) continue; // settled by the loop's stopped branch
    const e = entries[slug];
    const settled: DownloadEntryStatus = (e?.done ?? 0) > 0 ? 'partial' : 'not_downloaded';
    patchEntry(slug, { status: settled });
    setDownloadStatus(slug, settled, e?.total ?? bookTotalVerses(slug), e?.done ?? 0).catch(() => {});
  }
  setQueue(activeSlug ? [activeSlug] : []);
}

// Re-enqueue anything that was downloading/queued when the app closed. Called
// on launch and by the background task. Cheap to re-run — cached verses are
// served from SQLite, so resume only re-fetches what's missing.
export async function resumeInterruptedDownloads() {
  if (!useDownloadStore.getState().hydrated) await hydrateDownloads();
  const slugs = await getResumableBookSlugs();
  if (slugs.length === 0) return;
  const queue = useDownloadStore.getState().queue;
  const merged = [...queue, ...slugs.filter((s) => !queue.includes(s))];
  for (const slug of slugs) {
    if (!useDownloadStore.getState().entries[slug]) {
      patchEntry(slug, { status: 'queued', total: bookTotalVerses(slug) });
    }
  }
  setQueue(merged);
  runLoop();
}

// --- background execution --------------------------------------------------

TaskManager.defineTask(DOWNLOAD_QUEUE_TASK, async () => {
  try {
    const slugs = await getResumableBookSlugs();
    if (slugs.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;
    deadline = Date.now() + BACKGROUND_BUDGET_MS;
    const queue = useDownloadStore.getState().queue;
    setQueue([...queue, ...slugs.filter((s) => !queue.includes(s))]);
    await runLoop();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  } finally {
    deadline = 0;
  }
});

export async function registerDownloadBackgroundTask() {
  try {
    await BackgroundFetch.registerTaskAsync(DOWNLOAD_QUEUE_TASK, {
      minimumInterval: 60 * 15, // 15 min — OS treats this as a floor, not a guarantee
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Already registered.
  }
}
