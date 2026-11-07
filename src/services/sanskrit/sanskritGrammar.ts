import { slp1ToIast } from './sanskritTranslit';
import { caseMisfit, krtLabel, lexiconReadings, nominalHint } from './formLexicon';

/**
 * Sanskrit grammar of a separated word: which vibhakti (case), vacana
 * (number) and liṅga (gender) its ending shows — or, for a verb, which
 * puruṣa (person), number and tense.
 *
 * The same tables drive the reader-facing grammar guide
 * (components/GrammarGuide.tsx), so what the analysis says and what the
 * guide teaches can never disagree. Forms are SLP1 (./sanskritTranslit.ts).
 *
 * An ending alone is often ambiguous (-āḥ is nominative plural, vocative
 * plural, or a feminine accusative plural), so the analysis returns every
 * reading whose stem is a known word, ranked; the caller shows the best and
 * mentions the rest.
 */

export type CaseNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type NumberNo = 0 | 1 | 2; // singular, dual, plural
export type Gender = 'm' | 'f' | 'n';

export const CASES: { no: CaseNo; english: string; sanskrit: string; hindi: string; role: string; sign: string }[] = [
  { no: 1, english: 'nominative', sanskrit: 'prathamā', hindi: 'कर्ता', role: 'the doer, the subject', sign: 'ने' },
  { no: 2, english: 'accusative', sanskrit: 'dvitīyā', hindi: 'कर्म', role: 'the object, what is acted on', sign: 'को' },
  { no: 3, english: 'instrumental', sanskrit: 'tṛtīyā', hindi: 'करण', role: 'by means of, with', sign: 'से, के द्वारा' },
  { no: 4, english: 'dative', sanskrit: 'caturthī', hindi: 'सम्प्रदान', role: 'for, to', sign: 'के लिए' },
  { no: 5, english: 'ablative', sanskrit: 'pañcamī', hindi: 'अपादान', role: 'from (separation)', sign: 'से (अलग)' },
  { no: 6, english: 'genitive', sanskrit: 'ṣaṣṭhī', hindi: 'सम्बन्ध', role: 'of, belonging to', sign: 'का, की, के' },
  { no: 7, english: 'locative', sanskrit: 'saptamī', hindi: 'अधिकरण', role: 'in, on, at', sign: 'में, पर' },
  { no: 8, english: 'vocative', sanskrit: 'sambodhana', hindi: 'सम्बोधन', role: 'calling someone', sign: 'हे' },
];

export const NUMBERS = [
  { english: 'singular', sanskrit: 'ekavacana' },
  { english: 'dual', sanskrit: 'dvivacana' },
  { english: 'plural', sanskrit: 'bahuvacana' },
];

export const GENDERS: Record<Gender, { english: string; sanskrit: string }> = {
  m: { english: 'masculine', sanskrit: 'puṁliṅga' },
  f: { english: 'feminine', sanskrit: 'strīliṅga' },
  n: { english: 'neuter', sanskrit: 'napuṁsaka-liṅga' },
};

export interface Paradigm {
  id: string;
  /** "Masculine -a". */
  title: string;
  /** Model word, IAST ("rāma"). */
  model: string;
  genders: Gender[];
  /** Letters of the stem the endings replace (SLP1): "a" for rāma. */
  stemEnd: string;
  /** Model stem without `stemEnd` (SLP1): "rAm". */
  base: string;
  /** [case 1..8][singular, dual, plural]; "/" separates alternatives. */
  forms: string[][];
  /** Other Gītā words that follow it. */
  examples: string;
}

