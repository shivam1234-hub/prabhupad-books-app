import type { BookMeta } from '@/types';
import { CHAPTER_TITLES } from './chapterTitles';
import { FRONT_MATTER } from './frontMatter';
import { SPL_VOLUMES } from './splChapters';
import { RKD_PARTS } from './rkdChapters';
import { VANISOURCE_META, VANISOURCE_CHAPTERS } from './vanisourceData';
import { EXTRAS_META, EXTRAS_PAGES, extraDisplayTitle } from './vanisourceExtras';
import { SB_CHAPTER_TITLES } from './sbChapters';

// Prose books: one page per chapter (/slug/N/), titles scraped from vedabase.
const proseChapters = (slug: string) =>
  CHAPTER_TITLES[slug].map((title, i) => ({ number: i + 1, title, verseCount: 1 }));

// Śrīmad-Bhāgavatam cantos 3-12. Chapter titles come from the generated
// catalogue (scripts/generate-sb-chapters.mjs); they used to be `Chapter N`
// placeholders, which is what the app displayed. verseCount stays a per-canto
// estimate — the true count is read from the chapter page at download time
// (see fetchAndCacheBook), so it only seeds initial progress.
const sbCanto = (number: number, title: string, length: number, verseCount: number) => ({
  number,
  title,
  chapters: Array.from({ length }, (_, i) => ({
    number: i + 1,
    title: SB_CHAPTER_TITLES[number]?.[i] ?? `Chapter ${i + 1}`,
    verseCount,
    cantoPart: number,
  })),
});

