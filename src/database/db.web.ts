// Web stub — expo-sqlite is native only.
// On web we use an in-memory store backed by localStorage.
export interface WebDb {
  verses: Map<string, any>;
  favorites: Map<string, any>;
  tags: Map<string, any>;
  verseTags: Map<string, Set<string>>;
  notes: Map<string, any>;
  readingProgress: Map<string, any>;
  dailySloka: Map<string, any>;
  downloadStatus: Map<string, any>;
  // key: `${bookSlug}|${language}|${chapterKey}` -> verse_count
  downloadChapters: Map<string, number>;
}

let _db: WebDb | null = null;

function loadFromStorage<T>(key: string): Map<string, T> {
  try {
    const raw = localStorage.getItem(`vedabase_${key}`);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw));
  } catch {
    return new Map();
  }
}

function saveToStorage(key: string, map: Map<string, any>) {
  try {
    localStorage.setItem(`vedabase_${key}`, JSON.stringify([...map.entries()]));
  } catch {}
}

export function getWebDb(): WebDb {
  if (_db) return _db;
  _db = {
    verses: loadFromStorage('verses'),
    favorites: loadFromStorage('favorites'),
    tags: loadFromStorage('tags'),
    verseTags: new Map(
      [...loadFromStorage<string[]>('verseTags').entries()].map(([k, v]) => [k, new Set(v)])
    ),
    notes: loadFromStorage('notes'),
    readingProgress: loadFromStorage('readingProgress'),
    dailySloka: loadFromStorage('dailySloka'),
    downloadStatus: loadFromStorage('downloadStatus'),
    downloadChapters: loadFromStorage('downloadChapters'),
  };
  return _db;
}

export function persistWebDb() {
  if (!_db) return;
  saveToStorage('verses', _db.verses);
  saveToStorage('favorites', _db.favorites);
  saveToStorage('tags', _db.tags);
  saveToStorage('verseTags', new Map([..._db.verseTags.entries()].map(([k, v]) => [k, [...v]])));
  saveToStorage('notes', _db.notes);
  saveToStorage('readingProgress', _db.readingProgress);
  saveToStorage('dailySloka', _db.dailySloka);
  saveToStorage('downloadStatus', _db.downloadStatus);
  saveToStorage('downloadChapters', _db.downloadChapters);
}

// No-op on web — schema lives in memory
export async function getDb(): Promise<any> {
  return getWebDb() as any;
}