// Rows 1–8; a row of three is singular / dual / plural.
export const PARADIGMS: Paradigm[] = [
  {
    id: 'a-m', title: 'Masculine -a', model: 'rāma', genders: ['m'], stemEnd: 'a', base: 'rAm',
    examples: 'deva, kṛṣṇa, arjuna, pārtha, bhoga, svarga',
    forms: [
      ['rAmaH', 'rAmO', 'rAmAH'], ['rAmam', 'rAmO', 'rAmAn'], ['rAmeRa', 'rAmAByAm', 'rAmEH'],
      ['rAmAya', 'rAmAByAm', 'rAmeByaH'], ['rAmAt', 'rAmAByAm', 'rAmeByaH'], ['rAmasya', 'rAmayoH', 'rAmARAm'],
      ['rAme', 'rAmayoH', 'rAmezu'], ['rAma', 'rAmO', 'rAmAH'],
    ],
  },
  {
    id: 'a-n', title: 'Neuter -a', model: 'phala', genders: ['n'], stemEnd: 'a', base: 'Pal',
    examples: 'jñāna, sukha, duḥkha, karma-phala',
    forms: [
      ['Palam', 'Pale', 'PalAni'], ['Palam', 'Pale', 'PalAni'], ['Palena', 'PalAByAm', 'PalEH'],
      ['PalAya', 'PalAByAm', 'PaleByaH'], ['PalAt', 'PalAByAm', 'PaleByaH'], ['Palasya', 'PalayoH', 'PalAnAm'],
      ['Pale', 'PalayoH', 'Palezu'], ['Pala', 'Pale', 'PalAni'],
    ],
  },
  {
    id: 'A-f', title: 'Feminine -ā', model: 'ramā', genders: ['f'], stemEnd: 'A', base: 'ram',
    examples: 'māyā, kathā, kriyā, puṣpitā',
    forms: [
      ['ramA', 'rame', 'ramAH'], ['ramAm', 'rame', 'ramAH'], ['ramayA', 'ramAByAm', 'ramABiH'],
      ['ramAyE', 'ramAByAm', 'ramAByaH'], ['ramAyAH', 'ramAByAm', 'ramAByaH'], ['ramAyAH', 'ramayoH', 'ramARAm'],
      ['ramAyAm', 'ramayoH', 'ramAsu'], ['rame', 'rame', 'ramAH'],
    ],
  },
  {
    id: 'i-m', title: 'Masculine -i', model: 'hari', genders: ['m'], stemEnd: 'i', base: 'har',
    examples: 'muni, agni, pati (in compounds)',
    forms: [
      ['hariH', 'harI', 'harayaH'], ['harim', 'harI', 'harIn'], ['hariRA', 'hariByAm', 'hariBiH'],
      ['haraye', 'hariByAm', 'hariByaH'], ['hareH', 'hariByAm', 'hariByaH'], ['hareH', 'haryoH', 'harIRAm'],
      ['harO', 'haryoH', 'harizu'], ['hare', 'harI', 'harayaH'],
    ],
  },
  {
    id: 'i-f', title: 'Feminine -i', model: 'mati', genders: ['f'], stemEnd: 'i', base: 'mat',
    examples: 'bhakti, śakti, gati, prakṛti',
    forms: [
      ['matiH', 'matI', 'matayaH'], ['matim', 'matI', 'matIH'], ['matyA', 'matiByAm', 'matiBiH'],
      ['mataye/matyE', 'matiByAm', 'matiByaH'], ['mateH/matyAH', 'matiByAm', 'matiByaH'],
      ['mateH/matyAH', 'matyoH', 'matInAm'], ['matO/matyAm', 'matyoH', 'matizu'], ['mate', 'matI', 'matayaH'],
    ],
  },
  {
    id: 'i-n', title: 'Neuter -i', model: 'vāri', genders: ['n'], stemEnd: 'i', base: 'vAr',
    examples: 'anādi, akṣi, dadhi',
    forms: [
      ['vAri', 'vAriRI', 'vArIRi'], ['vAri', 'vAriRI', 'vArIRi'], ['vAriRA', 'vAriByAm', 'vAriBiH'],
      ['vAriRe', 'vAriByAm', 'vAriByaH'], ['vAriRaH', 'vAriByAm', 'vAriByaH'], ['vAriRaH', 'vAriRoH', 'vArIRAm'],
      ['vAriRi', 'vAriRoH', 'vArizu'], ['vAri/vAre', 'vAriRI', 'vArIRi'],
    ],
  },
  {
    id: 'I-f', title: 'Feminine -ī', model: 'nadī', genders: ['f'], stemEnd: 'I', base: 'nad',
    examples: 'devī, pṛthivī, gopī',
    forms: [
      ['nadI', 'nadyO', 'nadyaH'], ['nadIm', 'nadyO', 'nadIH'], ['nadyA', 'nadIByAm', 'nadIBiH'],
      ['nadyE', 'nadIByAm', 'nadIByaH'], ['nadyAH', 'nadIByAm', 'nadIByaH'], ['nadyAH', 'nadyoH', 'nadInAm'],
      ['nadyAm', 'nadyoH', 'nadIzu'], ['nadi', 'nadyO', 'nadyaH'],
    ],
  },
  {
    id: 'u-m', title: 'Masculine -u', model: 'guru', genders: ['m'], stemEnd: 'u', base: 'gur',
    examples: 'viṣṇu, prabhu, sādhu',
    forms: [
      ['guruH', 'gurU', 'guravaH'], ['gurum', 'gurU', 'gurUn'], ['guruRA', 'guruByAm', 'guruBiH'],
      ['gurave', 'guruByAm', 'guruByaH'], ['guroH', 'guruByAm', 'guruByaH'], ['guroH', 'gurvoH', 'gurURAm'],
      ['gurO', 'gurvoH', 'guruzu'], ['guro', 'gurU', 'guravaH'],
    ],
  },
  {
    id: 'f-m', title: 'Masculine -ṛ (relations)', model: 'pitṛ', genders: ['m'], stemEnd: 'f', base: 'pit',
    examples: 'bhrātṛ',
    forms: [
      ['pitA', 'pitarO', 'pitaraH'], ['pitaram', 'pitarO', 'pitFn'], ['pitrA', 'pitfByAm', 'pitfBiH'],
      ['pitre', 'pitfByAm', 'pitfByaH'], ['pituH', 'pitfByAm', 'pitfByaH'], ['pituH', 'pitroH', 'pitFRAm'],
      ['pitari', 'pitroH', 'pitfzu'], ['pitaH', 'pitarO', 'pitaraH'],
    ],
  },
  {
    id: 'f-agent', title: 'Masculine -ṛ (doers)', model: 'kartṛ', genders: ['m'], stemEnd: 'f', base: 'kart',
    examples: 'bhoktṛ, dātṛ',
    forms: [
      ['kartA', 'kartArO', 'kartAraH'], ['kartAram', 'kartArO', 'kartFn'], ['kartrA', 'kartfByAm', 'kartfBiH'],
      ['kartre', 'kartfByAm', 'kartfByaH'], ['kartuH', 'kartfByAm', 'kartfByaH'], ['kartuH', 'kartroH', 'kartFRAm'],
      ['kartari', 'kartroH', 'kartfzu'], ['kartaH', 'kartArO', 'kartAraH'],
    ],
  },
  {
    id: 'an-m', title: 'Masculine -an', model: 'ātman', genders: ['m'], stemEnd: 'an', base: 'Atm',
    examples: 'brahman (Brahmā)',
    forms: [
      ['AtmA', 'AtmAnO', 'AtmAnaH'], ['AtmAnam', 'AtmAnO', 'AtmanaH'], ['AtmanA', 'AtmaByAm', 'AtmaBiH'],
      ['Atmane', 'AtmaByAm', 'AtmaByaH'], ['AtmanaH', 'AtmaByAm', 'AtmaByaH'], ['AtmanaH', 'AtmanoH', 'AtmanAm'],
      ['Atmani', 'AtmanoH', 'Atmasu'], ['Atman', 'AtmAnO', 'AtmAnaH'],
    ],
  },
  {
    id: 'an-n', title: 'Neuter -an', model: 'karman', genders: ['n'], stemEnd: 'an', base: 'karm',
    examples: 'janman, nāman, brahman (Brahman)',
    forms: [
      ['karma', 'karmaRI', 'karmARi'], ['karma', 'karmaRI', 'karmARi'], ['karmaRA', 'karmaByAm', 'karmaBiH'],
      ['karmaRe', 'karmaByAm', 'karmaByaH'], ['karmaRaH', 'karmaByAm', 'karmaByaH'], ['karmaRaH', 'karmaRoH', 'karmaRAm'],
      ['karmaRi', 'karmaRoH', 'karmasu'], ['karma/karman', 'karmaRI', 'karmARi'],
    ],
  },
  {
    id: 'in-m', title: 'Masculine -in', model: 'yogin', genders: ['m'], stemEnd: 'in', base: 'yog',
    examples: 'dehin, vādin, jñānin',
    forms: [
      ['yogI', 'yoginO', 'yoginaH'], ['yoginam', 'yoginO', 'yoginaH'], ['yoginA', 'yogiByAm', 'yogiBiH'],
      ['yogine', 'yogiByAm', 'yogiByaH'], ['yoginaH', 'yogiByAm', 'yogiByaH'], ['yoginaH', 'yoginoH', 'yoginAm'],
      ['yogini', 'yoginoH', 'yogizu'], ['yogin', 'yoginO', 'yoginaH'],
    ],
  },
  {
    // Present participles: carat "acting", gacchat "going" (nom. caran, gacchan).
    id: 'ant-m', title: 'Present participle -at (masc.)', model: 'gacchat', genders: ['m', 'n'], stemEnd: 'at', base: 'gacC',
    examples: 'caran (acting), paśyan (seeing), kurvan (doing)',
    forms: [
      ['gacCan', 'gacCantO', 'gacCantaH'], ['gacCantam', 'gacCantO', 'gacCataH'], ['gacCatA', 'gacCadByAm', 'gacCadBiH'],
      ['gacCate', 'gacCadByAm', 'gacCadByaH'], ['gacCataH', 'gacCadByAm', 'gacCadByaH'], ['gacCataH', 'gacCatoH', 'gacCatAm'],
      ['gacCati', 'gacCatoH', 'gacCatsu'], ['gacCan', 'gacCantO', 'gacCantaH'],
    ],
  },
  {
    id: 'at-m', title: 'Masculine -vat / -mat', model: 'bhagavat', genders: ['m'], stemEnd: 'at', base: 'Bagav',
    examples: 'śrīmat, buddhimat',
    forms: [
      ['BagavAn', 'BagavantO', 'BagavantaH'], ['Bagavantam', 'BagavantO', 'BagavataH'],
      ['BagavatA', 'BagavadByAm', 'BagavadBiH'], ['Bagavate', 'BagavadByAm', 'BagavadByaH'],
      ['BagavataH', 'BagavadByAm', 'BagavadByaH'], ['BagavataH', 'BagavatoH', 'BagavatAm'],
      ['Bagavati', 'BagavatoH', 'Bagavatsu'], ['Bagavan', 'BagavantO', 'BagavantaH'],
    ],
  },
  {
    id: 'as-n', title: 'Neuter -as', model: 'manas', genders: ['n'], stemEnd: 'as', base: 'man',
    examples: 'tapas, tejas, yaśas',
    forms: [
      ['manaH', 'manasI', 'manAMsi'], ['manaH', 'manasI', 'manAMsi'], ['manasA', 'manoByAm', 'manoBiH'],
      ['manase', 'manoByAm', 'manoByaH'], ['manasaH', 'manoByAm', 'manoByaH'], ['manasaH', 'manasoH', 'manasAm'],
      ['manasi', 'manasoH', 'manaHsu'], ['manaH', 'manasI', 'manAMsi'],
    ],
  },
  {
    // Any gender: the ending doesn't show it, so the analysis doesn't claim one.
    id: 'cons', title: 'Ending in a consonant', model: 'vāc', genders: [], stemEnd: '', base: 'vAc',
    examples: 'vipaścit, marut, diś',
    forms: [
      ['vAk', 'vAcO', 'vAcaH'], ['vAcam', 'vAcO', 'vAcaH'], ['vAcA', 'vAgByAm', 'vAgBiH'],
      ['vAce', 'vAgByAm', 'vAgByaH'], ['vAcaH', 'vAgByAm', 'vAgByaH'], ['vAcaH', 'vAcoH', 'vAcAm'],
      ['vAci', 'vAcoH', 'vAkzu'], ['vAk', 'vAcO', 'vAcaH'],
    ],
  },
];

// ── Verbs ──────────────────────────────────────────────────────────────────

export type Person = 1 | 2 | 3;

export const PERSONS: Record<Person, { english: string; sanskrit: string; who: string }> = {
  3: { english: '3rd person', sanskrit: 'prathama-puruṣa', who: 'he, she, it, they' },
  2: { english: '2nd person', sanskrit: 'madhyama-puruṣa', who: 'you' },
  1: { english: '1st person', sanskrit: 'uttama-puruṣa', who: 'I, we' },
};

export interface VerbEnding {
  /** SLP1 ending, after the present (or future) stem. */
  ending: string;
  tense: string;
  person?: Person;
  number?: NumberNo;
  /** Gerund / infinitive: not conjugated. */
  form?: string;
}

