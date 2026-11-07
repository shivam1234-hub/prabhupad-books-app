import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type WallpaperFlag = 'home' | 'lock' | 'both';

export interface WallpaperParams {
  transliteration?: string;
  wordForWord?: string;
  translation?: string;
  reference?: string;
  isDark?: boolean;
}

let _native: {
  generateAndSetWallpaper(params: WallpaperParams, flag: string): Promise<void>;
} | null = null;
let _loadAttempted = false;

function getNative() {
  if (!_loadAttempted) {
    _loadAttempted = true;
    try {
      _native = requireNativeModule('WallpaperSetter');
    } catch {
      _native = null;
    }
  }
  return _native;
}

/**
 * Generates a verse wallpaper image in native Kotlin and sets it directly
 * without any system UI. Android only.
 */
export async function generateAndSetWallpaper(
  params: WallpaperParams,
  flag: WallpaperFlag = 'home',
): Promise<void> {
  if (Platform.OS !== 'android') return;
  const native = getNative();
  if (!native) throw new Error('WallpaperSetter native module is not available');
  await native.generateAndSetWallpaper(params, flag);
}
