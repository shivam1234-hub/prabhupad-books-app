import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

interface NativeTranslate {
  isModelDownloaded(lang: string): Promise<boolean>;
  downloadModel(lang: string): Promise<void>;
  deleteModel(lang: string): Promise<void>;
  translate(texts: string[], lang: string): Promise<string[]>;
}

let _native: NativeTranslate | null = null;
let _loadAttempted = false;

function getNative(): NativeTranslate | null {
  if (!_loadAttempted) {
    _loadAttempted = true;
    if (Platform.OS === 'android') {
      try {
        _native = requireNativeModule('OnDeviceTranslate');
      } catch {
        _native = null;
      }
    }
  }
  return _native;
}

function native(): NativeTranslate {
  const n = getNative();
  if (!n) throw new Error('On-device translation is not available on this device');
  return n;
}

/** True when this build can translate on the device (Android only). */
export function isTranslationAvailable(): boolean {
  return getNative() != null;
}

export const isModelDownloaded = (lang: string) => native().isModelDownloaded(lang);
export const downloadModel = (lang: string) => native().downloadModel(lang);
export const deleteModel = (lang: string) => native().deleteModel(lang);
/** English → `lang`, one result per input text, in order. */
export const translateTexts = (texts: string[], lang: string) => native().translate(texts, lang);
