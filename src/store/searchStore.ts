import { create } from 'zustand';

// Lets the header search icon open the global FloatingSearch from any screen.
// `openRequest` is bumped on every tap so FloatingSearch can react even when
// the panel was already open (e.g. re-focus the input).
interface SearchState {
  openRequest: number;
  open: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  openRequest: 0,
  open: () => set((s) => ({ openRequest: s.openRequest + 1 })),
}));
