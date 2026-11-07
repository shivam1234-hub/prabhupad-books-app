// Shape of the bridge desktop/preload.js installs on `window` when the web
// bundle is running inside Electron. Absent in a plain browser — every call
// site must check `isDesktop()` first (see src/database/desktopBridge.ts).
export interface VedabaseDesktopBridge {
  platform: string;
  version: string;
  db<T = unknown>(method: string, args?: unknown[]): Promise<T>;
  fetchText(url: string): Promise<string | null>;
  notify(title: string, body: string): Promise<boolean>;
  scheduleDailySloka(time: string, enabled: boolean): Promise<boolean>;
  onSlokaDue(handler: () => void): void;
  storageInfo(): Promise<{ path: string; bytes: number; verses: number; books: number }>;
  revealStorage(): Promise<boolean>;
}

declare global {
  interface Window {
    vedabaseDesktop?: VedabaseDesktopBridge;
  }
}

export {};
