/**
 * Indeclinables, pronoun forms and the commonest verb forms of the verses
 * Prabhupāda lectures on, with the English he regularly gives them in his
 * word-for-word ("ca — and", "eva — certainly", "uvāca — said").
 *
 * The sandhi splitter needs these because they are what most fused words are
 * made of (caiva = ca + eva, tathaiva = tathā + eva), and because Apte's first
 * sense for them is useless here (it gives "ca" as "seedless, vile"). Short
 * pieces (one or two letters) are only accepted from this list, which keeps
 * the splitter from inventing words like "na" + "ra".
 *
 * Several readings are listed where the word regularly has them ("te": they /
 * your); the verse's own word-for-word, when available, always wins.
 */

export interface Particle {
  word: string;
  meaning: string;
  /** "yad · feminine accusative singular", "√as · present, 3rd person
   * singular", or "indeclinable (avyaya)". */
  grammar: string;
}

const LIST: [word: string, meaning: string][] = [
  ['ca', 'and'], ['eva', 'certainly'], ['hi', 'certainly'], ['api', 'also; even'],
  ['iti', 'thus'], ['na', 'not'], ['tu', 'but'], ['vā', 'or'], ['iva', 'like'],
  ['atha', 'thereafter'], ['tathā', 'also; so'], ['yathā', 'as'], ['evam', 'thus'],
  ['nu', 'indeed'], ['khalu', 'indeed'], ['vai', 'certainly'], ['ha', 'certainly'],
  ['sma', 'certainly (in the past)'], ['kila', 'certainly'], ['aho', 'alas'], ['he', 'O'], ['bho', 'O'],
  ['iha', 'in this world'], ['atra', 'here'], ['tatra', 'there'], ['yatra', 'where'],
  ['sarvatra', 'everywhere'], ['kva', 'where'], ['adya', 'today'], ['punaḥ', 'again'],
  ['ataḥ', 'therefore'], ['tataḥ', 'thereafter'], ['tasmāt', 'therefore'], ['yataḥ', 'from whom'],
  ['kutaḥ', 'wherefrom'], ['yadi', 'if'], ['yadā', 'whenever'], ['tadā', 'at that time'],
  ['sadā', 'always'], ['katham', 'how'], ['kim', 'what'], ['kiñcit', 'anything'],
  ['kaścit', 'someone'], ['prati', 'towards'], ['saha', 'with'], ['vinā', 'without'], ['ati', 'very'],
  ['sārdham', 'together with'], ['namaḥ', 'obeisances'], ['svasti', 'auspiciousness'], ['svāhā', 'offering'],
  ['ṛte', 'without, except'], ['upari', 'above'], ['adhaḥ', 'below'],
  ['purā', 'formerly'], ['sarvaśaḥ', 'in all respects'], ['om', 'oṁ, the transcendental sound'],
  ['oṁ', 'oṁ, the transcendental sound'], ['cet', 'if'], ['yāvat', 'as long as, as much as'],
  ['tāvat', 'so long, so much'], ['samyak', 'completely, properly'], ['anyathā', 'otherwise'],
  ['sarvathā', 'in every way'], ['bhūyaḥ', 'again, further'], ['antaḥ', 'within'], ['antar', 'within'],
  ['itaḥ', 'from here, from this'], ['svataḥ', 'by itself'], ['nityam', 'always'],
  ['sahasā', 'suddenly'], ['śanaiḥ', 'gradually'], ['tūrṇam', 'quickly'], ['sākṣāt', 'directly'],
  ['uccaiḥ', 'loudly'], ['bahiḥ', 'outside'], ['puraḥ', 'in front'], ['paścāt', 'afterwards, behind'],
  ['pṛthak', 'separately'], ['mithaḥ', 'mutually'], ['alam', 'enough'], ['īṣat', 'slightly'],
  ['kadā', 'when'], ['kadācit', 'at any time'], ['kvacit', 'sometimes, somewhere'], ['sarvadā', 'always'],
  ['ekadā', 'once'], ['anyatra', 'elsewhere'], ['ubhayataḥ', 'on both sides'], ['samantataḥ', 'on all sides'],
  // Pronouns.
  ['aham', 'I'], ['mām', 'unto Me'], ['mama', 'My'], ['me', 'My; to Me'], ['mayā', 'by Me'],
  ['mayi', 'in Me'], ['mat', 'My'], ['tvam', 'you'], ['tvām', 'unto you'], ['tava', 'your'],
  ['te', 'they; your'], ['tvayā', 'by you'], ['naḥ', 'us; our'], ['vaḥ', 'your'], ['vayam', 'we'],
  ['saḥ', 'he'], ['sā', 'she'], ['tat', 'that'], ['tam', 'him'], ['tām', 'her'], ['tena', 'by him'],
  ['tayā', 'by that'], ['tasyāḥ', 'of her'], ['tasyām', 'in her'], ['tāḥ', 'they (women)'], ['tābhiḥ', 'by them'],
  ['tāsām', 'of them'], ['teṣu', 'in them'], ['taiḥ', 'by them'], ['tebhyaḥ', 'to them'],
  ['yayā', 'by which'], ['yasyāḥ', 'of whom'], ['yasyām', 'in which'], ['yaiḥ', 'by whom'],
  ['tasya', 'his'], ['tasmin', 'in that'], ['tāni', 'those'], ['teṣām', 'of them'], ['tān', 'them'],
  ['yaḥ', 'anyone who'], ['yā', 'which'], ['yat', 'that which'], ['yam', 'whom'], ['yena', 'by which'],
  ['yasya', 'whose'], ['yasmin', 'in which'], ['ye', 'those who'], ['yeṣām', 'of whom'],
  ['ayam', 'this'], ['iyam', 'this'], ['idam', 'this'], ['asya', 'of this'], ['asmin', 'in this'],
  ['etat', 'this'], ['etam', 'this'], ['eṣaḥ', 'this'], ['etān', 'all these'], ['ime', 'these'],
  ['sarvam', 'all'], ['sarve', 'all'], ['sarvān', 'all'], ['sarveṣām', 'of all'],
  ['yām', 'which'], ['imām', 'this'], ['anyat', 'anything else'],
  ['anena', 'by this'], ['ebhiḥ', 'by these'], ['eṣām', 'of these'], ['asmāt', 'from this'],
  ['pañca', 'five'], ['ṣaṭ', 'six'], ['sapta', 'seven'], ['aṣṭau', 'eight'], ['nava', 'nine'], ['daśa', 'ten'],
  ['sarvāḥ', 'all'], ['sarvāṇi', 'all'], ['sarvasya', 'of all'],
  ['sarvā', 'all'], ['sarvām', 'all'], ['sarvābhiḥ', 'by all'],
  ['kā', 'what, who'], ['kām', 'whom'], ['kasya', 'whose'], ['kena', 'by what'], ['kasmin', 'in what'], ['ke', 'who'],
  ['etāni', 'all these'], ['etaiḥ', 'by these'], ['etāḥ', 'these'], ['etasya', 'of this'], ['etena', 'by this'],
  ['etasmin', 'in this'], ['etau', 'these two'], ['eṣā', 'this'], ['ete', 'these'],
  ['tubhyam', 'to you'], ['mahyam', 'to Me'], ['tvayi', 'in you'], ['yuṣmākam', 'your'], ['asmākam', 'our'],
  ['yūyam', 'you all'], ['āvām', 'we two'], ['yuvām', 'you two'], ['asau', 'that'], ['amum', 'that'],
  ['amuṣya', 'of that'], ['amuṣmin', 'in that'], ['ebhyaḥ', 'to these'], ['eṣu', 'in these'], ['ayam', 'this'],
  ['ekasmin', 'in one'], ['ekena', 'by one'], ['ekaḥ', 'one'], ['anye', 'others'], ['anyaiḥ', 'by others'],
  ['sarveṣu', 'in all'], ['sarvasmin', 'in all'], ['sarvaiḥ', 'by all'],
  // Verb forms.
  ['uvāca', 'said'], ['ūcuḥ', 'said'], ['babhūva', 'became'], ['babhūvuḥ', 'became'], ['āhuḥ', 'say'],
  ['jagāma', 'went'], ['jagmuḥ', 'went'], ['cakāra', 'did'], ['cakruḥ', 'did'], ['dadarśa', 'saw'],
  ['dadṛśuḥ', 'saw'], ['āsa', 'was'], ['āsuḥ', 'were'], ['yotsye', 'I shall fight'], ['tūṣṇīm', 'silently'],
  ['āha', 'said'], ['akurvata', 'did (they) do'], ['akarot', 'did'], ['abravīt', 'said'], ['apaśyat', 'saw'],
  ['avadat', 'said'], ['agacchat', 'went'], ['āsan', 'were'], ['abhavan', 'became'], ['asti', 'there is'], ['santi', 'there are'], ['asmi', 'I am'],
  ['asi', 'you are'], ['bhavati', 'becomes'], ['bhavanti', 'become'], ['abhavat', 'became'],
  ['syāt', 'it may be'], ['bhavet', 'it becomes'], ['āsīt', 'there was'],
  ['karoti', 'does'], ['kurvanti', 'do'], ['kuru', 'do'], ['jānāti', 'knows'], ['abhijānāti', 'knows'],
  ['vetti', 'knows'], ['viddhi', 'know it'], ['paśyati', 'sees'], ['paśyanti', 'see'],
  ['gacchati', 'goes'], ['yānti', 'go'], ['yāti', 'goes'], ['āpnoti', 'achieves'], ['labhate', 'achieves'],
  ['muhyati', 'is deluded'], ['manyate', 'thinks'], ['vadanti', 'say'], ['prāhuḥ', 'said'],
  ['bhajanti', 'render service'], ['bhajate', 'renders service'], ['prapadyante', 'surrender'],
  ['prapadyate', 'surrenders'], ['śṛṇu', 'just hear'], ['nāsti', 'there is not'],
  // Compound prefixes: first members that fuse into almost every compound.
  ['mahā', 'great'], ['su', 'very; good'], ['dur', 'difficult; bad'], ['duṣ', 'difficult; bad'],
  ['nir', 'without'], ['niḥ', 'without'], ['sat', 'eternal'], ['cit', 'knowledge'],
];