export const BOOKS: BookMeta[] = [
  {
    slug: 'bg',
    title: 'Bhagavad-gītā As It Is',
    subtitle: 'The Song of God',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'scripture',
    description:
      'The Bhagavad-gītā is the most widely read of all Sanskrit philosophical works. It was spoken by Lord Kṛṣṇa to His friend and devotee Arjuna on the battlefield of Kurukṣetra.',
    coverColor: '#2E7D32',
    hasCantos: false,
    chapters: Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      title: [
        'Observing the Armies on the Battlefield of Kurukṣetra',
        'Contents of the Gītā Summarized',
        'Karma-yoga',
        'Transcendental Knowledge',
        'Karma-yoga — Action in Kṛṣṇa Consciousness',
        'Dhyāna-yoga',
        'Knowledge of the Absolute',
        'Attaining the Supreme',
        'The Most Confidential Knowledge',
        'The Opulence of the Absolute',
        'The Universal Form',
        'Devotional Service',
        'Nature, the Enjoyer, and Consciousness',
        'The Three Modes of Material Nature',
        'The Yoga of the Supreme Person',
        'The Divine and Demoniac Natures',
        'The Divisions of Faith',
        'Conclusion — The Perfection of Renunciation',
      ][i],
      verseCount: [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78][i],
    })),
    totalVerses: 700,
    languages: ['en', 'hi', 'bn', 'gu', 'te', 'mr', 'de', 'fr', 'es', 'pt', 'ru', 'ta'],
    hasAudio: true,
  },
  {
    slug: 'sb',
    title: 'Śrīmad-Bhāgavatam',
    subtitle: 'The Beautiful Story of the Personality of Godhead',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'scripture',
    description:
      'Śrīmad-Bhāgavatam is the ripened fruit of the tree of Vedic literature. Composed in eighteen thousand verses, it comprehensively covers all aspects of devotional service to Lord Kṛṣṇa.',
    coverColor: '#1565C0',
    hasCantos: true,
    cantos: [
      {
        number: 1, title: 'Creation', chapters: [
          { number: 1, title: 'Questions by the Sages', verseCount: 23, cantoPart: 1 },
          { number: 2, title: 'Divinity and Divine Service', verseCount: 34, cantoPart: 1 },
          { number: 3, title: 'Kṛṣṇa Is the Source of All Incarnations', verseCount: 43, cantoPart: 1 },
          { number: 4, title: "The Appearance of Śrī Nārada", verseCount: 33, cantoPart: 1 },
          { number: 5, title: "Nārada's Instructions on Śrīmad-Bhāgavatam", verseCount: 40, cantoPart: 1 },
          { number: 6, title: "Conversation Between Nārada and Vyāsadeva", verseCount: 38, cantoPart: 1 },
          { number: 7, title: "The Son of Droṇa Punished", verseCount: 58, cantoPart: 1 },
          { number: 8, title: "Prayers by Queen Kuntī and Parīkṣit Saved", verseCount: 52, cantoPart: 1 },
          { number: 9, title: "The Passing Away of Bhīṣmadeva", verseCount: 49, cantoPart: 1 },
          { number: 10, title: "Departure of Lord Kṛṣṇa for Dvārakā", verseCount: 35, cantoPart: 1 },
          { number: 11, title: "Lord Kṛṣṇa's Entrance into Dvārakā", verseCount: 38, cantoPart: 1 },
          { number: 12, title: "Birth of Emperor Parīkṣit", verseCount: 35, cantoPart: 1 },
          { number: 13, title: "Dhṛtarāṣṭra Quits Home", verseCount: 60, cantoPart: 1 },
          { number: 14, title: "The Disappearance of Lord Kṛṣṇa", verseCount: 44, cantoPart: 1 },
          { number: 15, title: "The Pāṇḍavas Retire Timely", verseCount: 51, cantoPart: 1 },
          { number: 16, title: "How Parīkṣit Received the Age of Kali", verseCount: 36, cantoPart: 1 },
          { number: 17, title: "Punishment and Reward of Kali", verseCount: 45, cantoPart: 1 },
          { number: 18, title: "Mahārāja Parīkṣit Cursed by a Brāhmaṇa Boy", verseCount: 50, cantoPart: 1 },
          { number: 19, title: "The Appearance of Śukadeva Gosvāmī", verseCount: 40, cantoPart: 1 },
        ],
      },
      {
        number: 2, title: 'The Cosmic Manifestation', chapters: [
          { number: 1, title: 'The First Step in God Realization', verseCount: 39, cantoPart: 2 },
          { number: 2, title: 'The Lord in the Heart', verseCount: 37, cantoPart: 2 },
          { number: 3, title: "Pure Devotional Service: The Change in Heart", verseCount: 26, cantoPart: 2 },
          { number: 4, title: "The Process of Creation", verseCount: 25, cantoPart: 2 },
          { number: 5, title: "The Cause of All Causes", verseCount: 42, cantoPart: 2 },
          { number: 6, title: "Purusa-sukta Confirmed", verseCount: 44, cantoPart: 2 },
          { number: 7, title: "Scheduled Incarnations with Specific Functions", verseCount: 53, cantoPart: 2 },
          { number: 8, title: "Questions by King Parīkṣit", verseCount: 28, cantoPart: 2 },
          { number: 9, title: "Answers by Citing the Lord's Version", verseCount: 45, cantoPart: 2 },
          { number: 10, title: "Bhāgavatam Is the Answer to All Questions", verseCount: 51, cantoPart: 2 },
        ],
      },
      sbCanto(3, 'The Status Quo', 33, 30),
      sbCanto(4, 'The Creation of the Fourth Order', 31, 28),
      sbCanto(5, 'The Creative Impetus', 26, 30),
      sbCanto(6, 'Prescribed Duties for Mankind', 19, 28),
      sbCanto(7, 'The Science of God', 15, 55),
      sbCanto(8, 'Withdrawal of the Cosmic Creations', 24, 40),
      sbCanto(9, 'Liberation, the Ultimate Gain', 24, 35),
      sbCanto(10, 'The Summum Bonum', 90, 25),
      sbCanto(11, 'General History', 31, 30),
      sbCanto(12, 'The Age of Deterioration', 13, 35),
    ],
    totalVerses: 18000,
    languages: ['en', 'hi', 'bn', 'de', 'fr', 'es', 'pt', 'ru'],
    hasAudio: true,
  },
  {
    slug: 'cc',
    title: 'Śrī Caitanya-caritāmṛta',
    subtitle: 'The Nectar of the Activities of Lord Caitanya',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'scripture',
    description:
      'Written in the sixteenth century, the Caitanya-caritāmṛta is the primary biography of Śrī Caitanya Mahāprabhu, the avatāra of Kṛṣṇa who appeared in Bengal.',
    coverColor: '#6A1B9A',
    hasCantos: true,
    cantos: [
      {
        number: 1, title: 'Ādi-līlā', chapters: Array.from({ length: 17 }, (_, i) => ({
          number: i + 1, title: `Ādi-līlā Chapter ${i + 1}`, verseCount: 40, cantoPart: 1
        }))
      },
      {
        number: 2, title: 'Madhya-līlā', chapters: Array.from({ length: 25 }, (_, i) => ({
          number: i + 1, title: `Madhya-līlā Chapter ${i + 1}`, verseCount: 50, cantoPart: 2
        }))
      },
      {
        number: 3, title: 'Antya-līlā', chapters: Array.from({ length: 20 }, (_, i) => ({
          number: i + 1, title: `Antya-līlā Chapter ${i + 1}`, verseCount: 35, cantoPart: 3
        }))
      },
    ],
    totalVerses: 10000,
    languages: ['en', 'bn'],
    hasAudio: false,
  },
  {
    slug: 'noi',
    title: 'Nectar of Instruction',
    subtitle: 'Śrī Upadeśāmṛta',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'scripture',
    description:
      'Eleven essential verses on the process of bhakti-yoga, originally composed in Sanskrit by Śrīla Rūpa Gosvāmī.',
    coverColor: '#E65100',
    hasCantos: false,
    chapters: [{ number: 1, title: 'Text 1–11', verseCount: 11 }],
    totalVerses: 11,
    languages: ['en', 'hi', 'bn'],
    hasAudio: false,
  },
  {
    slug: 'nod',
    title: 'Nectar of Devotion',
    subtitle: 'The Complete Science of Bhakti-yoga',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'A summary study of Śrīla Rūpa Gosvāmī\'s Bhakti-rasāmṛta-sindhu, covering all aspects of the science of devotional service.',
    coverColor: '#C62828',
    hasCantos: false,
    chapters: proseChapters('nod'),
    totalVerses: 51,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'iso',
    title: 'Śrī Īśopaniṣad',
    subtitle: 'Knowledge of the Absolute',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'scripture',
    description:
      'The Śrī Īśopaniṣad contains eighteen mantras that present the essence of all Vedic knowledge.',
    coverColor: '#BF360C',
    hasCantos: false,
    chapters: [{ number: 1, title: 'Mantras 1–18', verseCount: 18 }],
    totalVerses: 18,
    languages: ['en', 'hi'],
    hasAudio: false,
  },
  {
    slug: 'kb',
    title: 'Kṛṣṇa, the Supreme Personality of Godhead',
    subtitle: 'A Summary Study of the Tenth Canto of Śrīmad-Bhāgavatam',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'A narration of the pastimes of Lord Kṛṣṇa as described in the Tenth Canto of the Śrīmad-Bhāgavatam.',
    coverColor: '#1A237E',
    hasCantos: false,
    chapters: proseChapters('kb'),
    totalVerses: 90,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'ssr',
    title: 'Science of Self Realization',
    subtitle: '',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'A compilation of interviews, essays, and lectures, exploring the ultimate questions of life and consciousness from a Vedic perspective.',
    coverColor: '#37474F',
    hasCantos: false,
    chapters: proseChapters('ssr'),
    totalVerses: 8,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'tlc',
    title: 'Teachings of Lord Caitanya',
    subtitle: 'The Golden Avatāra',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'An authoritative presentation of the philosophy and teachings of Śrī Caitanya Mahāprabhu.',
    coverColor: '#F9A825',
    hasCantos: false,
    chapters: proseChapters('tlc'),
    totalVerses: 32,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'bbd',
    title: 'Beyond Birth and Death',
    subtitle: '',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'An explanation of the subtle nature of the soul and its journey beyond the cycle of birth and death.',
    coverColor: '#880E4F',
    hasCantos: false,
    chapters: proseChapters('bbd'),
    totalVerses: 5,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'rv',
    title: 'Rāja-vidyā: The King of Knowledge',
    subtitle: '',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'Based on lectures given in New York in 1966, this book presents the Gītā\'s philosophy of work and knowledge.',
    coverColor: '#4A148C',
    hasCantos: false,
    chapters: proseChapters('rv'),
    totalVerses: 8,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'pqpa',
    title: 'Perfect Questions, Perfect Answers',
    subtitle: '',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'A recorded conversation between Śrīla Prabhupāda and a sincere young American seeker in Māyāpur, 1972.',
    coverColor: '#33691E',
    hasCantos: false,
    chapters: proseChapters('pqpa'),
    totalVerses: 9,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'tlk',
    title: 'Teachings of Lord Kapila',
    subtitle: 'The Son of Devahūti',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'An explanation of Sāṅkhya philosophy as taught by Lord Kapila to His mother Devahūti.',
    coverColor: '#BF360C',
    hasCantos: false,
    chapters: proseChapters('tlk'),
    totalVerses: 18,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'tqk',
    title: 'Teachings of Queen Kuntī',
    subtitle: '',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'An explanation of Queen Kuntī\'s prayers from the First Canto of Śrīmad-Bhāgavatam.',
    coverColor: '#AD1457',
    hasCantos: false,
    chapters: proseChapters('tqk'),
    totalVerses: 26,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'lob',
    title: 'Light of the Bhāgavata',
    subtitle: '',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'commentary',
    description:
      'A series of verses from the Eleventh Canto of Śrīmad-Bhāgavatam describing the cycle of seasons.',
    coverColor: '#558B2F',
    hasCantos: false,
    chapters: [{ number: 1, title: 'Texts', verseCount: 48 }],
    totalVerses: 48,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'spl',
    title: 'Śrīla Prabhupāda-līlāmṛta',
    subtitle: 'A Biography of His Divine Grace',
    author: 'Satsvarupa dasa Goswami',
    category: 'biography',
    description:
      'The authorized biography of Śrīla Prabhupāda, tracing his life from birth in Calcutta in 1896 to his passing in Vṛndāvana in 1977.',
    coverColor: '#5D4037',
    hasCantos: true,
    cantos: SPL_VOLUMES,
    totalVerses: 65,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'rkd',
    title: 'Rāmāyaṇa',
    subtitle: 'Retold by Kṛṣṇa Dharma dāsa',
    author: 'Kṛṣṇa Dharma dāsa',
    category: 'commentary',
    description:
      'A faithful retelling of Vālmīki\'s epic — the life of Lord Rāmacandra, His exile, the abduction of Sītā, and the war with Rāvaṇa.',
    coverColor: '#E65100',
    hasCantos: true,
    cantos: RKD_PARTS,
    totalVerses: 39,
    languages: ['en'],
    hasAudio: false,
  },
  {
    slug: 'bs',
    title: 'Brahma-saṁhitā',
    subtitle: 'With the Commentary of Śrīla Jīva Gosvāmī',
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: 'scripture',
    description:
      'The Fifth Chapter of the Brahma-saṁhitā, consisting of 62 verses glorifying the form and attributes of Lord Govinda.',
    coverColor: '#283593',
    hasCantos: false,
    chapters: [{ number: 5, title: 'Chapter 5', verseCount: 62 }],
    totalVerses: 62,
    languages: ['en'],
    hasAudio: false,
  },
];

