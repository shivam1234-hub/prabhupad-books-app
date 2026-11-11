// Page-level CSS for the desktop build: the bundled reading fonts, slim
// scrollbars, focus rings and text selection in the theme's colours. Injected
// once and refreshed whenever the theme changes.
import type { ColorScheme } from '@/constants/colors';
import { alpha } from './theme';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const DEVANAGARI =
  'U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09';

// Served from public/fonts, which `expo export` copies to the bundle root. No
// network font service: the app must look right with no internet.
function face(file: string, weight: number, style: 'normal' | 'italic', range: string) {
  return `@font-face{font-family:"VB Serif";src:url("/fonts/${file}") format("woff2");font-weight:${weight};font-style:${style};font-display:swap;unicode-range:${range};}`;
}

const FONTS = [
  ...(['latin', 'latin-ext'] as const).flatMap((s) => {
    const r = s === 'latin' ? LATIN : LATIN_EXT;
    return [
      face(`noto-serif-${s}-400-normal.woff2`, 400, 'normal', r),
      face(`noto-serif-${s}-600-normal.woff2`, 600, 'normal', r),
      face(`noto-serif-${s}-700-normal.woff2`, 700, 'normal', r),
      face(`noto-serif-${s}-400-italic.woff2`, 400, 'italic', r),
      face(`noto-serif-${s}-700-italic.woff2`, 700, 'italic', r),
    ];
  }),
  face('noto-serif-devanagari-devanagari-400-normal.woff2', 400, 'normal', DEVANAGARI),
  face('noto-serif-devanagari-devanagari-600-normal.woff2', 600, 'normal', DEVANAGARI),
  face('noto-serif-devanagari-devanagari-700-normal.woff2', 700, 'normal', DEVANAGARI),
].join('\n');

let styleEl: HTMLStyleElement | null = null;

export function applyDesktopCss(c: ColorScheme, isDark: boolean) {
  if (typeof document === 'undefined') return;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'vb-desktop-css';
    document.head.appendChild(styleEl);
  }
  const thumb = alpha(isDark ? '#FFFFFF' : '#000000', isDark ? 0.18 : 0.2);
  const thumbHover = alpha(isDark ? '#FFFFFF' : '#000000', isDark ? 0.32 : 0.36);
  styleEl.textContent = `
${FONTS}
html, body { background: ${c.background}; color-scheme: ${isDark ? 'dark' : 'light'}; }
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
::selection { background: ${alpha(c.primary, 0.28)}; }
* { scrollbar-width: thin; scrollbar-color: ${thumb} transparent; }
::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${thumb}; border-radius: 8px; border: 3px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background: ${thumbHover}; border: 3px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-corner { background: transparent; }
:focus { outline: none; }
:focus-visible { outline: 2px solid ${c.primary}; outline-offset: 2px; border-radius: 6px; }
input, textarea, select { font-family: inherit; }
input::placeholder, textarea::placeholder { color: ${c.textMuted}; opacity: 1; }
input:focus-visible, textarea:focus-visible { outline: none; }
[data-vb-link]:hover { text-decoration-line: underline; }
[data-vb-syn]:hover { text-decoration-line: underline; text-decoration-style: dotted; }
@keyframes vbFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
[data-vb-pop] { animation: vbFadeIn 120ms ease-out; }
[data-vb-page] { animation: vbFadeIn 160ms ease-out; }
`;
}