// Only the tenses the verses use constantly. Present endings include the
// stem vowel (-ati, -anti) so a noun in -ti (gati, prati) isn't read as a verb.
export const VERB_ENDINGS: VerbEnding[] = [
  { ending: 'ati', tense: 'present (laṭ)', person: 3, number: 0 },
  { ending: 'ataH', tense: 'present (laṭ)', person: 3, number: 1 },
  { ending: 'anti', tense: 'present (laṭ)', person: 3, number: 2 },
  { ending: 'asi', tense: 'present (laṭ)', person: 2, number: 0 },
  { ending: 'aTa', tense: 'present (laṭ)', person: 2, number: 2 },
  { ending: 'Ami', tense: 'present (laṭ)', person: 1, number: 0 },
  { ending: 'AmaH', tense: 'present (laṭ)', person: 1, number: 2 },
  { ending: 'ate', tense: 'present, ātmanepada (laṭ)', person: 3, number: 0 },
  { ending: 'ante', tense: 'present, ātmanepada (laṭ)', person: 3, number: 2 },
  { ending: 'ase', tense: 'present, ātmanepada (laṭ)', person: 2, number: 0 },
  { ending: 'e', tense: 'present, ātmanepada (laṭ)', person: 1, number: 0 },
  { ending: 'Amahe', tense: 'present, ātmanepada (laṭ)', person: 1, number: 2 },
  { ending: 'yate', tense: 'present passive or ātmanepada (laṭ)', person: 3, number: 0 },
  { ending: 'yante', tense: 'present passive or ātmanepada (laṭ)', person: 3, number: 2 },
  { ending: 'nute', tense: 'present, ātmanepada (laṭ)', person: 3, number: 0 },
  { ending: 'nuvanti', tense: 'present (laṭ)', person: 3, number: 2 },
  { ending: 'noti', tense: 'present (laṭ)', person: 3, number: 0 },
  { ending: 'syati', tense: 'future (lṛṭ)', person: 3, number: 0 },
  { ending: 'syanti', tense: 'future (lṛṭ)', person: 3, number: 2 },
  { ending: 'syasi', tense: 'future (lṛṭ)', person: 2, number: 0 },
  { ending: 'syAmi', tense: 'future (lṛṭ)', person: 1, number: 0 },
  { ending: 'syAmaH', tense: 'future (lṛṭ)', person: 1, number: 2 },
  { ending: 'syate', tense: 'future, ātmanepada (lṛṭ)', person: 3, number: 0 },
  { ending: 'syase', tense: 'future, ātmanepada (lṛṭ)', person: 2, number: 0 },
  { ending: 'sye', tense: 'future, ātmanepada (lṛṭ)', person: 1, number: 0 },
  { ending: 'syaDvam', tense: 'future stem, imperative ending (ātmanepada)', person: 2, number: 2 },
  // After i, u, k and r the future's s is written ṣ (vakṣyāmi, kariṣyati).
  { ending: 'zyati', tense: 'future (lṛṭ)', person: 3, number: 0 },
  { ending: 'zyanti', tense: 'future (lṛṭ)', person: 3, number: 2 },
  { ending: 'zyasi', tense: 'future (lṛṭ)', person: 2, number: 0 },
  { ending: 'zyAmi', tense: 'future (lṛṭ)', person: 1, number: 0 },
  { ending: 'zyAmaH', tense: 'future (lṛṭ)', person: 1, number: 2 },
  { ending: 'zyate', tense: 'future, ātmanepada (lṛṭ)', person: 3, number: 0 },
  { ending: 'zyase', tense: 'future, ātmanepada (lṛṭ)', person: 2, number: 0 },
  { ending: 'zye', tense: 'future, ātmanepada (lṛṭ)', person: 1, number: 0 },
  { ending: 'zyaDvam', tense: 'future stem, imperative ending (ātmanepada)', person: 2, number: 2 },
  { ending: 'atu', tense: 'imperative (loṭ)', person: 3, number: 0 },
  { ending: 'antu', tense: 'imperative (loṭ)', person: 3, number: 2 },
  { ending: 'ata', tense: 'imperative (loṭ)', person: 2, number: 2 },
  { ending: 'Ani', tense: 'imperative (loṭ)', person: 1, number: 0 },
  { ending: 'tu', tense: 'imperative (loṭ)', person: 3, number: 0 },
  { ending: 'Dvam', tense: 'imperative, ātmanepada (loṭ)', person: 2, number: 2 },
  { ending: 'yAt', tense: 'benedictive (āśīr-liṅ), used with optative sense', person: 3, number: 0 },
  { ending: 'te', tense: 'present, ātmanepada (laṭ)', person: 3, number: 0 },
  { ending: 'et', tense: 'optative (vidhi-liṅ)', person: 3, number: 0 },
  { ending: 'eyuH', tense: 'optative (vidhi-liṅ)', person: 3, number: 2 },
  { ending: 'eH', tense: 'optative (vidhi-liṅ)', person: 2, number: 0 },
  { ending: 'eyam', tense: 'optative (vidhi-liṅ)', person: 1, number: 0 },
  { ending: 'tvA', tense: '', form: 'gerund (having …-ed)' },
  { ending: 'itvA', tense: '', form: 'gerund (having …-ed)' },
  { ending: 'wvA', tense: '', form: 'gerund (having …-ed)' },
  { ending: 'DvA', tense: '', form: 'gerund (having …-ed)' },
  { ending: 'ya', tense: '', form: 'gerund with a prefix (having …-ed)' },
  { ending: 'tya', tense: '', form: 'gerund with a prefix (having …-ed), -tya after a short vowel (6.1.71)' },
  { ending: 'tum', tense: '', form: 'infinitive (to …)' },
  { ending: 'itum', tense: '', form: 'infinitive (to …)' },
];

/** Verb prefixes (upasarga), longest first, stripped to find the root. */
const UPASARGAS = [
  'aBi', 'aDi', 'anu', 'apa', 'api', 'ava', 'upa', 'pari', 'prati', 'pra', 'parA', 'ati', 'sam', 'vi', 'ni',
  'nis', 'nir', 'dus', 'dur', 'ut', 'ud', 'A',
].sort((a, b) => b.length - a.length);

/** Why a root is written differently inside a form, keyed by the written
 * stem (SLP1). Shown only when that stem actually occurs in the word. */
export const STEM_NOTES: Record<string, string> = {
  paSy: 'paśya- is the present stem that replaces √dṛś (Pāṇini 7.3.78: pā-ghrā-dhmā-sthā-mnā-dāṇ-dṛśy-arti-sarti-śada-sadāṁ piba-jighra-dhama-tiṣṭha-mana-yaccha-paśya-ṛccha-dhau-śīya-sīdāḥ)',
  gacC: 'gaccha- is the present stem of √gam (Pāṇini 7.3.77)',
  tizW: 'tiṣṭha- is the present stem that replaces √sthā (Pāṇini 7.3.78)',
  jiGr: 'jighra- is the present stem that replaces √ghrā (Pāṇini 7.3.78)',
  pib: 'piba- is the present stem that replaces √pā (Pāṇini 7.3.78)',
  yacC: 'yaccha- is the present stem that replaces √yam (Pāṇini 7.3.77)',
  Bav: 'guṇa: bhū → bho, and o → av before a vowel: bhav-',
  uk: 'samprasāraṇa: the va of √vac becomes u, and c → k before t: uk-',
  uc: 'samprasāraṇa: the va of √vac becomes u: uc-',
  yot: 'guṇa: u → o, and dh → t before s: yot-',
  vak: 'c → k before the s of -sya-, and that s becomes ṣ: vak-ṣya-',
  mok: 'guṇa: u → o, and c → k before the s of -sya- (which becomes ṣ): mok-ṣya-',
  kar: 'guṇa: ṛ → ar: kar-',
  kur: 'kuru- / kurv- is the present stem of √kṛ (class 8)',
  jAn: 'jānā- is the present stem of √jñā (class 9)',
};

/** Present stems whose root doesn't show in them, for the commonest verbs. */
const PRESENT_STEMS: Record<string, string> = {
  Bav: 'BU', gacC: 'gam', paSy: 'dfS', tizW: 'sTA', jiGr: 'GrA', pib: 'pA', yacC: 'yam',
  SfRv: 'Sru', SfRu: 'Sru', SfRo: 'Sru', kurv: 'kf', kur: 'kf', karo: 'kf', jAn: 'jYA', jAnA: 'jYA',
  kar: 'kf', kari: 'kf', kuryA: 'kf', vak: 'vac', uc: 'vac', as: 'as', s: 'as', aS: 'aS', Apnu: 'Ap',
  sfz: 'sfj', sraz: 'sfj', DI: 'DA', hri: 'hf', gfhy: 'grah', uk: 'vac', yot: 'yuD', yuDy: 'yuD', hf: 'hf',
  hft: 'hf', gat: 'gam', kft: 'kf', dfz: 'dfS', drak: 'dfS', mok: 'muc', mokz: 'muc', Asa: 'As', As: 'As',
  savi: 'sU', gan: 'gam', gaM: 'gam', hi: 'hA', jahA: 'hA', tyak: 'tyaj', Bokz: 'Buj', Bok: 'Buj', yok: 'yuj',
  manv: 'man', many: 'man', muhy: 'muh', padv: 'pad', pady: 'pad', vart: 'vft', vard: 'vfD',
  Baj: 'Baj', vad: 'vad', laB: 'laB', Bramat: 'Bram', Aps: 'Ap', Apno: 'Ap', Apnuv: 'Ap',
};

// ── Analysis ───────────────────────────────────────────────────────────────

export interface GrammarReading {
  kind: 'noun' | 'verb';
  /** Dictionary form (SLP1). For a verb, the root ("vad"), with any prefix. */
  stem: string;
  prefix?: string;
  paradigm?: Paradigm;
  gender?: Gender[];
  case?: CaseNo;
  number?: NumberNo;
  verb?: VerbEnding;
  /** The stem / root was not found in any dictionary: the reading rests on
   * the ending (and Prabhupāda's English) alone. */
  unverified?: boolean;
  /** The ending read off the word (SLP1), as it follows the paradigm's base. */
  ending?: string;
  /** The stem is an adjective (takes its noun's gender). */
  adjective?: boolean;
  /** A present participle: its root (SLP1). */
  participleOf?: string;
  /** The form-lexicon (Vidyut) reading this came from, when it did. */
  lex?: import('./formLexicon').LexReading;
  /** Lower is better. */
  score: number;
}

/** Whether a stem is a real word (glossary / Apte / particle), whether it
 * is a verb root, and its dictionary meanings (to compare with a gloss). */
export type StemKnown = (slp1: string) => {
  known: boolean; root: boolean; senses?: string;
  /** A present participle's root (carat → car), when the stem is one. */
  participleOf?: string;
  /** The noun's fixed gender(s) from the lexicon; empty when unknown. */
  genders?: Gender[];
  /** The stem is an adjective / participle: it takes its noun's gender. */
  adjective?: boolean;
};

/** Content words of Prabhupāda's gloss, to match against a stem's meanings. */
function glossWords(hint: string | null | undefined): string[] {
  if (!hint) return [];
  return hint.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter(w => w.length >= 4 && !['with', 'that', 'this', 'those', 'which', 'unto', 'from', 'their', 'there'].includes(w))
    .map(w => w.replace(/(ies|es|s)$/, ''));
}

interface EndingRef { ending: string; paradigm: Paradigm; case: CaseNo; number: NumberNo }

const retroflexVariants = (e: string) => (/[nR]/.test(e) ? [...new Set([e, e.replace(/R/g, 'n'), e.replace(/n/g, 'R')])] : [e]);

