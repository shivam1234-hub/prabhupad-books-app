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
  /** Native message box (Alert.alert on desktop); resolves to the clicked button index. */
  dialog?(opts: {
    title?: string; message?: string; buttons: string[]; defaultId?: number; cancelId?: number;
  }): Promise<number>;
  /** Open an http(s) URL in the system browser. */
  openExternal?(url: string): Promise<boolean>;
  /** The desktop app's version (package.json). */
  appVersion?: string;
  /** Ctrl + / − / 0 (dir 1 / -1 / 0); returns an unsubscribe. */
  onZoomKey?(handler: (dir: -1 | 0 | 1) => void): () => void;
  /** Zoom the whole window a step (dir 0 = 100%). */
  zoomWindow?(dir: -1 | 0 | 1): void;
}

declare global {
  interface Window {
    vedabaseDesktop?: VedabaseDesktopBridge;
  }
}

export {};
