import type { VedabaseDesktopBridge } from '@/types/desktop';

// True when the web bundle is running inside the Electron desktop shell, which
// injects the bridge in desktop/preload.js. In a plain browser this is false and
// the app keeps using its localStorage fallback.
export function getBridge(): VedabaseDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return window.vedabaseDesktop ?? null;
}

export function isDesktop(): boolean {
  return getBridge() !== null;
}