const NOUN_ENDINGS: EndingRef[] = (() => {
  const out: EndingRef[] = [];
  const seen = new Set<string>();
  for (const p of PARADIGMS) {
    p.forms.forEach((row, ci) => row.forEach((cell, ni) => {
      for (const form of cell.split('/')) {
        if (!form.startsWith(p.base)) continue; // consonant-stem forms whose final changes (vāk)
        for (const ending of retroflexVariants(form.slice(p.base.length))) {
          const k = `${p.id}|${ending}|${ci}|${ni}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ ending, paradigm: p, case: (ci + 1) as CaseNo, number: ni as NumberNo });
        }
      }
    }));
  }
  // Longest endings first: they are the more specific readings.
  return out.sort((a, b) => b.ending.length - a.ending.length);
})();

/**
 * Every stem an inflected form could come from by the paradigms above —
 * what the offline splitter (./sanskritLexicon.ts) checks against the
 * dictionary, so its idea of a valid ending is exactly this module's.
 */
export function stemCandidates(form: string): { stem: string; ending: string }[] {
  const out: { stem: string; ending: string }[] = [];
  const seen = new Set<string>();
  const add = (stem: string, ending: string) => {
    if (stem === form || stem.length < 2 || seen.has(stem)) return;
    seen.add(stem);
    out.push({ stem, ending });
  };
  for (const ref of NOUN_ENDINGS) {
    if (!form.endsWith(ref.ending)) continue;
    const base = form.slice(0, form.length - ref.ending.length);
    if (!base) continue;
    add(base + ref.paradigm.stemEnd, ref.ending);
    // The feminine of an -a adjective (puṣpitām ← puṣpita), and -ikā of -aka
    // (vyavasāyātmikā ← -ātmaka).
    if (ref.paradigm.id === 'A-f' || ref.paradigm.id === 'I-f') add(base + 'a', ref.ending);
    if (ref.paradigm.id === 'A-f' && base.endsWith('ik')) add(base.slice(0, -2) + 'aka', ref.ending);
  }
  return out;
}

/** Which cases a Prabhupāda gloss points to ("in the place…" → locative). */
function casesHintedBy(meaning: string | null | undefined): CaseNo[] {
  if (!meaning) return [];
  const m = meaning.trim().toLowerCase();
  if (/^o\s/.test(m)) return [8];
  if (/^(in|on|at|within|upon|among)\b/.test(m)) return [7];
  if (/^(of|from among)\b/.test(m) || /'s\b/.test(m.split(' ')[0] ?? '')) return [6];
  if (/^(by|with|through)\b/.test(m)) return [3];
  if (/^(from)\b/.test(m)) return [5, 6];
  // His "for …" is often a locative of purpose ("sarva-bhūta-hite — for the
  // welfare of all").
  if (/^(for)\b/.test(m)) return [4, 7];
  if (/^(unto|to)\b/.test(m)) return [4, 2];
  return [];
}

// Declensions an unverified reading may use: the common ones, plus the
// consonant stems whose endings are distinctive (vidvān ← -vat/-vas).
const FALLBACK_PARADIGMS = ['a-m', 'a-n', 'A-f', 'at-m', 'an-m', 'in-m', 'as-n'];

/** His English reads as a verb: "I shall now explain", "one tastes",
 * "is said to be", "let it be", "to execute", "creating". */
function verbalHint(meaning: string | null | undefined): boolean {
  if (!meaning) return false;
  const m = meaning.trim().toLowerCase();
  // "one who has no desires", "he who …", "those who …": a person, not a verb.
  if (/^(one|he|she|they|those|all|anyone|someone|it|you)\s+(who|whose|whom|which|that|of|in|with|without)\b/.test(m)) return false;
  return /^(i|you|he|she|it|one|they|we|let|must|should|shall|will|may|can|is|are|was|were|be|become|becomes|to|do|does|did|just)\b/.test(m)
    // "seeing", "acting upon …" — but not "living beings", where -ing describes a noun.
    || /^\w+ing$/.test(m) || /^\w+ing\s+(the|a|an|his|her|their|my|your|our|to|upon|on|in|of|with|at|this|that|these|those|all|me|him|them|it|up|out|down|away|over|for|from|by|about|into|such)\b/.test(m)
    || /^\w+(ed|s)$/.test(m);
}

// How common each declension is: the tie-breaker between two readings that
// fit the ending equally well.
const PARADIGM_RARITY: Record<string, number> = {
  'a-m': 0, 'a-n': 0, 'A-f': 0, cons: 0.1, 'an-m': 0.1, 'an-n': 0.1, 'in-m': 0.1, 'as-n': 0.15, 'at-m': 0.1,
  'i-m': 0.15, 'i-f': 0.15, 'i-n': 0.2, 'I-f': 0.15, 'u-m': 0.2, 'f-m': 0.3, 'f-agent': 0.3,
};

/**
 * Grammatical readings of one separated word (SLP1), best first. `hint` is
 * Prabhupāda's English for it, which often settles an ambiguous ending;
 * `preferStem` is the stem the offline splitter chose, when it chose one.
 */
export function analyseGrammar(
  form: string, known: StemKnown, hint?: string | null, preferStem?: string | null,
  lexicon?: import('./formLexicon').LexReading[] | null, compoundFinal = false,
): GrammarReading[] {
  // The form lexicon (Vidyut) knows the real readings of this form: choose
  // among those instead of reading the ending by rule.
  if (lexicon?.length) {
    const lexReadings = lexiconReadings(lexicon, hint, casesHintedBy(hint), verbalHint(hint), { compoundFinal });
    // Only verb readings, but his English names a thing (akāmaḥ, "one without
    // desire"): the rule readings may find the noun the lexicon lacks.
    const onlyVerbs = lexReadings.every(r => r.kind === 'verb' && !r.verb?.form);
    if (lexReadings.length && !(onlyVerbs && hint && !verbalHint(hint))) return fitHint(dedupeReadings(lexReadings), hint);
    if (lexReadings.length) {
      const rules = analyseGrammar(form, known, hint, preferStem, null, compoundFinal).filter(r => r.kind === 'noun' && !r.unverified);
      return fitHint(dedupeReadings(rules.length ? rules : lexReadings), hint);
    }
  }
  const readings: GrammarReading[] = [];
  const hinted = casesHintedBy(hint);
  const words = glossWords(hint);

  for (const ref of NOUN_ENDINGS) {
    if (!form.endsWith(ref.ending)) continue;
    const base = form.slice(0, form.length - ref.ending.length);
    if (base.length < 1) continue;
    let stem = base + ref.paradigm.stemEnd;
    let k = known(stem);
    // Adjectives are listed in -a; their feminine is -ā or -ī (puṣpita →
    // puṣpitā, "flowery", in puṣpitām).
    if ((!k.known || k.root) && (ref.paradigm.id === 'A-f' || ref.paradigm.id === 'I-f')) {
      // Only an adjective has a feminine in -ā: a noun in -a (śūra, brāhmaṇa)
      // never reads as feminine, and -e is never its vocative.
      const adj = known(base + 'a');
      if (adj.known && !adj.root && (adj.adjective || adj.participleOf)) { stem = base + 'a'; k = adj; }
      else if (base.endsWith('ik')) {
        const aka = known(base.slice(0, -2) + 'aka');
        if (aka.known && !aka.root) { stem = base.slice(0, -2) + 'aka'; k = { ...aka, adjective: true }; }
      }
    }
    if (!k.known || k.root) continue;
    // A noun has one gender: a paradigm of another gender can't be it
    // (śoka is masculine, so śokam is not a neuter).
    const fixed = !k.adjective && k.genders?.length ? k.genders : null;
    const paradigmGenders = ref.paradigm.genders;
    if (fixed && paradigmGenders.length && !paradigmGenders.some(g => fixed.includes(g))) continue;
    let score = 1 + (PARADIGM_RARITY[ref.paradigm.id] ?? 0.2) + (stem.length <= 2 ? 0.3 : 0);
    // Of two stems that fit the ending (vāc "speech" / vāca "a fish"), the
    // one whose dictionary meaning shares a word with his gloss ("words").
    if (words.length && k.senses) {
      const senses = k.senses.toLowerCase();
      if (words.some(w => senses.includes(w))) score -= 0.4;
    }
    if (hinted.length) score += hinted.includes(ref.case) ? -0.5 : 0.4;
    score += caseMisfit(ref.case, (hint ?? '').trim().toLowerCase());
    // Vocative and dual are rarer than the nominative/accusative that share
    // their endings.
    if (ref.case === 8) score += hint && /^o\s/i.test(hint) ? 0 : 0.3;
    if (ref.number === 1) score += 0.35;
    // The stem the splitter already settled on, when it did.
    if (preferStem && stem === preferStem) score -= 0.3;
    readings.push({
      kind: 'noun', stem, paradigm: ref.paradigm,
      // The lexicon's gender for a noun; the paradigm's for an adjective.
      gender: fixed ? (paradigmGenders.length ? paradigmGenders.filter(g => fixed.includes(g)) : fixed) : paradigmGenders,
      case: ref.case, number: ref.number, score: k.participleOf && ref.paradigm.id === 'ant-m' ? score - 0.5 : score,
      ending: ref.ending, adjective: !!k.adjective, participleOf: k.participleOf,
    });
  }

  const verbal = verbalHint(hint);
  let bestVerbEnding: VerbEnding | null = null;
  for (const v of VERB_ENDINGS) {
    if (!form.endsWith(v.ending) || form.length - v.ending.length < 1) continue;
    const presentStem = form.slice(0, -v.ending.length);
    if (!bestVerbEnding || v.ending.length > bestVerbEnding.ending.length) bestVerbEnding = v;
    const found = presentStem.length >= 1 ? findRoot(presentStem, known) : null;
    if (!found) continue;
    readings.push({
      kind: 'verb', stem: found.root, prefix: found.prefix, verb: v,
      score: verbal ? 0.6 : hinted.length ? 1.2 : 0.9,
    });
  }

  // Nothing in the dictionaries, but the ending is plain and his English
  // says what kind of word it is: read the ending alone, marked unverified.
  if (!readings.length && hint) {
    if (verbal && bestVerbEnding) {
      readings.push({ kind: 'verb', stem: '', verb: bestVerbEnding, unverified: true, score: 2 });
    } else if (!verbal) {
      for (const ref of NOUN_ENDINGS) {
        if (!FALLBACK_PARADIGMS.includes(ref.paradigm.id) || !form.endsWith(ref.ending)) continue;
        const base = form.slice(0, form.length - ref.ending.length);
        // A vocative is a last resort for known stems only, never a guess.
        if (base.length < 2 || ref.case === 8) continue;
        let score = 2 + (PARADIGM_RARITY[ref.paradigm.id] ?? 0) + (ref.number === 1 ? 0.35 : 0);
        if (hinted.length) score += hinted.includes(ref.case) ? -0.5 : 0.4;
        readings.push({
          kind: 'noun', stem: base + ref.paradigm.stemEnd, paradigm: ref.paradigm, gender: ref.paradigm.genders,
          case: ref.case, number: ref.number, unverified: true, score, ending: ref.ending,
        });
      }
    }
  }

  readings.sort((a, b) => a.score - b.score);
  return fitHint(dedupeReadings(readings), hint);
}

/**
 * Readings his English rules out are dropped, when others remain: he
 * always renders a vocative "O …", so without an "O" no word is one; and
 * when his English names the case ("in …", "by …"), readings of other cases
 * are not offered as alternatives.
 */
function fitHint(readings: GrammarReading[], hint: string | null | undefined): GrammarReading[] {
  if (!hint?.trim() || readings.length < 2) return readings;
  const keep = (pred: (r: GrammarReading) => boolean) => {
    const kept = readings.filter(pred);
    if (kept.length) readings = kept;
  };
  if (!/^o\s/i.test(hint.trim())) keep(r => r.kind !== 'noun' || r.case !== 8);
  // "all happiness", "the teachers": a thing, so no finite-verb reading.
  if (nominalHint(hint.trim().toLowerCase())) keep(r => r.kind !== 'verb' || !!r.verb?.form);
  const hinted = casesHintedBy(hint);
  if (hinted.length && readings[0].kind === 'noun' && hinted.includes(readings[0].case!)) {
    keep(r => r.kind !== 'noun' || hinted.includes(r.case!));
  }
  return readings;
}

/**
 * A word ending in a taddhita suffix written as its own member (guhya-tamam,
 * vibhūti-mat): the suffix declines like an adjective (-tama, -tara, -maya
 * like rāma / phala / latā; -mat, -vat like bhagavat) and the whole word is
 * the stem. Returns no readings when the last member is not such a suffix.
 */
export function suffixReadings(last: string, before: string, hint?: string | null): GrammarReading[] {
  const out: GrammarReading[] = [];
  const hinted = casesHintedBy(hint);
  for (const ref of NOUN_ENDINGS) {
    const id = ref.paradigm.id;
    if (!['a-m', 'a-n', 'A-f', 'at-m'].includes(id) || !last.endsWith(ref.ending)) continue;
    const suffix = last.slice(0, last.length - ref.ending.length) + ref.paradigm.stemEnd;
    const ok = id === 'at-m' ? ['mat', 'vat'].includes(suffix)
      : id === 'A-f' ? ['tamA', 'tarA', 'mayA'].includes(suffix) : ['tama', 'tara', 'maya'].includes(suffix);
    if (!ok) continue;
    let score = 1 + (ref.number === 1 ? 0.35 : 0) + (ref.case === 8 ? 0.5 : 0);
    if (hinted.length) score += hinted.includes(ref.case) ? -0.5 : 0.4;
    out.push({
      kind: 'noun', stem: before + (id === 'A-f' ? suffix.slice(0, -1) + 'a' : suffix), paradigm: ref.paradigm,
      gender: ref.paradigm.genders, case: ref.case, number: ref.number, adjective: true, ending: ref.ending, score,
    });
  }
  // The neuter -mat / -vat (śrīmat, vibhūtimat): nominative / accusative singular.
  if (last === 'mat' || last === 'vat') {
    for (const c of [1, 2] as CaseNo[]) {
      out.push({ kind: 'noun', stem: before + last, gender: ['n'], case: c, number: 0, adjective: true, ending: '', score: 1 });
    }
  }
  return fitHint(dedupeReadings(out.sort((a, b) => a.score - b.score)), hint);
}

function dedupeReadings(readings: GrammarReading[]): GrammarReading[] {
  // The same case/number from two paradigms (rāma and phala share rows 3–7;
  // hari and mati share -im) is one reading, whose gender is either.
  const byKey = new Map<string, GrammarReading>();
  const out: GrammarReading[] = [];
  for (const r of readings) {
    const k = r.kind === 'noun' ? `${r.stem}|${r.case}|${r.number}`
      : `${r.stem}|${r.prefix ?? ''}|${r.verb!.ending}|${r.verb!.tense}|${r.verb!.form ?? ''}|${r.verb!.person ?? ''}|${r.verb!.number ?? ''}`;
    const first = byKey.get(k);
    if (first) {
      if (first.gender && r.gender) first.gender = [...new Set([...first.gender, ...r.gender])];
      continue;
    }
    const copy = { ...r, gender: r.gender ? [...r.gender] : undefined };
    byKey.set(k, copy);
    out.push(copy);
  }
  return out;
}

/** A prefix as it is written before the rest of the verb: pari + upa →
 * "paryupa", pra + āp → "prāp", sam + ni → "sanni". */
function prefixSpellings(pre: string): { written: string; restStart: string }[] {
  const out = [{ written: pre, restStart: '' }];
  const last = pre[pre.length - 1];
  const head = pre.slice(0, -1);
  if (last === 'i') out.push({ written: head + 'y', restStart: '' });
  if (last === 'u') out.push({ written: head + 'v', restStart: '' });
  if (last === 'a') {
    out.push({ written: head + 'A', restStart: 'A' }, { written: head + 'A', restStart: 'a' });
    out.push({ written: head + 'e', restStart: 'i' }, { written: head + 'o', restStart: 'u' });
  }
  if (last === 'm') out.push({ written: head + 'n', restStart: '' }, { written: head + 'M', restStart: '' });
  return out;
}

/** The root of a present-participle stem: carat → √car, gacchat → √gam,
 * kurvat → √kṛ, paśyat → √dṛś (the present stem + -at). */
export function presentParticipleRoot(stem: string, known: StemKnown): { root: string; prefix?: string } | null {
  if (!/at$/.test(stem) || stem.length < 4) return null;
  const present = stem.slice(0, -2);
  return findRoot(present, known) ?? (PRESENT_STEMS[present] ? { root: PRESENT_STEMS[present] } : null);
}

function findRoot(presentStem: string, known: StemKnown, depth = 0): { root: string; prefix?: string } | null {
  const tryStem = (s: string): string | null => {
    const mapped = PRESENT_STEMS[s];
    if (mapped) return mapped;
    return known(s).root ? s : null;
  };
  // Prefix first, so "pravadanti" reads as pra + √vad, the way the grammar
  // is taught, even though Apte also lists pravad. Up to two prefixes
  // (sam-ni-yam, pari-upa-ās).
  if (depth < 2) {
    for (const pre of UPASARGAS) {
      for (const { written, restStart } of prefixSpellings(pre)) {
        if (!presentStem.startsWith(written) || presentStem.length <= written.length) continue;
        const rest = restStart + presentStem.slice(written.length);
        if (rest.length < 1) continue;
        const r = findRoot(rest, known, depth + 1);
        if (r) return { root: r.root, prefix: r.prefix ? `${pre}-${r.prefix}` : pre };
      }
    }
  }
  const bare = tryStem(presentStem);
  return bare ? { root: bare } : null;
}

/** Past-participle stems whose root doesn't show plainly (SLP1). */
const PARTICIPLE_STEMS: Record<string, string> = {
  hf: 'hf', gat: 'gam', kf: 'kf', uk: 'vac', BU: 'BU', jYA: 'jYA', yuk: 'yuj', dfz: 'dfS', Sru: 'Sru',
  sak: 'saj', sf: 'sf', mU: 'muh', mUQ: 'muh', buD: 'buD', sTi: 'sTA', hi: 'DA', ja: 'jan',
};

/**
 * A past participle (-ta / -ita / -na) taken apart into prefixes and root:
 * "apahfta" → apa + √hṛ, "prasakta" → pra + √sañj. Null when the rest is not
 * a root.
 */
export function analyseParticiple(stem: string, isRoot: (slp1: string) => boolean): { prefixes: string[]; root: string } | null {
  const tryRoot = (x: string): string | null => PARTICIPLE_STEMS[x] ?? (isRoot(x) ? x : null);
  // Prefix first (apa + √hṛ, as the grammar teaches it), then the bare root.
  const strip = (x: string, depth: number): { prefixes: string[]; root: string } | null => {
    if (depth < 2) {
      for (const pre of UPASARGAS) {
        for (const { written, restStart } of prefixSpellings(pre)) {
          if (!x.startsWith(written) || x.length <= written.length) continue;
          const inner = strip(restStart + x.slice(written.length), depth + 1);
          if (inner) return { prefixes: [pre, ...inner.prefixes], root: inner.root };
        }
      }
    }
    const r = tryRoot(x);
    return r ? { prefixes: [], root: r } : null;
  };
  // The word itself or any stem its ending allows, ending in -ta / -ita / -na.
  for (const s of [stem, ...stemCandidates(stem).map(c => c.stem)]) {
    const m = /^(.+?)(ita|ta|na)$/.exec(s);
    if (!m) continue;
    const found = strip(m[1], 0);
    if (found) return found;
  }
  return null;
}

// ── Labels ─────────────────────────────────────────────────────────────────

export interface GrammarLabel {
  /** "vāc · feminine" or "√vad with pra-". */
  stem: string;
  /** "accusative singular" / "present tense, 3rd person plural". */
  form: string;
  /** "dvitīyā · ekavacana" — the Sanskrit names. */
  sanskrit: string;
  case?: CaseNo;
}

// ── Verb analysis: upasarga + dhātu + vikaraṇa + tiṅ ending ─────────────────

/** IAST → SLP1 for the few letters that matter here (final a / ā). */
const iastToSlp1Local = (s: string) => s.replace(/ā/g, 'A');

export interface VerbAnalysis {
  /** Prefixes (upasarga), IAST: ["pra"]. */
  prefixes: string[];
  /** Root (dhātu), IAST: "vad". */
  root: string;
  /** The stem the ending is added to, IAST: "pravada". */
  stem: string;
  /** Connecting vowel / tense marker between root and ending, IAST, with
   * what it is: { text: "a", label: "vikaraṇa (connecting vowel)" }. */
  marker: { text: string; label: string } | null;
  /** The personal (tiṅ) ending as it shows, IAST: "nti". */
  tin: string;
  /** The ending as grammar books write it, when that differs: "-anti". */
  bookEnding: string | null;
  tense: string;
  person: Person;
  number: NumberNo;
  /** The whole 3 × 3 table of this verb in this tense, rows 3rd → 1st
   * person, columns singular / dual / plural (IAST); null when the pattern
   * isn't a regular one this module can build. */
  table: string[][] | null;
  /** Notes worth knowing (the -anti ending, a lengthened vowel …). */
  notes: string[];
  /** A stem that stands in for the root in this form ("paśya" for √dṛś,
   * "u-vāc" for the perfect of √vac), with why — shown in place of
   * root + connecting vowel. */
  substitute: { text: string; label: string } | null;
}

type Family = 'pres-P' | 'pres-A' | 'impv-P' | 'opt-P';

interface EndingSplit { marker: string; stemMarker: string; markerLabel: string; tin: string; family: Family | null }

/** How an ending (VERB_ENDINGS) divides into marker and personal ending. */
function splitVerbEnding(e: string, tense: string): EndingSplit {
  const atm = /ātmanepada|passive/.test(tense);
  const fut = /^i?[sz]y/.exec(e);
  if (fut) {
    const rest = e.slice(fut[0].length);
    const lengthened = rest.startsWith('A');
    const tin = rest.replace(/^[aA]/, '');
    return {
      marker: fut[0] + (lengthened ? 'A' : rest.startsWith('a') ? 'a' : ''), stemMarker: fut[0] + 'a',
      markerLabel: 'future marker (-sya-)', tin: tin || rest, family: atm ? 'pres-A' : 'pres-P',
    };
  }
  if (e === 'yate' || e === 'yante') {
    return { marker: 'ya', stemMarker: 'ya', markerLabel: 'vikaraṇa -ya- (passive or class 4)', tin: e.slice(2), family: 'pres-A' };
  }
  if (/^(nute|noti|nuvanti)$/.test(e)) {
    const m = e.startsWith('nuv') ? 'nuv' : e.slice(0, 2);
    return { marker: m, stemMarker: '', markerLabel: 'vikaraṇa -nu- (class 5)', tin: e.slice(m.length), family: null };
  }
  if (/^(et|eyuH|eH|eyam)$/.test(e)) {
    return { marker: 'e', stemMarker: 'a', markerLabel: 'stem vowel a + optative ī → e', tin: e.slice(1), family: 'opt-P' };
  }
  if (e === 'yAt') return { marker: 'yA', stemMarker: '', markerLabel: 'optative marker -yā-', tin: 't', family: null };
  if (/^[aA]/.test(e)) {
    const impv = /imperative/.test(tense);
    return {
      marker: e[0], stemMarker: 'a',
      markerLabel: e[0] === 'A' ? 'vikaraṇa a, lengthened to ā before m/v' : 'vikaraṇa a (connecting vowel)',
      tin: e.slice(1), family: impv ? 'impv-P' : atm ? 'pres-A' : 'pres-P',
    };
  }
  if (e === 'e') return { marker: '', stemMarker: 'a', markerLabel: '', tin: 'e', family: 'pres-A' };
  return { marker: '', stemMarker: '', markerLabel: '', tin: e, family: null };
}

/** Rows 3rd, 2nd, 1st person × singular, dual, plural, from a stem in -a. */
function thematicTable(T: string, family: Family): string[][] {
  const T0 = T.slice(0, -1);
  switch (family) {
    case 'pres-P': return [[T + 'ti', T + 'taH', T + 'nti'], [T + 'si', T + 'TaH', T + 'Ta'], [T0 + 'Ami', T0 + 'AvaH', T0 + 'AmaH']];
    case 'pres-A': return [[T + 'te', T0 + 'ete', T + 'nte'], [T + 'se', T0 + 'eTe', T + 'Dve'], [T0 + 'e', T0 + 'Avahe', T0 + 'Amahe']];
    case 'impv-P': return [[T + 'tu', T + 'tAm', T + 'ntu'], [T, T + 'tam', T + 'ta'], [T0 + 'Ani', T0 + 'Ava', T0 + 'Ama']];
    case 'opt-P': return [[T0 + 'et', T0 + 'etAm', T0 + 'eyuH'], [T0 + 'eH', T0 + 'etam', T0 + 'eta'], [T0 + 'eyam', T0 + 'eva', T0 + 'ema']];
  }
}

/** Common verbs whose present (or perfect) doesn't follow the -a- pattern. */
const IRREGULAR: Record<string, { tense: string; table: string[][] }> = {
  'as|present': { tense: 'present (laṭ)', table: [['asti', 'staH', 'santi'], ['asi', 'sTaH', 'sTa'], ['asmi', 'svaH', 'smaH']] },
  'kf|present': { tense: 'present (laṭ)', table: [['karoti', 'kurutaH', 'kurvanti'], ['karozi', 'kuruTaH', 'kuruTa'], ['karomi', 'kurvaH', 'kurmaH']] },
  'jYA|present': { tense: 'present (laṭ)', table: [['jAnAti', 'jAnItaH', 'jAnanti'], ['jAnAsi', 'jAnITaH', 'jAnITa'], ['jAnAmi', 'jAnIvaH', 'jAnImaH']] },
  'vid|present': { tense: 'present (laṭ)', table: [['vetti', 'vittaH', 'vidanti'], ['vetsi', 'vitTaH', 'vitTa'], ['vedmi', 'vidvaH', 'vidmaH']] },
  'yA|present': { tense: 'present (laṭ)', table: [['yAti', 'yAtaH', 'yAnti'], ['yAsi', 'yATaH', 'yATa'], ['yAmi', 'yAvaH', 'yAmaH']] },
  'Ap|present': { tense: 'present (laṭ)', table: [['Apnoti', 'ApnutaH', 'Apnuvanti'], ['Apnozi', 'ApnuTaH', 'ApnuTa'], ['ApnomI', 'ApnuvaH', 'ApnumaH']] },
  'As|present': { tense: 'present, ātmanepada (laṭ)', table: [['Aste', 'AsAte', 'Asate'], ['Asse', 'AsATe', 'ADve'], ['Ase', 'Asvahe', 'Asmahe']] },
  'BU|perfect': { tense: 'perfect (liṭ)', table: [['baBUva', 'baBUvatuH', 'baBUvuH'], ['baBUviTa', 'baBUvaTuH', 'baBUva'], ['baBUva', 'baBUviva', 'baBUvima']] },
  'gam|perfect': { tense: 'perfect (liṭ)', table: [['jagAma', 'jagmatuH', 'jagmuH'], ['jagamiTa', 'jagmaTuH', 'jagma'], ['jagAma', 'jagmiva', 'jagmima']] },
  'kf|perfect': { tense: 'perfect (liṭ)', table: [['cakAra', 'cakratuH', 'cakruH'], ['cakarTa', 'cakraTuH', 'cakra'], ['cakAra', 'cakfva', 'cakfma']] },
  'dfS|perfect': { tense: 'perfect (liṭ)', table: [['dadarSa', 'dadfSatuH', 'dadfSuH'], ['dadarSiTa', 'dadfSaTuH', 'dadfSa'], ['dadarSa', 'dadfSiva', 'dadfSima']] },
  'as|perfect': { tense: 'perfect (liṭ)', table: [['Asa', 'AsatuH', 'AsuH'], ['AsiTa', 'AsaTuH', 'Asa'], ['Asa', 'Asiva', 'Asima']] },
  'ah|perfect': { tense: 'perfect (liṭ)', table: [['Aha', 'AhatuH', 'AhuH'], ['AtTa', 'AhaTuH', '—'], ['—', '—', '—']] },
  'yuD|future': { tense: 'future, ātmanepada (lṛṭ)', table: [['yotsyate', 'yotsyete', 'yotsyante'], ['yotsyase', 'yotsyeTe', 'yotsyaDve'], ['yotsye', 'yotsyAvahe', 'yotsyAmahe']] },
  'vac|perfect': { tense: 'perfect (liṭ)', table: [['uvAca', 'UcatuH', 'UcuH'], ['uvakTa', 'UcaTuH', 'Uca'], ['uvAca', 'Uciva', 'Ucima']] },
};

const PERSON_ROW: Record<Person, number> = { 3: 0, 2: 1, 1: 2 };

/** How the perfect's reduplicated stem is made, by root (SLP1). */
const PERFECT_BUILD: Record<string, { stem: string; ending: string; how: string }> = {
  vac: { stem: 'uvAc', ending: 'a', how: 'reduplication va-vac → u-vac (samprasāraṇa in the doubled syllable), vṛddhi of the root vowel: u-vāc-, + -a' },
  BU: { stem: 'baBUv', ending: 'a', how: 'reduplication bhū → ba-bhū (the doubled bh becomes b, ū → a), + v before the vowel ending, + -a' },
  gam: { stem: 'jagAm', ending: 'a', how: 'reduplication ga-gam → ja-gam (g → j), vṛddhi: ja-gām-, + -a' },
  kf: { stem: 'cakAr', ending: 'a', how: 'reduplication ka-kṛ → ca-kṛ (k → c), vṛddhi ṛ → ār: ca-kār-, + -a' },
  dfS: { stem: 'dadarS', ending: 'a', how: 'reduplication da-dṛś, guṇa ṛ → ar: da-darś-, + -a' },
  as: { stem: 'As', ending: 'a', how: 'a-as → ās- (the doubled a merges), + -a' },
  ah: { stem: 'Ah', ending: 'a', how: 'the perfect of √ah (to say) exists only in a few forms: āh-a' },
};

/**
 * Analyse a finite verb form (SLP1) given its root, prefix and ending:
 * the parts, the full table for its tense, and notes.
 */
export function analyseVerb(form: string, root: string, prefix: string | undefined, verbEnding: VerbEnding): VerbAnalysis | null {
  let v = verbEnding;
  if (!v.person || v.number === undefined) return null;
  let person: Person = v.person;
  let num: NumberNo = v.number;
  const prefixes = prefix ? prefix.split('-') : [];
  // Written prefix as it stands in the form (pari + upa → "paryupa").
  const pre = prefixes.join('');
  const tenseKey = /perfect/.test(v.tense) ? 'perfect' : /future/.test(v.tense) ? 'future' : 'present';
  const irregular = IRREGULAR[`${root}|${tenseKey}`];
  // An irregular verb's own table settles person and number: paryupāsate is
  // pari-upa + āsate, "they worship" (3rd plural), not a 3rd singular in -ate.
  let irregularCell: [number, number] | null = null;
  if (irregular) {
    for (let ri = 0; ri < 3 && !irregularCell; ri++) {
      for (let ci = 0; ci < 3 && !irregularCell; ci++) {
        const cell = irregular.table[ri][ci];
        if (form.endsWith(cell) && form.length - cell.length <= pre.length + 1) irregularCell = [ri, ci];
      }
    }
    if (irregularCell) {
      const [ri, ci] = irregularCell;
      const cell = irregular.table[ri][ci];
      person = ([3, 2, 1] as Person[])[ri];
      num = ci as NumberNo;
      v = { ...v, ending: cell.startsWith(root) ? cell.slice(root.length) : cell, tense: irregular.tense, person, number: num };
    }
  }
  // A listed irregular form ("asti") comes without a known ending: whatever
  // follows prefix + root is the ending (as + ti).
  if (!v.ending && form.startsWith(pre + root) && form.length > (pre + root).length) {
    v = { ...v, ending: form.slice((pre + root).length) };
  }
  // A listed form this module can't take apart (an imperfect such as
  // akurvata): name it whole, with what is known, rather than invent pieces.
  if (!v.ending && !IRREGULAR[`${root}|${/perfect/.test(v.tense) ? 'perfect' : /future/.test(v.tense) ? 'future' : 'present'}`]) {
    const augment = /imperfect/.test(v.tense) && form.slice(pre.length).startsWith('a');
    return {
      prefixes: prefixes.map(slp1ToIast), root: slp1ToIast(root), stem: slp1ToIast(form), marker: null, tin: '',
      bookEnding: null, tense: v.tense, person, number: num, table: null,
      notes: augment ? ['The past-tense augment a- stands before the root (after any prefix): a-kurvata, a-bhavat.'] : [],
      substitute: { text: slp1ToIast(form.slice(pre.length)), label: `${v.tense} form of √${slp1ToIast(root)}` },
    };
  }
  // An irregular form's ending follows the root directly (ās + ate), with no
  // connecting vowel to split off.
  const sp: EndingSplit = irregularCell
    ? { marker: '', stemMarker: '', markerLabel: '', tin: v.ending, family: null }
    : splitVerbEnding(v.ending, v.tense);
  const before = form.slice(0, form.length - v.ending.length); // prefix + root part
  const stem = before + sp.marker;
  const notes: string[] = [];
  let table: string[][] | null = null;
  let tense = v.tense;

  if (irregular && (irregularCell || tenseKey !== 'present' || !/imperative|optative|passive|benedictive/.test(v.tense))) {
    // The written prefix: whatever precedes the table's form in this word.
    const cellForm = irregularCell ? irregular.table[irregularCell[0]][irregularCell[1]] : null;
    const writtenPre = cellForm && form.endsWith(cellForm) ? form.slice(0, form.length - cellForm.length) : pre;
    table = irregular.table.map(row => row.map(c => writtenPre + c));
    tense = irregular.tense;
    if (tenseKey === 'present') notes.push(`√${slp1ToIast(root)} doesn't take the connecting -a-; its forms are learnt as they are.`);
  } else if (sp.family && sp.stemMarker) {
    table = thematicTable(before + sp.stemMarker, sp.family);
  }

  if (v.ending === 'anti' || v.ending.endsWith('anti')) {
    notes.push('Grammar books write this ending as -anti ("they"): the stem\'s -a- and the ending\'s a- merge, so only -nti shows. (Pāṇini: jhi → anti, rule 7.1.3.)');
  }
  // Only when it is true here: a thematic a lengthened before m / v (vadā-mi).
  if (sp.marker === 'A' && /^[mv]/.test(sp.tin)) {
    notes.push('The stem\'s a is lengthened to ā before an ending that starts with m or v (vadā-mi).');
  }
  // The root as it is written here, when it differs from the root.
  const writtenRoot = before.startsWith(pre) ? before.slice(pre.length) : before;
  let substitute: VerbAnalysis['substitute'] = null;
  const perfect = tenseKey === 'perfect' ? PERFECT_BUILD[root] : undefined;
  let futureParts: { stem: string; marker: string; tin: string } | null = null;
  if (perfect && form.endsWith(perfect.stem + perfect.ending)) {
    substitute = { text: slp1ToIast(perfect.stem), label: `reduplicated perfect stem — ${perfect.how}` };
  } else if (tenseKey === 'future' && irregularCell) {
    // yotsye = yot- (√yudh: guṇa, dh → t before s) + -sya- + -e (sya + e → sye)
    const cell = irregular!.table[irregularCell[0]][irregularCell[1]];
    const m = /^(.*?)(i?[sz]y)(.*)$/.exec(cell);
    if (m) {
      futureParts = { stem: m[1], marker: m[2] + 'a', tin: m[3].replace(/^[aA]/, '') || m[3] };
      substitute = {
        text: slp1ToIast(m[1]),
        label: STEM_NOTES[m[1]] ? `${STEM_NOTES[m[1]]} — the root as written before -sya-` : 'the root as written before -sya-',
      };
    }
  } else if (writtenRoot && writtenRoot !== root && !irregularCell) {
    const note = STEM_NOTES[writtenRoot];
    if (note) {
      // A present-stem substitute includes the connecting vowel: paśya-.
      const text = /^(paSy|gacC|tizW|jiGr|pib|yacC|Bav)$/.test(writtenRoot) ? writtenRoot + 'a' : writtenRoot;
      substitute = { text: slp1ToIast(text), label: note };
    } else {
      notes.push(`√${slp1ToIast(root)} is written ${slp1ToIast(writtenRoot)}- here.`);
    }
  }

  return {
    prefixes: prefixes.map(slp1ToIast),
    root: slp1ToIast(root),
    stem: slp1ToIast(sp.stemMarker ? before + sp.stemMarker : stem),
    marker: futureParts
      ? { text: slp1ToIast(futureParts.marker), label: `future marker -sya- (its a merges with the ending: sya + e → sye)` }
      // A present-stem substitute (paśya-) already contains the connecting vowel.
      : substitute && !perfect && /a$/.test(iastToSlp1Local(substitute.text)) ? null
        : sp.marker && sp.markerLabel ? { text: slp1ToIast(sp.marker), label: sp.markerLabel } : null,
    // The perfect's own ending (-a), the future's (-e), not the whole form.
    tin: slp1ToIast(perfect && substitute ? perfect.ending : futureParts ? futureParts.tin : sp.tin),
    bookEnding: v.ending === 'anti' ? '-anti' : null,
    tense,
    person,
    number: num,
    table: table?.map(r => r.map(c => (c === '—' ? '—' : slp1ToIast(c)))) ?? null,
    notes,
    substitute,
  };
}

/** The VERB_ENDINGS entry a listed verb form takes, from its person and
 * number (for verbs in the particle list: "bhavati", "vadanti"). */
export function verbEndingFor(form: string, person: Person, num: NumberNo, perfect = false): VerbEnding | null {
  if (perfect) return { ending: '', tense: 'perfect (liṭ)', person, number: num };
  const fits = VERB_ENDINGS.filter(v => v.person === person && v.number === num && form.endsWith(v.ending))
    .sort((a, b) => b.ending.length - a.ending.length);
  return fits.find(v => !/future/.test(v.tense)) ?? fits[0] ?? { ending: '', tense: 'present (laṭ)', person, number: num };
}

export { PERSON_ROW };

// ── Derivation: how the dictionary form became the written word ─────────────

export interface Derivation {
  /** The form it comes from, IAST: "idam", "puṣpita", "√vad". */
  base: string;
  /** SLP1 key to look the base's meaning up by (stem or root). */
  baseKey: string;
  kind: 'noun' | 'verb' | 'pronoun';
  /** Steps in order, e.g. "yad → feminine stem yā-",
   * "yā- + -m (accusative singular) = yām — like ramā → ramām". */
  steps: string[];
}

const iast = (slp: string) => slp1ToIast(slp);

/** "-m (accusative singular) = yām — like ramā → ramām" for a paradigm cell. */
function endingStep(stemSlp: string, paradigm: Paradigm, caseNo: CaseNo, num: NumberNo, form: string): string {
  const base = paradigm.stemEnd && stemSlp.endsWith(paradigm.stemEnd) ? stemSlp.slice(0, -paradigm.stemEnd.length) : stemSlp;
  const ending = form.startsWith(base) ? form.slice(base.length) : '';
  const label = `${CASES[caseNo - 1].english} ${NUMBERS[num].english}`;
  const model = paradigm.forms[caseNo - 1][num].split('/')[0];
  const like = model !== form ? ` — like ${paradigm.model} → ${iast(model)}` : '';
  if (!ending) return `${iast(stemSlp)} → ${iast(form)} (${label})${like}`;
  // "yā- + -m" when the stem's final letter stays; "rāma-: -a → -eṇa" when it changes.
  const keep = paradigm.stemEnd && ending.startsWith(paradigm.stemEnd);
  const how = keep
    ? `${iast(stemSlp)}- + -${iast(ending.slice(paradigm.stemEnd.length)) || '∅'}`
    : paradigm.stemEnd ? `${iast(stemSlp)}-: final -${iast(paradigm.stemEnd)} → -${iast(ending)}` : `${iast(stemSlp)}- + -${iast(ending)}`;
  return `${how} (${label}) = ${iast(form)}${like}`;
}

/** Derivation of a reading of `form` (SLP1), or null when there is nothing
 * to show (an unverified verb, a bare compound member). */
export function deriveReading(r: GrammarReading, form: string): Derivation | null {
  // A form-lexicon (Vidyut) reading: its derivation's own morphemes.
  if (r.lex?.kind === 'verb') {
    return {
      base: `√${iast(r.lex.root)}`, baseKey: r.lex.root, kind: 'verb',
      steps: [`${r.lex.morphemes.map(iast).join(' + ')} = ${iast(form)}`],
    };
  }
  if (r.lex?.kind === 'noun' && r.lex.krt && r.lex.root && ['ktvA', 'lyap', 'tumun', 'Ramul'].includes(r.lex.krt)) {
    const pre = r.lex.prefixes.length ? `${r.lex.prefixes.map(iast).join('- + ')}- + ` : '';
    const suffix = r.lex.krt === 'tumun' ? '-tum' : r.lex.prefixes.length ? '-ya (lyap for ktvā, 7.1.37)' : '-tvā';
    return { base: `√${iast(r.lex.root)}`, baseKey: r.lex.root, kind: 'verb', steps: [`${pre}√${iast(r.lex.root)} + ${suffix} = ${iast(form)}`] };
  }
  if (r.lex?.kind === 'noun' && r.lex.krt && r.lex.root) {
    const pre = r.lex.prefixes.length ? `${r.lex.prefixes.map(iast).join('- + ')}- + ` : '';
    return {
      base: `√${iast(r.lex.root)}`, baseKey: r.lex.root, kind: 'verb',
      steps: [`${pre}√${iast(r.lex.root)} → ${iast(r.stem)} (${krtLabel(r.lex)?.split(' of ')[0] ?? r.lex.krt})`,
        ...(r.case ? [`${iast(r.stem)} → ${iast(form)} (${CASES[r.case - 1].english} ${NUMBERS[r.number ?? 0].english})`] : [])],
    };
  }
  if (r.kind === 'verb') {
    if (r.unverified || !r.stem) return null;
    const v = r.verb!;
    const prefixes = r.prefix ? r.prefix.split('-').map(p => `${iast(p)}-`).join(' + ') + ' + ' : '';
    const what = v.form ?? `${v.tense}, ${PERSONS[v.person!].english} ${NUMBERS[v.number!].english}`;
    const steps = [`${prefixes}√${iast(r.stem)} + -${iast(v.ending)} (${what}) = ${iast(form)}`];
    // The root as written in this form (uk- in uktvā), when a note explains it.
    const pre = (r.prefix ?? '').split('-').join('');
    const written = form.slice(pre.length, form.length - v.ending.length);
    if (written && written !== r.stem && STEM_NOTES[written]) steps.push(`${iast(written)}-: ${STEM_NOTES[written]}`);
    return { base: `√${iast(r.stem)}`, baseKey: r.stem, kind: 'verb', steps };
  }
  if (!r.paradigm || !r.case || r.number === undefined) return null;
  const steps: string[] = [];
  let stem = r.stem;
  // An adjective listed in -a takes the feminine in -ā / -ī (puṣpita → puṣpitā).
  const femFromA = (r.paradigm.id === 'A-f' || r.paradigm.id === 'I-f') && stem.endsWith('a');
  if (femFromA) {
    const fem = stem.slice(0, -1) + r.paradigm.stemEnd;
    steps.push(`${iast(stem)} → feminine ${iast(fem)}`);
    stem = fem;
  }
  steps.push(endingStep(stem, r.paradigm, r.case, r.number, form));
  return { base: iast(r.stem), baseKey: r.stem, kind: 'noun', steps };
}

/**
 * Derivation of a pronoun form from its stem ("yām" ← yad): the pronoun's
 * gender stem, then the ending — compared with rāma / ramā / phala where the
 * pronoun takes the same ending, and called a pronominal ending where it
 * doesn't (tasmin, teṣām).
 */
export function derivePronoun(
  pronoun: string, stems: { m?: string; f?: string; n?: string }, gender: Gender | null,
  caseNo: CaseNo | null, num: NumberNo | null, form: string,
): Derivation {
  const steps: string[] = [];
  const g = gender ?? 'm';
  const gStem = stems[g];
  if (gStem && caseNo && num !== null) {
    steps.push(`${pronoun} → ${GENDERS[g].english} stem ${iast(gStem)}-`);
    const paradigm = PARADIGMS.find(p => p.id === (g === 'f' ? 'A-f' : g === 'n' ? 'a-n' : 'a-m'))!;
    const base = gStem.slice(0, -1);
    const cell = paradigm.forms[caseNo - 1][num].split('/')[0];
    const modelEnding = cell.slice(paradigm.base.length);
    const label = `${CASES[caseNo - 1].english} ${NUMBERS[num].english}`;
    if (base + modelEnding === form) {
      steps.push(endingStep(gStem, paradigm, caseNo, num, form));
    } else {
      steps.push(`${iast(gStem)}- → ${iast(form)} (${label}) — a pronoun's own ending, not rāma's`);
    }
  } else {
    steps.push(`${pronoun} → ${iast(form)}`);
  }
  return { base: pronoun, baseKey: '', kind: 'pronoun', steps };
}

export function labelReading(r: GrammarReading): GrammarLabel {
  if (r.kind === 'verb') {
    const v = r.verb!;
    const root = r.unverified
      ? 'verb (root not in the dictionary)'
      : `√${slp1ToIast(r.stem)}${r.prefix ? ` with ${r.prefix.split('-').map(slp1ToIast).join('- + ')}-` : ''}`;
    if (v.form) return { stem: root, form: v.form, sanskrit: '' };
    return {
      stem: root,
      form: `${v.tense}, ${PERSONS[v.person!].english} ${NUMBERS[v.number!].english}`,
      sanskrit: `${PERSONS[v.person!].sanskrit} · ${NUMBERS[v.number!].sanskrit}`,
    };
  }
  const c = CASES[r.case! - 1];
  const genders = r.paradigm?.id === 'cons'
    ? 'consonant stem'
    : (r.gender ?? []).map(g => GENDERS[g].english).join(' / ');
  const derived = krtLabel(r.lex);
  return {
    stem: `${slp1ToIast(r.stem)}${r.unverified ? ' (stem not in the dictionary)' : ''}${derived ? ` (${derived})` : r.participleOf ? ` (present participle of √${slp1ToIast(r.participleOf)})` : r.adjective ? ' (adjective)' : ''}${genders ? ` · ${genders}` : ''}`,
    form: `${c.english} ${NUMBERS[r.number!].english}`,
    sanskrit: `${c.sanskrit} · ${NUMBERS[r.number!].sanskrit}`,
    case: r.case,
  };
}

/** A paradigm's forms in IAST, for the guide. */
export function paradigmTable(p: Paradigm): string[][] {
  return p.forms.map(row => row.map(cell => cell.split('/').map(slp1ToIast).join(' / ')));
}
