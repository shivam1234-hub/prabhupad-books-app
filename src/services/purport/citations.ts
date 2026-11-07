/**
 * References to scripture inside a purport — "(Kaṭha Upaniṣad 2.2.13)",
 * "Bg. 7.17 and 11.40", "Cc. Madhya 19.170", "the Third Chapter (verses 14
 * and 15) of the Śvetāśvatara Upaniṣad" — read into a work and a verse
 * number. Only what Śrīla Prabhupāda himself wrote is read; nothing is
 * inferred from the sense of a sentence.
 *
 * Pure (no I/O), so the evaluation script runs exactly the app's logic.
 */

export interface LibraryRef {
  bookSlug: 'bg' | 'sb' | 'cc' | 'iso' | 'noi' | 'bs';
  canto?: number;
  chapter: number;
  verse: string;
}

export interface Citation {
  /** The work as it is usually named ("Kaṭha Upaniṣad"). */
  work: string;
  /** "2.2.13", "Madhya 19.170", "14–15". */
  number: string;
  /** "Kaṭha Upaniṣad 2.2.13". */
  label: string;
  /** Where to open it, when the work is in the library. */
  ref: LibraryRef | null;
  /** The last verse of a cited range ("14.11–13" → 13), kept when the
   * range is quoted verse by verse. */
  rangeTo?: number;
  /** How the citation was read: his words in full, or the book implied by
   * the purport it stands in ("(7.14)" inside a Gītā purport). */
  how: 'named' | 'implied';
  start: number;
  end: number;
}

interface Work {
  name: string;
  /** Names as written, diacritics folded, lower-case; regex source. */
  names: string;
  slug?: LibraryRef['bookSlug'];
}

// Longer names first where one contains another (Bhagavad-gītā before Gītā).
const WORKS: Work[] = [
  { name: 'Bhagavad-gītā', names: 'bhagavad[- ]gita|bg\\.?|gita', slug: 'bg' },
  { name: 'Śrīmad-Bhāgavatam', names: 'srimad[- ]bhagavatam|bhagavatam|bhag\\.|sb\\.?', slug: 'sb' },
  { name: 'Śrī Caitanya-caritāmṛta', names: '(?:sri )?caitanya[- ]caritamrta|cc\\.?', slug: 'cc' },
  { name: 'Śrī Īśopaniṣad', names: '(?:sri )?isopanisad|isa upanisad|iso\\.?', slug: 'iso' },
  { name: 'Upadeśāmṛta', names: 'upadesamrta|nectar of instruction|noi\\.?', slug: 'noi' },
  { name: 'Brahma-saṁhitā', names: 'brahma[- ]samhita|bs\\.?', slug: 'bs' },
  { name: 'Kaṭha Upaniṣad', names: 'katha(?:[- ]upanisad)?' },
  { name: 'Kena Upaniṣad', names: 'kena[- ]upanisad' },
  { name: 'Praśna Upaniṣad', names: 'prasna[- ]upanisad' },
  { name: 'Muṇḍaka Upaniṣad', names: 'mundaka(?:[- ]upanisad)?' },
  { name: 'Māṇḍūkya Upaniṣad', names: 'mandukya(?:[- ]upanisad)?' },
  { name: 'Taittirīya Upaniṣad', names: 'taittiriya(?:[- ]upanisad)?' },
  { name: 'Aitareya Upaniṣad', names: 'aitareya(?:[- ]upanisad)?' },
  { name: 'Chāndogya Upaniṣad', names: 'chandogya(?:[- ]upanisad)?' },
  { name: 'Bṛhad-āraṇyaka Upaniṣad', names: 'brhad[- ]?aranyaka(?:[- ]upanisad)?' },
  { name: 'Śvetāśvatara Upaniṣad', names: 'svetasvatara(?:[- ]upanisad)?' },
  { name: 'Gopāla-tāpanī Upaniṣad', names: 'gopala[- ]tapani(?:[- ]upanisad)?' },
  { name: 'Nṛsiṁha-tāpanī Upaniṣad', names: 'nrsimha[- ]tapani(?:[- ]upanisad)?' },
  { name: 'Kaivalya Upaniṣad', names: 'kaivalya[- ]upanisad' },
  { name: 'Subāla Upaniṣad', names: 'subala[- ]upanisad' },
  { name: 'Nārāyaṇa Upaniṣad', names: 'narayana[- ]upanisad' },
  { name: 'Mahā Upaniṣad', names: 'maha[- ]upanisad' },
  { name: 'Kali-santaraṇa Upaniṣad', names: 'kali[- ]santarana(?:[- ]upanisad)?' },
  { name: 'Vedānta-sūtra', names: 'vedanta[- ]sutras?|brahma[- ]sutras?' },
  { name: 'Yoga-sūtra', names: 'yoga[- ]sutras?' },
  { name: 'Kauṣītakī Upaniṣad', names: 'kausitaki(?:[- ]upanisad)?' },
  { name: 'Amṛta-bindu Upaniṣad', names: 'amrta[- ]bindu(?:[- ]upanisad)?' },
  { name: 'Nārāyaṇa Atharva-śira Upaniṣad', names: 'narayana atharva[- ]sira(?:[- ]upanisad)?' },
  { name: 'Viṣṇu Purāṇa', names: 'visnu[- ]purana' },
  { name: 'Padma Purāṇa', names: 'padma[- ]purana' },
  { name: 'Brahma-vaivarta Purāṇa', names: 'brahma[- ]vaivarta(?:[- ]purana)?' },
  { name: 'Skanda Purāṇa', names: 'skanda[- ]purana' },
  { name: 'Garuḍa Purāṇa', names: 'garuda[- ]purana' },
  { name: 'Bṛhan-nāradīya Purāṇa', names: 'brhan[- ]naradiya(?:[- ]purana)?' },
  { name: 'Kūrma Purāṇa', names: 'kurma[- ]purana' },
  { name: 'Varāha Purāṇa', names: 'varaha[- ]purana' },
  { name: 'Mahābhārata', names: 'mahabharata' },
  { name: 'Rāmāyaṇa', names: 'ramayana' },
  { name: 'Manu-saṁhitā', names: 'manu[- ]samhita' },
  { name: 'Hari-vaṁśa', names: 'hari[- ]vamsa' },
  { name: 'Bhakti-rasāmṛta-sindhu', names: 'bhakti[- ]rasamrta[- ]sindhu|brs\\.?' },
  { name: 'Hari-bhakti-vilāsa', names: 'hari[- ]bhakti[- ]vilasa' },
  { name: 'Nārada-pañcarātra', names: 'narada[- ]pancaratra' },
  { name: 'Nārada-bhakti-sūtra', names: 'narada[- ]bhakti[- ]sutra' },
  { name: 'Laghu-bhāgavatāmṛta', names: 'laghu[- ]bhagavatamrta' },
  { name: 'Bhagavat-sandarbha', names: 'bhagavat[- ]sandarbha' },
  { name: 'Paramātma-sandarbha', names: 'paramatma[- ]sandarbha' },
  { name: 'Tattva-sandarbha', names: 'tattva[- ]sandarbha' },
  { name: 'Prīti-sandarbha', names: 'priti[- ]sandarbha' },
  { name: 'Stotra-ratna', names: 'stotra[- ]ratna' },
  { name: 'Mukunda-mālā-stotra', names: 'mukunda[- ]mala(?:[- ]stotra)?' },
  { name: 'Śikṣāṣṭaka', names: 'siksastaka' },
  { name: 'Caitanya-candrodaya-nāṭaka', names: 'caitanya[- ]candrodaya(?:[- ]nataka)?' },
  { name: 'Caitanya-bhāgavata', names: 'caitanya[- ]bhagavata' },
  { name: 'Ujjvala-nīlamaṇi', names: 'ujjvala[- ]nilamani' },
  { name: 'Padyāvalī', names: 'padyavali' },
  { name: 'Stava-mālā', names: 'stava[- ]mala' },
  { name: 'Vidagdha-mādhava', names: 'vidagdha[- ]madhava' },
  { name: 'Lalita-mādhava', names: 'lalita[- ]madhava' },
  { name: 'Ṛg Veda', names: 'rg[- ]veda' },
  { name: 'Atharva Veda', names: 'atharva[- ]veda' },
  { name: 'Yajur Veda', names: 'yajur[- ]veda' },
  { name: 'Sāma Veda', names: 'sama[- ]veda' },
];

