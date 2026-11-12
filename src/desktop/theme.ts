// Desktop (web / Electron) design tokens. The colours themselves come from the
// shared theme (src/constants/colors.ts) so light / dark / Vedabase look the
// same as on the phone; this file only adds what a wide window needs: reading
// fonts, column widths and a few derived tints.
import { Platform } from 'react-native';
import type { ColorScheme } from '@/constants/colors';

/** Reading serif, bundled in public/fonts (Noto Serif + Noto Serif Devanagari). */
export const SERIF = '"VB Serif", "Noto Serif", Georgia, "Times New Roman", serif';
/** UI text: the platform's own sans (Segoe UI on Windows). */
export const SANS =
  '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

export const HEADER_H = 60;
export const READING_W = 740;
/** Verse / chapter reading column: the full window, capped for very wide screens. */
export const READING_W_WIDE = 1600;
export const PAGE_W = 1180;
export const SIDEBAR_W = 300;

export const IS_WEB = Platform.OS === 'web';

/** `rgba()` of a #RRGGBB colour. */
export function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
}

/** Hover / selected fills derived from the theme. */
export function tints(c: ColorScheme) {
  return {
    hover: alpha(c.primary, 0.08),
    hoverStrong: alpha(c.primary, 0.14),
    selected: alpha(c.primary, 0.16),
    shadow: '0 1px 2px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.08)',
    shadowLg: '0 2px 6px rgba(0,0,0,0.10), 0 18px 48px rgba(0,0,0,0.18)',
  };
}

/** Web-only style props (cursor, box-shadow, position: fixed…) that RN's types lack. */
export const web = (s: Record<string, unknown>): any => (IS_WEB ? s : {});
