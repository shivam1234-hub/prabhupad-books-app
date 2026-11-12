import { create } from 'zustand';

// Desktop-only UI state shared between the header and the pages.
const TOC_KEY = 'vb_desktop_toc_open';

function readToc(): boolean {
  try { return localStorage.getItem(TOC_KEY) !== '0'; } catch { return true; }
}

interface DesktopUi {
  /** Bumped to ask the header search box to take focus (Ctrl+K). */
  searchFocus: number;
  focusSearch: () => void;
  /** Reading pages' left table-of-contents sidebar. */
  tocOpen: boolean;
  toggleToc: () => void;
  /** Bumped to open the reader settings popover from the keyboard. */
  readerSettings: number;
  openReaderSettings: () => void;
  /** Full-screen reading: only the verse, Next and the search bar. */
  /** Reading pages' bars (app bar + page toolbar) — hidden while reading. */
  barsShown: boolean;
  setBarsShown: (on: boolean | ((cur: boolean) => boolean)) => void;
  focusMode: boolean;
  setFocusMode: (on: boolean) => void;
}

export const useDesktopUi = create<DesktopUi>((set, get) => ({
  searchFocus: 0,
  focusSearch: () => set({ searchFocus: get().searchFocus + 1 }),
  tocOpen: readToc(),
  toggleToc: () => {
    const next = !get().tocOpen;
    try { localStorage.setItem(TOC_KEY, next ? '1' : '0'); } catch { /* private mode */ }
    set({ tocOpen: next });
  },
  readerSettings: 0,
  openReaderSettings: () => set({ readerSettings: get().readerSettings + 1 }),
  barsShown: true,
  setBarsShown: (on) => {
    const next = typeof on === 'function' ? on(get().barsShown) : on;
    if (next !== get().barsShown) set({ barsShown: next });
  },
  focusMode: false,
  setFocusMode: (on) => {
    if (get().focusMode === on) return;
    set({ focusMode: on });
    // The HTML Fullscreen API makes the Electron window itself full screen.
    try {
      if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch { /* not supported — the reading layout still applies */ }
  },
}));

/** True when keyboard focus is in a text field (so page shortcuts stand down). */
export function typingInField(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