/** Diacritics off, one character for one character (so offsets line up). */
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    // One UTF-16 unit per input unit: ’ stays, ṁ → m.
    out += base.length === ch.length ? base.toLowerCase() : ch.toLowerCase();
  }
  return out;
}

const NUM = '\\d+(?:\\.\\d+){0,3}(?:\\s?[-–]\\s?\\d+)?';
const LILA = '(adi|madhya|antya)(?:[- ]lila)?';
const NAME_RE = new RegExp(
  `(?<![a-z])(${WORKS.map(w => `(?:${w.names})`).join('|')})(?![a-z])` +
  `[\\s,(]{0,3}(?:(?:canto|chapter|text|verse|mantra|sutra)s?\\s)?(?:${LILA}[\\s,.]{0,3})?(${NUM})`,
  'g',
);
// "…, 11.40" / "and 11.40" continuing the same work.
const CONTINUE_RE = new RegExp(`^(\\s*(?:,|;|and|,\\s*and)\\s*)(${NUM})`);

function workOf(written: string): Work | null {
  for (const w of WORKS) if (new RegExp(`^(?:${w.names})$`).test(written)) return w;
  return null;
}

const LILA_NO: Record<string, number> = { adi: 1, madhya: 2, antya: 3 };
const LILA_NAME = ['Ādi', 'Madhya', 'Antya'];

