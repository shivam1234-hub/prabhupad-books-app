import { create } from 'zustand';
import { loadMemorized, saveMemorized } from './memorizedStorage';

/**
 * Verses from the Ślokas tab the reader has learnt by heart, by the verse's
 * id in mostQuotedVerses.json (stable: the data is bundled). Stored as a
 * compact list of ids so it fits SecureStore.
 */
interface MemorizedState {
  ids: Record<number, true>;
  loaded: boolean;
  load: () => Promise<void>;
  /** Tick or untick verses; several at once for a whole prayer. */
  set: (ids: number[], memorized: boolean) => void;
  toggle: (id: number) => void;
}

export const useMemorizedStore = create<MemorizedState>((set, get) => {
  const persist = () => {
    const list = Object.keys(get().ids).join(',');
    saveMemorized(list).catch(() => {});
  };
  return {
    ids: {},
    loaded: false,
    load: async () => {
      if (get().loaded) return;
      try {
        const raw = await loadMemorized();
        const ids: Record<number, true> = {};
        for (const s of (raw ?? '').split(',')) {
          const n = Number(s);
          if (s && Number.isInteger(n)) ids[n] = true;
        }
        // Keep anything ticked before loading finished.
        const early = Object.keys(get().ids).length > 0;
        set({ ids: { ...ids, ...get().ids }, loaded: true });
        if (early) persist();
      } catch {
        set({ loaded: true });
      }
    },
    set: (list, memorized) => {
      const ids = { ...get().ids };
      for (const id of list) {
        if (memorized) ids[id] = true;
        else delete ids[id];
      }
      set({ ids });
      persist();
    },
    toggle: id => get().set([id], !get().ids[id]),
  };
});
