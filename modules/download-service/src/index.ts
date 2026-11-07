import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

// Must match DownloadServiceModule.KEEP_ALIVE_TASK on the native side.
export const KEEP_ALIVE_TASK = 'VedabaseDownloadKeepAlive';

interface NativeDownloadService {
  start(title: string, text: string): void;
  update(title: string, text: string, done: number, total: number): void;
  stop(): void;
  addListener(event: 'onStopRequested', listener: () => void): { remove(): void };
}

let _native: NativeDownloadService | null = null;
let _loadAttempted = false;

function getNative(): NativeDownloadService | null {
  if (!_loadAttempted) {
    _loadAttempted = true;
    if (Platform.OS === 'android') {
      try {
        _native = requireNativeModule('DownloadService');
      } catch {
        _native = null;
      }
    }
  }
  return _native;
}

/**
 * Android: start the foreground service (ongoing progress notification + wake
 * lock) that keeps downloads running after the app is closed. No-op elsewhere.
 * Throws if the OS refuses (e.g. when called while the app is in background).
 */
export function startDownloadService(title: string, text: string): void {
  getNative()?.start(title, text);
}

export function updateDownloadService(title: string, text: string, done: number, total: number): void {
  getNative()?.update(title, text, done, total);
}

export function stopDownloadService(): void {
  getNative()?.stop();
}

/** Fires when "Stop" is tapped on the download notification. */
export function onDownloadStopRequested(listener: () => void): { remove(): void } {
  return getNative()?.addListener('onStopRequested', listener) ?? { remove() {} };
}
