import { create } from 'zustand';
import { AppSettings, ThemeMode, FontSize, Language } from '@/types';

const SETTINGS_KEY = 'vedabase_settings';

const defaultSettings: AppSettings = {
  themeMode: 'system',
  fontSize: 'medium',
  fontScale: 1,
  language: 'en',
  showDevanagari: true,
  showTransliteration: true,
  showSynonyms: true,
  showTranslation: true,
  showPurport: true,
  autoPlayAudio: false,
  slokaOfDayEnabled: true,
  slokaOfDayTime: '06:00',
  slokaOfDayBook: 'all',
  lockScreenEnabled: true,
  offlineMode: false,
  downloadConcurrency: 8,
  tourSeen: false,
  translateLang: null,
  autoTranslate: false,
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,

  loadSettings: async () => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ settings: { ...defaultSettings, ...parsed, language: 'en' }, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  updateSetting: async (key, value) => {
    const newSettings = { ...get().settings, [key]: value };
    set({ settings: newSettings });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch {}
  },

  resetSettings: async () => {
    set({ settings: defaultSettings });
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch {}
  },
}));

export const fontSizeMap: Record<FontSize, number> = {
  small: 14,
  medium: 16,
  large: 19,
  xlarge: 22,
};

// Proportional reading-text scale, adjusted from the library reading screens.
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 2.0;
export const FONT_SCALE_STEP = 0.1;

export const clampFontScale = (v: number) =>
  Math.round(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, v)) * 10) / 10;

export const fontSizeLabels: Record<FontSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'Extra Large',
};

export const languageLabels: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  gu: 'ગુજરાતી',
  te: 'తెలుగు',
  mr: 'मराठी',
  ta: 'தமிழ்',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
};