// Attach scraped front-matter pages (introduction, preface, foreword…) to books.
for (const b of BOOKS) {
  if (FRONT_MATTER[b.slug]) b.frontMatter = FRONT_MATTER[b.slug];
}

// Vanisource books (prose works not on vedabase) — chapters fetched via the
// MediaWiki API using each chapter's pageId.
const VS_COLORS = ['#00695C', '#5D4037', '#283593', '#AD1457', '#2E7D32', '#6A1B9A', '#C62828', '#0277BD', '#EF6C00', '#4527A0'];
let _vsColor = 0;
for (const [slug, meta] of Object.entries(VANISOURCE_META)) {
  const chapters = VANISOURCE_CHAPTERS[slug] ?? [];
  BOOKS.push({
    slug: slug as any,
    title: meta.title,
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: meta.bookCategory as any,
    description: `${meta.title} — by His Divine Grace A.C. Bhaktivedanta Swami Prabhupāda.`,
    coverColor: VS_COLORS[_vsColor++ % VS_COLORS.length],
    hasCantos: false,
    chapters: chapters.map((c, i) => ({ number: i + 1, title: c.title, verseCount: 1, pageId: c.id })),
    totalVerses: chapters.length,
    source: 'vanisource',
    languages: ['en'],
    hasAudio: false,
  });
}