const IND = 'indeclinable (avyaya)';

/** Grammar of the declined and conjugated words above; anything not listed
 * is an indeclinable. */
const GRAMMAR: Record<string, string> = {
  aham: 'asmad (I) · nominative singular', mām: 'asmad · accusative singular',
  mama: 'asmad · genitive singular', me: 'asmad · genitive or dative singular',
  mayā: 'asmad · instrumental singular', mayi: 'asmad · locative singular',
  mat: 'asmad · as a compound member', vayam: 'asmad · nominative plural',
  naḥ: 'asmad · accusative, dative or genitive plural',
  tvam: 'yuṣmad (you) · nominative singular', tvām: 'yuṣmad · accusative singular',
  tava: 'yuṣmad · genitive singular', tvayā: 'yuṣmad · instrumental singular',
  vaḥ: 'yuṣmad · accusative, dative or genitive plural',
  te: 'tad · masculine nominative plural, or yuṣmad · genitive/dative singular',
  saḥ: 'tad · masculine nominative singular', sā: 'tad · feminine nominative singular',
  tat: 'tad · neuter nominative/accusative singular', tam: 'tad · masculine accusative singular',
  tām: 'tad · feminine accusative singular', tena: 'tad · masculine/neuter instrumental singular',
  tasya: 'tad · masculine/neuter genitive singular', tasmin: 'tad · masculine/neuter locative singular',
  tāni: 'tad · neuter nominative/accusative plural', teṣām: 'tad · genitive plural',
  tān: 'tad · masculine accusative plural',
  tayā: 'tad · feminine instrumental singular', tasyāḥ: 'tad · feminine genitive singular',
  tasyām: 'tad · feminine locative singular', tāḥ: 'tad · feminine nominative plural',
  tābhiḥ: 'tad · feminine instrumental plural', tāsām: 'tad · feminine genitive plural',
  teṣu: 'tad · masculine locative plural', taiḥ: 'tad · masculine instrumental plural',
  tebhyaḥ: 'tad · masculine dative plural',
  yayā: 'yad · feminine instrumental singular', yasyāḥ: 'yad · feminine genitive singular',
  yasyām: 'yad · feminine locative singular', yaiḥ: 'yad · masculine instrumental plural',
  yaḥ: 'yad · masculine nominative singular', yā: 'yad · feminine nominative singular',
  yām: 'yad · feminine accusative singular', yat: 'yad · neuter nominative/accusative singular',
  yam: 'yad · masculine accusative singular', yena: 'yad · masculine/neuter instrumental singular',
  yasya: 'yad · masculine/neuter genitive singular', yasmin: 'yad · masculine/neuter locative singular',
  ye: 'yad · masculine nominative plural', yeṣām: 'yad · genitive plural',
  ayam: 'idam · masculine nominative singular', iyam: 'idam · feminine nominative singular',
  idam: 'idam · neuter nominative/accusative singular', imām: 'idam · feminine accusative singular',
  asya: 'idam · masculine/neuter genitive singular', asmin: 'idam · masculine/neuter locative singular',
  ime: 'idam · masculine nominative plural',
  etat: 'etad · neuter nominative/accusative singular', etam: 'etad · masculine accusative singular',
  eṣaḥ: 'etad · masculine nominative singular', etān: 'etad · masculine accusative plural',
  sarvam: 'sarva · neuter nominative/accusative singular', sarve: 'sarva · masculine nominative plural',
  sarvān: 'sarva · masculine accusative plural', sarveṣām: 'sarva · genitive plural',
  anyat: 'anya · neuter nominative/accusative singular',
  anena: 'idam · masculine/neuter instrumental singular', ebhiḥ: 'idam · masculine/neuter instrumental plural', eṣām: 'idam · genitive plural',
  pañca: 'pañcan · nominative/accusative (a numeral: the same in all genders)', ṣaṭ: 'ṣaṣ · nominative/accusative (numeral)',
  sapta: 'saptan · nominative/accusative (numeral)', aṣṭau: 'aṣṭan · nominative/accusative (numeral)',
  nava: 'navan · nominative/accusative (numeral)', daśa: 'daśan · nominative/accusative (numeral)',
  sarvāḥ: 'sarva · feminine nominative/accusative plural', sarvāṇi: 'sarva · neuter nominative/accusative plural',
  sarvasya: 'sarva · masculine/neuter genitive singular',
  sarvā: 'sarva · feminine nominative singular', sarvām: 'sarva · feminine accusative singular', sarvābhiḥ: 'sarva · feminine instrumental plural',
  kā: 'kim · feminine nominative singular', kām: 'kim · feminine accusative singular', kasya: 'kim · masculine/neuter genitive singular',
  kena: 'kim · masculine/neuter instrumental singular', kasmin: 'kim · masculine/neuter locative singular', ke: 'kim · masculine nominative plural',
  etāni: 'etad · neuter nominative/accusative plural', etaiḥ: 'etad · masculine/neuter instrumental plural', etāḥ: 'etad · feminine nominative/accusative plural',
  etasya: 'etad · masculine/neuter genitive singular', etena: 'etad · masculine/neuter instrumental singular', etasmin: 'etad · masculine/neuter locative singular',
  etau: 'etad · masculine nominative/accusative dual', eṣā: 'etad · feminine nominative singular', ete: 'etad · masculine nominative plural',
  tubhyam: 'yuṣmad · dative singular', mahyam: 'asmad · dative singular', tvayi: 'yuṣmad · locative singular',
  yuṣmākam: 'yuṣmad · genitive plural', asmākam: 'asmad · genitive plural', yūyam: 'yuṣmad · nominative plural',
  āvām: 'asmad · nominative/accusative dual', yuvām: 'yuṣmad · nominative/accusative dual', asau: 'adas · masculine/feminine nominative singular',
  amum: 'adas · masculine accusative singular', amuṣya: 'adas · masculine/neuter genitive singular', amuṣmin: 'adas · masculine/neuter locative singular',
  ebhyaḥ: 'idam · masculine/neuter dative/ablative plural', eṣu: 'idam · masculine/neuter locative plural',
  ekasmin: 'eka · masculine/neuter locative singular', ekena: 'eka · masculine/neuter instrumental singular', ekaḥ: 'eka · masculine nominative singular',
  anye: 'anya · masculine nominative plural', anyaiḥ: 'anya · masculine/neuter instrumental plural',
  sarveṣu: 'sarva · masculine/neuter locative plural', sarvasmin: 'sarva · masculine/neuter locative singular', sarvaiḥ: 'sarva · masculine/neuter instrumental plural',
  asmāt: 'idam · ablative singular',
  kaścit: 'kim + cit · masculine nominative singular', kiñcit: 'kim + cit · neuter nominative/accusative singular',
  kim: 'kim · neuter nominative/accusative singular',
  uvāca: '√vac · perfect (liṭ), 3rd person singular', ūcuḥ: '√vac · perfect (liṭ), 3rd person plural',
  babhūva: '√bhū · perfect (liṭ), 3rd person singular', babhūvuḥ: '√bhū · perfect (liṭ), 3rd person plural',
  āhuḥ: '√ah · perfect (liṭ), 3rd person plural', jagāma: '√gam · perfect (liṭ), 3rd person singular',
  jagmuḥ: '√gam · perfect (liṭ), 3rd person plural', cakāra: '√kṛ · perfect (liṭ), 3rd person singular',
  cakruḥ: '√kṛ · perfect (liṭ), 3rd person plural', dadarśa: '√dṛś · perfect (liṭ), 3rd person singular',
  dadṛśuḥ: '√dṛś · perfect (liṭ), 3rd person plural', āsa: '√as · perfect (liṭ), 3rd person singular',
  āsuḥ: '√as · perfect (liṭ), 3rd person plural',
  yotsye: '√yudh · future, ātmanepada (lṛṭ), 1st person singular',
  akurvata: '√kṛ · imperfect (laṅ), ātmanepada, 3rd person plural', akarot: '√kṛ · imperfect (laṅ), 3rd person singular',
  abravīt: '√brū · imperfect (laṅ), 3rd person singular', apaśyat: '√dṛś · imperfect (laṅ), 3rd person singular',
  avadat: '√vad · imperfect (laṅ), 3rd person singular', agacchat: '√gam · imperfect (laṅ), 3rd person singular',
  āsan: '√as · imperfect (laṅ), 3rd person plural', abhavan: '√bhū · imperfect (laṅ), 3rd person plural', āha: '√ah · perfect (liṭ), 3rd person singular',
  asti: '√as · present (laṭ), 3rd person singular', santi: '√as · present (laṭ), 3rd person plural',
  asmi: '√as · present (laṭ), 1st person singular', asi: '√as · present (laṭ), 2nd person singular',
  bhavati: '√bhū · present (laṭ), 3rd person singular', bhavanti: '√bhū · present (laṭ), 3rd person plural',
  abhavat: '√bhū · imperfect (laṅ), 3rd person singular', āsīt: '√as · imperfect (laṅ), 3rd person singular',
  syāt: '√as · optative (vidhi-liṅ), 3rd person singular', bhavet: '√bhū · optative (vidhi-liṅ), 3rd person singular',
  karoti: '√kṛ · present (laṭ), 3rd person singular', kurvanti: '√kṛ · present (laṭ), 3rd person plural',
  kuru: '√kṛ · imperative (loṭ), 2nd person singular',
  jānāti: '√jñā · present (laṭ), 3rd person singular', abhijānāti: '√jñā with abhi- · present (laṭ), 3rd person singular',
  vetti: '√vid · present (laṭ), 3rd person singular', viddhi: '√vid · imperative (loṭ), 2nd person singular',
  paśyati: '√dṛś · present (laṭ), 3rd person singular', paśyanti: '√dṛś · present (laṭ), 3rd person plural',
  gacchati: '√gam · present (laṭ), 3rd person singular', yānti: '√yā · present (laṭ), 3rd person plural',
  yāti: '√yā · present (laṭ), 3rd person singular', āpnoti: '√āp · present (laṭ), 3rd person singular',
  labhate: '√labh · present, ātmanepada (laṭ), 3rd person singular',
  muhyati: '√muh · present (laṭ), 3rd person singular', manyate: '√man · present, ātmanepada (laṭ), 3rd person singular',
  vadanti: '√vad · present (laṭ), 3rd person plural', prāhuḥ: '√ah with pra- · perfect (liṭ), 3rd person plural',
  bhajanti: '√bhaj · present (laṭ), 3rd person plural', bhajate: '√bhaj · present, ātmanepada (laṭ), 3rd person singular',
  prapadyante: '√pad with pra- · present, ātmanepada (laṭ), 3rd person plural',
  prapadyate: '√pad with pra- · present, ātmanepada (laṭ), 3rd person singular',
  śṛṇu: '√śru · imperative (loṭ), 2nd person singular', nāsti: 'na + asti (√as · present, 3rd person singular)',
  mahā: 'mahat (great), as a compound member', sat: 'sat, as a compound member', cit: 'cit, as a compound member',
  su: 'prefix', dur: 'prefix', duṣ: 'prefix', nir: 'prefix', niḥ: 'prefix',
};

function key(s: string): string {
  return s.normalize('NFC').toLowerCase();
}

const MAP = new Map<string, Particle>();
for (const [word, meaning] of LIST) MAP.set(key(word), { word, meaning, grammar: GRAMMAR[word] ?? IND });

/** Exact IAST spelling (any case). */
export function lookupParticle(iast: string): Particle | null {
  return MAP.get(key(iast)) ?? null;
}

export function allParticles(): Particle[] {
  return [...MAP.values()];
}
