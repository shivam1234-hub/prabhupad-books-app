import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'nav_history_v1';
const MAX_ENTRIES = 40;

export type HistoryKind = 'book' | 'chapter' | 'verse';

export interface HistoryEntry {
  key: string;            // stable route+params key, also used for scroll lookup
  kind: HistoryKind;
  pathname: string;       // expo-router pathname (e.g. '/verse')
  params: Record<string, string>;
  title: string;          // primary label (e.g. "Bhagavad-gītā 2.47")
  subtitle?: string;      // secondary label (e.g. "Karma-yoga")
  bookSlug?: string;
  visitedAt: number;
}

interface HistoryState {
  entries: HistoryEntry[];
  scrollPositions: Record<string, number>;
  loaded: boolean;
  load: () => Promise<void>;
  visit: (entry: Omit<HistoryEntry, 'visitedAt'>) => void;
  saveScroll: (key: string, y: number) => void;
  getScroll: (key: string) => number | undefined;
  removeEntry: (key: string) => void;
  clear: () => void;
}

// Fire-and-forget persistence — kept off the render path.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(state: Pick<HistoryState, 'entries' | 'scrollPositions'>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEY,
        JSON.stringify({ entries: state.entries, scrollPositions: state.scrollPositions }),
      );
    } catch {}
  }, 400);
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  scrollPositions: {},
  loaded: false,

  load: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          entries: Array.isArray(parsed.entries) ? parsed.entries.slice(0, MAX_ENTRIES) : [],
          scrollPositions: parsed.scrollPositions ?? {},
          loaded: true,
        });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  visit: (entry) => {
    set((s) => {
      const filtered = s.entries.filter((e) => e.key !== entry.key);
      const next: HistoryEntry = { ...entry, visitedAt: Date.now() };
      const entries = [next, ...filtered].slice(0, MAX_ENTRIES);
      persist({ entries, scrollPositions: s.scrollPositions });
      return { entries };
    });
  },

  saveScroll: (key, y) => {
    // Ignore ~top scroll — restoring 0 is the default anyway, no need to persist.
    if (y < 8) {
      const cur = get().scrollPositions[key];
      if (cur === undefined) return;
    }
    set((s) => {
      if (s.scrollPositions[key] === y) return s;
      const scrollPositions = { ...s.scrollPositions, [key]: y };
      persist({ entries: s.entries, scrollPositions });
      return { scrollPositions };
    });
  },

  getScroll: (key) => get().scrollPositions[key],

  removeEntry: (key) => {
    set((s) => {
      const entries = s.entries.filter((e) => e.key !== key);
      const scrollPositions = { ...s.scrollPositions };
      delete scrollPositions[key];
      persist({ entries, scrollPositions });
      return { entries, scrollPositions };
    });
  },

  clear: () => {
    set({ entries: [], scrollPositions: {} });
    persist({ entries: [], scrollPositions: {} });
  },
}));

// Deterministic key for a route + params — used both as history dedupe key and
// as the scroll-position key so returning to a page can rehydrate its offset.
export function makeRouteKey(
  pathname: string,
  params: Record<string, string | undefined>,
): string {
  const parts = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ''}`)
    .join('&');
  return `${pathname}?${parts}`;
}
