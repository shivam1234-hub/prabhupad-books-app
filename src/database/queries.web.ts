// Data-layer entry point for every non-native build.
//
// Two very different backends sit behind this one module:
//   * Electron desktop (Windows/macOS/Linux) -> queries.desktop.ts, which talks
//     over the preload bridge to a real SQLite + FTS5 database on disk. This is
//     what makes the whole library genuinely available offline.
//   * A plain browser (`npm run web`)        -> queries.browser.ts, the
//     localStorage-backed store, kept as-is for web development.
//
// The choice is made per call rather than at module load, because the bundle is
// evaluated before we can be certain the preload bridge has been installed.
import * as browser from './queries.browser';
import * as desktop from './queries.desktop';
import { isDesktop } from './desktopBridge';

export type { DownloadStatus, SynonymRow } from './queries.browser';

type Impl = typeof browser;

function impl(): Impl {
  return (isDesktop() ? desktop : browser) as unknown as Impl;
}

// buildVerseId is a pure function with one definition — no dispatch needed, and
// callers use it synchronously.
export const buildVerseId = browser.buildVerseId;

export const getVerse: Impl['getVerse'] = (...a) => impl().getVerse(...a);
export const saveVerse: Impl['saveVerse'] = (...a) => impl().saveVerse(...a);
export const getChapterVerses: Impl['getChapterVerses'] = (...a) => impl().getChapterVerses(...a);
export const findCachedCombinedVerse: Impl['findCachedCombinedVerse'] = (...a) =>
  impl().findCachedCombinedVerse(...a);
export const searchVerses: Impl['searchVerses'] = (...a) => impl().searchVerses(...a);

export const getSynonymCandidates: Impl['getSynonymCandidates'] = (...a) =>
  impl().getSynonymCandidates(...a);

export const findVersesByTransliteration: Impl['findVersesByTransliteration'] = (...a) =>
  impl().findVersesByTransliteration(...a);

export const getFavorites: Impl['getFavorites'] = (...a) => impl().getFavorites(...a);
export const addFavorite: Impl['addFavorite'] = (...a) => impl().addFavorite(...a);
export const removeFavorite: Impl['removeFavorite'] = (...a) => impl().removeFavorite(...a);
export const isFavorite: Impl['isFavorite'] = (...a) => impl().isFavorite(...a);

export const getTags: Impl['getTags'] = (...a) => impl().getTags(...a);
export const createTag: Impl['createTag'] = (...a) => impl().createTag(...a);
export const deleteTag: Impl['deleteTag'] = (...a) => impl().deleteTag(...a);
export const addVerseTag: Impl['addVerseTag'] = (...a) => impl().addVerseTag(...a);
export const removeVerseTag: Impl['removeVerseTag'] = (...a) => impl().removeVerseTag(...a);
export const getVerseTagIds: Impl['getVerseTagIds'] = (...a) => impl().getVerseTagIds(...a);
export const getVersesByTag: Impl['getVersesByTag'] = (...a) => impl().getVersesByTag(...a);

export const getNote: Impl['getNote'] = (...a) => impl().getNote(...a);
export const saveNote: Impl['saveNote'] = (...a) => impl().saveNote(...a);
export const deleteNote: Impl['deleteNote'] = (...a) => impl().deleteNote(...a);

export const updateReadingProgress: Impl['updateReadingProgress'] = (...a) =>
  impl().updateReadingProgress(...a);
export const getReadingProgress: Impl['getReadingProgress'] = (...a) => impl().getReadingProgress(...a);
export const markChapterCompleted: Impl['markChapterCompleted'] = (...a) =>
  impl().markChapterCompleted(...a);
export const getCompletedChapters: Impl['getCompletedChapters'] = (...a) =>
  impl().getCompletedChapters(...a);

export const getDownloadStatus: Impl['getDownloadStatus'] = (...a) => impl().getDownloadStatus(...a);
export const setDownloadStatus: Impl['setDownloadStatus'] = (...a) => impl().setDownloadStatus(...a);
export const getDownloadedBookSlugs: Impl['getDownloadedBookSlugs'] = (...a) =>
  impl().getDownloadedBookSlugs(...a);
export const getAllDownloadStatuses: Impl['getAllDownloadStatuses'] = (...a) =>
  impl().getAllDownloadStatuses(...a);
export const getResumableBookSlugs: Impl['getResumableBookSlugs'] = (...a) =>
  impl().getResumableBookSlugs(...a);
export const getDownloadedChapters: Impl['getDownloadedChapters'] = (...a) =>
  impl().getDownloadedChapters(...a);
export const markDownloadedChapter: Impl['markDownloadedChapter'] = (...a) =>
  impl().markDownloadedChapter(...a);
export const clearDownloadedChapters: Impl['clearDownloadedChapters'] = (...a) =>
  impl().clearDownloadedChapters(...a);

export const saveDailySloka: Impl['saveDailySloka'] = (...a) => impl().saveDailySloka(...a);
export const getDailySloka: Impl['getDailySloka'] = (...a) => impl().getDailySloka(...a);
