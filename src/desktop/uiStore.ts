import { create } from 'zustand';

// Desktop-only UI state shared between the header and the pages.
const TOC_KEY = 'vb_desktop_toc_open';

function readToc(): boolean {
  try { return localStorage.getItem(TOC_KEY) !== '0'; } catch { return true; }
}

const PRESENT_KEY = 'vb_desktop_present_mode';
const PZOOM_KEY = 'vb_desktop_present_zoom';

/** What full-screen verse reading shows: the whole verse page, or only the
 *  śloka / only the translation blown up to fill the screen (presentation). */
export type PresentMode = 'full' | 'sloka' | 'translation';

function read<T>(key: string, parse: (v: string | null) => T): T {
  try { return parse(localStorage.getItem(key)); } catch { return parse(null); }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private mode */ }
}
const clampZoom = (z: number) => Math.min(3, Math.max(0.4, Math.round(z * 100) / 100));

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
  /** Full-screen verse view: whole page, or śloka / translation only (presentation). */
  presentMode: PresentMode;
  setPresentMode: (m: PresentMode) => void;
  /** Extra size on top of fit-to-screen in presentation (1 = fills the screen). */
  presentZoom: number;
  /** +1 bigger, -1 smaller, 0 back to fit-to-screen. */
  zoomPresent: (dir: -1 | 0 | 1) => void;
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
    // Entering or leaving full screen always starts with the bars visible —
    // otherwise a presentation that had hidden them leaves the normal view
    // without its header and toolbar.
    set({ focusMode: on, barsShown: true });
    // The HTML Fullscreen API makes the Electron window itself full screen.
    try {
      if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch { /* not supported — the reading layout still applies */ }
  },
  presentMode: read<PresentMode>(PRESENT_KEY, (v) => (v === 'sloka' || v === 'translation' ? v : 'full')),
  setPresentMode: (m) => { write(PRESENT_KEY, m); set({ presentMode: m }); },
  presentZoom: read(PZOOM_KEY, (v) => clampZoom(Number(v) || 1)),
  zoomPresent: (dir) => {
    const z = dir === 0 ? 1 : clampZoom(get().presentZoom * (dir > 0 ? 1.1 : 1 / 1.1));
    write(PZOOM_KEY, String(z));
    set({ presentZoom: z });
  },
}));

/** True while the verse page shows only the śloka or only the translation, full screen. */
export function presenting(pathname?: string): boolean {
  const st = useDesktopUi.getState();
  const path = pathname ?? (typeof location !== 'undefined' ? location.pathname : '');
  return st.focusMode && st.presentMode !== 'full' && path.endsWith('/verse');
}

/** True when keyboard focus is in a text field (so page shortcuts stand down). */
/** The user is busy with something the bars must not hide from under them:
 *  typing in a field, or a popup / dialog / suggestion list is open. */
export function uiBusy(): boolean {
  if (typeof document === 'undefined') return false;
  return typingInField() || !!document.querySelector('[data-vb-pop], [aria-modal="true"]');
}

export function typingInField(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