/** A library address for a work and its number, when the shape fits. */
function toRef(slug: LibraryRef['bookSlug'] | undefined, num: string, lila?: string): LibraryRef | null {
  if (!slug) return null;
  const parts = num.replace(/\s/g, '').split(/[-–]/)[0].split('.').map(Number);
  const range = num.replace(/\s/g, '').match(/[-–](\d+)$/)?.[1];
  const verse = (v: number) => (range ? `${v}-${range}` : String(v));
  switch (slug) {
    case 'bg': return parts.length === 2 ? { bookSlug: 'bg', chapter: parts[0], verse: verse(parts[1]) } : null;
    case 'sb': return parts.length === 3 ? { bookSlug: 'sb', canto: parts[0], chapter: parts[1], verse: verse(parts[2]) } : null;
    case 'cc': return lila && parts.length === 2
      ? { bookSlug: 'cc', canto: LILA_NO[lila], chapter: parts[0], verse: verse(parts[1]) } : null;
    case 'iso': case 'noi': return parts.length === 1 ? { bookSlug: slug, chapter: 1, verse: verse(parts[0]) } : null;
    case 'bs': return parts.length === 2 && parts[0] === 5 ? { bookSlug: 'bs', chapter: 5, verse: verse(parts[1]) } : null;
  }
  return null;
}

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
};

/**
 * Every reference in a piece of purport text. `inBook` is the book the
 * purport belongs to: a bare "(7.14)" there means that book.
 */
export function findCitations(text: string, inBook?: string): Citation[] {
  const f = fold(text);
  const out: Citation[] = [];
  const taken = (s: number, e: number) => out.some(c => s < c.end && e > c.start);
  const push = (work: Work, num: string, lila: string | undefined, start: number, end: number, how: Citation['how']) => {
    const n = num.replace(/\s/g, '').replace('-', '–');
    const number = lila ? `${LILA_NAME[LILA_NO[lila] - 1]} ${n}` : n;
    const rangeTo = Number(n.match(/–(\d+)$/)?.[1]) || undefined;
    out.push({ work: work.name, number, label: `${work.name} ${number}`, ref: toRef(work.slug, num, lila), how, start, end, rangeTo });
  };

  // "the Third Chapter (verses 14 and 15) of the Śvetāśvatara Upaniṣad"
  const ORD = /(\w+) chapter,? \(?(?:verses?|texts?) (\d+)(?:\s*(?:and|[-–])\s*(\d+))?\)? of (?:the )?([a-z- ]+?)(?=[:,.;)]|\s(?:it|is|we|there|as)\b|$)/g;
  for (const m of f.matchAll(ORD)) {
    const ch = ORDINALS[m[1]];
    const work = workOf(m[4].trim());
    if (!ch || !work) continue;
    const num = `${ch}.${m[2]}${m[3] ? `-${m[3]}` : ''}`;
    push(work, num, undefined, m.index!, m.index! + m[0].length, 'named');
  }

  for (const m of f.matchAll(NAME_RE)) {
    const work = workOf(m[1]);
    if (!work || taken(m.index!, m.index! + m[0].length)) continue;
    // A bare "gītā 2" / "sb 1" with no dotted number is a chapter mention, not a verse.
    if (!/\./.test(m[3]) && !['iso', 'noi'].includes(work.slug ?? '') && !/(text|verse|mantra)s?\s/.test(m[0])) continue;
    push(work, m[3], m[2], m.index!, m.index! + m[0].length, 'named');
    // "Bg. 7.17 and 11.40"
    let end = m.index! + m[0].length;
    for (;;) {
      const c = f.slice(end).match(CONTINUE_RE);
      // Verse numbers only: "and 11.40", not "and 2 other verses".
      if (!c || (!/\./.test(c[2]) && work.slug !== 'iso' && work.slug !== 'noi')) break;
      push(work, c[2], m[2], end + c[1].length, end + c[0].length, 'named');
      end += c[0].length;
    }
  }

  // "(Madhya 20.263–264)", "Ādi-līlā 17.164": a līlā names the Caitanya-caritāmṛta.
  const cc = WORKS.find(w => w.slug === 'cc')!;
  for (const m of f.matchAll(new RegExp(`(?<![a-z])${LILA}[\\s,.]{1,3}(\\d+\\.\\d+(?:\\s?[-–]\\s?\\d+)?)`, 'g'))) {
    if (taken(m.index!, m.index! + m[0].length)) continue;
    push(cc, m[2], m[1], m.index!, m.index! + m[0].length, 'named');
  }

  // A bare "(7.14)" inside this book's own purports.
  const bare = inBook === 'bg' ? /\((\d+\.\d+)(?:\s?[-–]\s?\d+)?\)/g : inBook === 'sb' ? /\((\d+\.\d+\.\d+)(?:\s?[-–]\s?\d+)?\)/g : null;
  const own = WORKS.find(w => w.slug === inBook);
  if (bare && own) {
    for (const m of f.matchAll(bare)) {
      const s = m.index! + 1;
      const e = m.index! + m[0].length - 1;
      if (taken(m.index!, m.index! + m[0].length)) continue;
      // Not the verse number of an Upaniṣad or Purāṇa named just before it.
      const before = f.slice(Math.max(0, m.index! - 40), m.index!);
      if (/(upanisad|purana|sutra|samhita|veda|sastra|smrti|gita-mahatmya)s?\s*,?\s*$/.test(before)) continue;
      push(own, f.slice(s, e), undefined, s, e, 'implied');
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
