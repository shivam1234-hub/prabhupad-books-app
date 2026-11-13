export type BookSlug =
  | 'bg' | 'sb' | 'cc' | 'noi' | 'nod' | 'iso' | 'kb'
  | 'ssr' | 'tlc' | 'bbd' | 'rv'
  | 'pqpa' | 'tlk' | 'tqk' | 'lob' | 'spl' | 'rkd'
  | 'bs' | 'sp' | 'acbsp';

export type BookCategory =
  | 'scripture' | 'commentary' | 'biography' | 'lecture' | 'letter' | 'conversation';

export interface BookMeta {
  slug: BookSlug;
  title: string;
  subtitle?: string;
  author: string;
  category: BookCategory;
  description: string;
  coverColor: string;
  hasCantos: boolean;
  cantos?: CantoPart[];
  chapters?: ChapterMeta[];
  totalVerses?: number;
  // Front-matter pages (introduction, preface, foreword…) at /slug/<id>/.
  frontMatter?: { id: string; title: string }[];
  // Content source. Defaults to vedabase; 'vanisource' books fetch via the
  // vanisource MediaWiki API using each chapter's pageId.
  source?: 'vedabase' | 'vanisource';
  languages: string[];
  hasAudio: boolean;
}

export interface CantoPart {
  number: number;
  title: string;
  chapters: ChapterMeta[];
}

export interface ChapterMeta {
  number: number;
  title: string;
  verseCount: number;
  cantoPart?: number;
  // For vanisource books: the MediaWiki page title used to fetch this chapter.
  pageId?: string;
}

export interface Verse {
  id: string;
  bookSlug: BookSlug;
  canto?: number;
  chapter: number;
  verse: number | string;
  verseRange?: string;
  devanagari?: string;
  bengali?: string;
  transliteration?: string;
  synonyms?: string;
  translation?: string;
  purport?: string;
  audioUrl?: string;
  language: string;
}

export interface SearchResult {
  verse: Verse;
  matchField: 'translation' | 'purport' | 'synonyms' | 'devanagari';
  snippet: string;
  relevance: number;
}

export interface Favorite {
  id: string;
  verseId: string;
  bookSlug: BookSlug;
  canto?: number;
  chapter: number;
  verse: number | string;
  addedAt: number;
  note?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface VerseTag {
  verseId: string;
  tagId: string;
}

export interface Note {
  id: string;
  verseId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingProgress {
  bookSlug: BookSlug;
  canto?: number;
  chapter: number;
  verse: number | string;
  updatedAt: number;
  completedChapters: string[];
}

export interface DownloadStatus {
  bookSlug: BookSlug;
  status: 'not_downloaded' | 'downloading' | 'downloaded' | 'error';
  progress: number;
  totalVerses: number;
  downloadedVerses: number;
  downloadedAt?: number;
}

export type ThemeMode = 'light' | 'dark' | 'system' | 'vedabase';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type Language = 'en' | 'hi' | 'bn' | 'gu' | 'te' | 'mr' | 'ta' | 'de' | 'fr' | 'es' | 'pt' | 'ru';

/** Indian languages the reader can machine-translate a verse into. */
export type TranslateLang = 'hi' | 'bn' | 'kn' | 'mr' | 'gu' | 'ta' | 'te' | 'ur';

export interface AppSettings {
  themeMode: ThemeMode;
  fontSize: FontSize;
  // Proportional multiplier applied to all scripture text in the library
  // reading screens (1 = 100%). Adjusted from the reading screens themselves.
  fontScale: number;
  language: Language;
  showDevanagari: boolean;
  showTransliteration: boolean;
  showSynonyms: boolean;
  showTranslation: boolean;
  showPurport: boolean;
  autoPlayAudio: boolean;
  slokaOfDayEnabled: boolean;
  slokaOfDayTime: string;
  slokaOfDayBook: BookSlug | 'all';
  lockScreenEnabled: boolean;
  offlineMode: boolean;
  // How many pages a book download fetches at once (Download Manager setting).
  downloadConcurrency: number;
  // First-launch feature tour has been shown (FeatureTour).
  tourSeen: boolean;
  // Machine translation of the translation and purport (Android, ML Kit):
  // the chosen language, and whether verses open translated.
  translateLang: TranslateLang | null;
  autoTranslate: boolean;
}

export interface DailySloka {
  date: string;
  verse: Verse;
  bookTitle: string;
  reference: string;
}

export interface ApiVerseResponse {
  verse_text?: string;
  devanagari?: string;
  synonyms?: string;
  translation?: string;
  purport?: string;
  audio?: string;
}