// Lectures, letters and conversations (vanisource). Each section is modelled as
// a book whose "chapters" are individual wiki pages — the same shape the other
// vanisource works already use, so browsing, offline download and search all
// work through the existing paths with no special-casing.
const EXTRA_COLORS: Record<string, string> = {
  lecture: '#B45309',
  letter: '#7C2D12',
  conversation: '#3F3F46',
};

for (const [slug, meta] of Object.entries(EXTRAS_META)) {
  const pages = EXTRAS_PAGES[slug] ?? [];
  if (pages.length === 0) continue;
  BOOKS.push({
    slug: slug as any,
    title: meta.title,
    author: 'A.C. Bhaktivedanta Swami Prabhupāda',
    category: meta.category as any,
    description: `${pages.length} ${meta.category === 'letter' ? 'letters' : meta.category === 'conversation' ? 'conversations' : 'lectures'} by His Divine Grace A.C. Bhaktivedanta Swami Prabhupāda.`,
    coverColor: EXTRA_COLORS[meta.category] ?? '#57534E',
    hasCantos: false,
    chapters: pages.map((pageTitle, i) => ({
      number: i + 1,
      title: extraDisplayTitle(pageTitle),
      verseCount: 1,
      pageId: pageTitle,
    })),
    totalVerses: pages.length,
    source: 'vanisource',
    languages: ['en'],
    hasAudio: false,
  });
}

export const BOOK_CATEGORIES = [
  { id: 'scripture', label: 'Scriptures', icon: 'book' },
  { id: 'commentary', label: 'Books', icon: 'bookmark' },
  { id: 'biography', label: 'Biography', icon: 'person' },
  { id: 'lecture', label: 'Lectures', icon: 'mic' },
  { id: 'letter', label: 'Letters', icon: 'mail' },
  { id: 'conversation', label: 'Conversations', icon: 'chat' },
];

export const FEATURED_BOOKS = ['bg', 'sb', 'cc', 'noi', 'iso'];

export function getBook(slug: string): BookMeta | undefined {
  return BOOKS.find((b) => b.slug === slug);
}

export function getAllChapters(book: BookMeta): { cantoPart?: number; chapter: number; title: string; verseCount: number; pageId?: string }[] {
  if (book.hasCantos && book.cantos) {
    return book.cantos.flatMap((c) =>
      c.chapters.map((ch) => ({ cantoPart: c.number, chapter: ch.number, title: ch.title, verseCount: ch.verseCount }))
    );
  }
  return (book.chapters || []).map((ch) => ({ chapter: ch.number, title: ch.title, verseCount: ch.verseCount, pageId: ch.pageId }));
}
