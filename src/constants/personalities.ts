/**
 * Less familiar personalities named in Śrīla Prabhupāda's books — sages,
 * kings, devotees, demons and ācāryas — with a short note for the tap-to-
 * preview card on the verse screen.
 *
 * Deliberately left out: the Lord and His most familiar forms and names
 * (Kṛṣṇa, Rāma, Viṣṇu, Nārāyaṇa, Caitanya, Nityānanda, Balarāma…), and the
 * names every reader already knows (Arjuna, Brahmā, Śiva, Rādhārāṇī, Sītā,
 * Hanumān, Nanda, Yaśodā, Indra, Prabhupāda). Linking those on every page
 * would be noise.
 *
 * `names` is a regex source over text with diacritics folded and lower-cased
 * (see `fold` in services/purport/citations.ts): ā → a, ś → s, ṛ → r, ṁ → m.
 * A match must also start with a capital letter in the original text, so
 * ordinary words that fold to the same letters (bhīma "fearful", sāgara
 * "ocean") are not linked. `read` points to the chapters where the
 * personality's story is told in the library.

 * Only what Śrīla Prabhupāda and the previous ācāryas say about a person is
 * written here, in short; `read` names where it is told so the reader can
 * check it in his own words.
 */

export interface PersonalityRead {
  bookSlug: 'sb' | 'cc' | 'bg';
  /** Canto, or for the Caitanya-caritāmṛta the līlā (1 Ādi, 2 Madhya, 3 Antya). */
  canto?: number;
  chapter: number;
  /** Set for Gītā sources, and where a story starts partway into a chapter. */
  verse?: string;
}

export interface Personality {
  id: string;
  name: string;
  /** One line: who they are. */
  role: string;
  about: string;
  names: string;
  read?: PersonalityRead[];
}

const sb = (canto: number, ...chapters: number[]): PersonalityRead[] =>
  chapters.map(chapter => ({ bookSlug: 'sb', canto, chapter }));
/** One SB verse, where the story starts partway into a chapter. */
const sbAt = (canto: number, chapter: number, verse: number): PersonalityRead =>
  ({ bookSlug: 'sb', canto, chapter, verse: String(verse) });
const cc = (lila: 1 | 2 | 3, ...chapters: number[]): PersonalityRead[] =>
  chapters.map(chapter => ({ bookSlug: 'cc', canto: lila, chapter }));
/** Bhagavad-gītā verses, "1.8". */
const bg = (...verses: string[]): PersonalityRead[] =>
  verses.map(v => ({ bookSlug: 'bg', chapter: Number(v.split('.')[0]), verse: v.split('.')[1] }));

export const PERSONALITIES: Personality[] = [
  // ─── Sages ───────────────────────────────────────────────────────────
  {
    id: 'bhrgu', name: 'Bhṛgu Muni', role: 'Great sage, son of Lord Brahmā',
    about: 'One of the sages born from Brahmā\'s mind and the father of the Bhārgava line. He tested Brahmā, Śiva and Viṣṇu to learn who is greatest, and declared Lord Viṣṇu supreme when the Lord welcomed the kick to His chest. At Dakṣa\'s sacrifice he cursed Lord Śiva\'s followers. In the Gītā (10.25) Kṛṣṇa says, "Of the great sages I am Bhṛgu."',
    names: 'bhrgu(?:[- ]muni)?',
    read: [sbAt(10, 89, 1), ...sb(4, 2), ...bg('10.25')],
  },
  {
    id: 'parasara', name: 'Parāśara Muni', role: 'Great sage, father of Śrīla Vyāsadeva',
    about: 'Grandson of Vasiṣṭha and father of Vyāsadeva by Satyavatī. He spoke the Viṣṇu Purāṇa. Śrīla Prabhupāda often quotes his definition of Bhagavān: the person full in all six opulences — wealth, strength, fame, beauty, knowledge and renunciation.',
    names: 'parasara(?:[- ]muni)?',
  },
  {
    id: 'vyasa', name: 'Śrīla Vyāsadeva', role: 'Compiler of the Vedic literature; a literary incarnation of the Lord',
    about: 'Kṛṣṇa-dvaipāyana Vyāsa, son of Parāśara and Satyavatī. He divided the Veda into four and compiled the Purāṇas, the Mahābhārata (which contains the Bhagavad-gītā) and the Vedānta-sūtra. Still dissatisfied, on Nārada\'s instruction he wrote the Śrīmad-Bhāgavatam, his own commentary on the Vedānta-sūtra, and taught it to his son Śukadeva.',
    names: '(?:srila |sri )?(?:vyasadeva|vyasa(?![- ]?puja)|krsna[- ]dvaipayana(?: vyasa)?|dvaipayana(?: vyasa)?|badarayana)',
    read: sb(1, 4, 5, 7),
  },
  {
    id: 'narada', name: 'Nārada Muni', role: 'Sage among the demigods (devarṣi); spiritual master of Vyāsa, Dhruva and Prahlāda',
    about: 'A son of Brahmā who travels everywhere playing his vīṇā and singing the Lord\'s glories. In his previous life he was the son of a maidservant, and became a devotee by serving Vaiṣṇava sages. He initiated Dhruva, instructed Prahlāda in his mother\'s womb, and told Vyāsadeva to write the Bhāgavatam. He is one of the twelve mahājanas.',
    names: '(?:devarsi |sri )?narada(?![- ](?:pancaratra|bhakti))(?:[- ]muni|[- ]rsi)?',
    read: sb(1, 5, 6),
  },
  {
    id: 'sukadeva', name: 'Śukadeva Gosvāmī', role: 'Son of Vyāsadeva; speaker of the Śrīmad-Bhāgavatam',
    about: 'Liberated from birth, he left home as a boy and wandered as a paramahaṁsa. Attracted by the Lord\'s pastimes, he learned the Bhāgavatam from his father and spoke it to Mahārāja Parīkṣit on the bank of the Ganges during the king\'s last seven days. He is one of the twelve mahājanas.',
    names: 'sukadeva(?:[- ]gosvami)?|suka(?:[- ]?muni)?',
    read: sb(1, 19),
  },
  {
    id: 'suta', name: 'Sūta Gosvāmī', role: 'Speaker of the Bhāgavatam to the sages of Naimiṣāraṇya',
    about: 'Ugraśravā, son of Romaharṣaṇa. He was present when Śukadeva spoke the Bhāgavatam to Mahārāja Parīkṣit, and later repeated it to the sages headed by Śaunaka at Naimiṣāraṇya.',
    names: 'suta(?:[- ]gosvami)?',
    read: sb(1, 1),
  },
  {
    id: 'saunaka', name: 'Śaunaka Ṛṣi', role: 'Head of the sages at Naimiṣāraṇya',
    about: 'The learned sage who led the thousand-year sacrifice at Naimiṣāraṇya and asked Sūta Gosvāmī the questions with which the Bhāgavatam begins.',
    names: 'saunaka(?:[- ]rsi)?',
    read: sb(1, 1),
  },
  {
    id: 'vasistha', name: 'Vasiṣṭha Muni', role: 'Great sage; priest of the Sun dynasty',
    about: 'A son of Brahmā and husband of Arundhatī. He was the priest and guide of the Ikṣvāku (Raghu) dynasty, in which Lord Rāmacandra appeared.',
    names: 'vasistha(?:[- ]muni)?',
    read: sb(9, 10),
  },
  {
    id: 'visvamitra', name: 'Viśvāmitra Muni', role: 'A king who became a brahmarṣi by austerity',
    about: 'Born a kṣatriya, he became a brāhmaṇa by severe austerities. He took the boys Rāma and Lakṣmaṇa to protect his sacrifice. His meditation was broken by the apsarā Menakā, and Śakuntalā was born; Śrīla Prabhupāda cites this to show the strength of sex desire even in a great yogī.',
    names: 'visvamitra(?:[- ]muni)?',
  },
  {
    id: 'agastya', name: 'Agastya Muni', role: 'Powerful sage',
    about: 'A great and powerful sage. He cursed King Indradyumna, who neglected to receive him, to become an elephant; that elephant was Gajendra, later delivered by the Lord.',
    names: 'agastya(?:[- ]muni|[- ]rsi)?',
    read: sb(8, 4),
  },
  {
    id: 'atri', name: 'Atri Muni', role: 'Son of Brahmā; husband of Anasūyā',
    about: 'One of the great sages. Pleased by his austerities, Brahmā, Viṣṇu and Śiva appeared before him, and their partial expansions were born as his sons: Soma, Dattātreya and Durvāsā.',
    names: 'atri(?:[- ]muni|[- ]rsi)?',
    read: sb(4, 1),
  },
  {
    id: 'anasuya', name: 'Anasūyā', role: 'Wife of Atri Muni; daughter of Kardama Muni',
    about: 'A daughter of Kardama Muni and Devahūti, and a model of chastity. She was the mother of Soma, Dattātreya and Durvāsā.',
    names: 'anasuya',
    read: sb(4, 1),
  },
  {
    id: 'durvasa', name: 'Durvāsā Muni', role: 'Mystic sage known for his anger',
    about: 'A son of Atri Muni, born of Lord Śiva\'s portion. When he offended Mahārāja Ambarīṣa, the Sudarśana cakra chased him through the universe; even Brahmā, Śiva and Viṣṇu could not shelter him, and he was saved only by begging forgiveness at Ambarīṣa\'s feet.',
    names: 'durvasa(?:[- ]muni)?',
    read: sb(9, 4, 5),
  },
  {
    id: 'markandeya', name: 'Mārkaṇḍeya Ṛṣi', role: 'Sage who saw the Lord\'s illusory energy',
    about: 'A great sage who, by the Lord\'s mercy, experienced a universal devastation and saw the Lord as a baby lying on a banyan leaf.',
    names: 'markandeya(?:[- ]rsi|[- ]muni)?',
    read: sb(12, 8, 9),
  },
  {
    id: 'kardama', name: 'Kardama Muni', role: 'Prajāpati; father of Lord Kapila',
    about: 'After ten thousand years of austerity he saw the Lord, who promised to become his son. He married Devahūti, daughter of Svāyambhuva Manu. They had nine daughters, and then Lord Kapila appeared as their son.',
    names: 'kardama(?:[- ]muni)?',
    read: sb(3, 21, 22, 24),
  },
  {
    id: 'devahuti', name: 'Devahūti', role: 'Mother of Lord Kapila',
    about: 'The daughter of Svāyambhuva Manu and wife of Kardama Muni. Her son Lord Kapila taught her sāṅkhya philosophy, culminating in devotional service, and by following it she attained perfection.',
    names: 'devahuti',
    read: sb(3, 23, 25, 33),
  },
  {
    id: 'kapila', name: 'Lord Kapila', role: 'Incarnation of the Lord; son of Devahūti',
    about: 'He taught His mother the original sāṅkhya: the analysis of matter and spirit, ending in devotional service. Śrīla Prabhupāda distinguishes Him from a later atheistic philosopher also named Kapila. The sixty thousand sons of King Sagara were burned to ashes for offending Him.',
    names: '(?:lord )?kapila(?:deva)?(?:[- ]muni)?',
    read: [...sb(3, 25), ...sb(9, 8)],
  },
  {
    id: 'kumaras', name: 'The four Kumāras', role: 'Sanaka, Sanandana, Sanātana and Sanat-kumāra — sons of Brahmā',
    about: 'Born from Brahmā\'s mind, they refused to marry and remained boys of five. They were impersonalists until the fragrance of tulasī offered at the Lord\'s feet entered their nostrils, and they became devotees. They cursed Jaya and Vijaya, the doorkeepers of Vaikuṇṭha. One of the four Vaiṣṇava sampradāyas comes from them.',
    names: 'kumaras|catuh[- ]?sana|sanaka(?:[- ]kumara)?|sanandana|sanat[- ]kumara',
    read: sb(3, 15, 16),
  },
  {
    id: 'jaya-vijaya', name: 'Jaya and Vijaya', role: 'Doorkeepers of Vaikuṇṭha',
    about: 'Cursed by the four Kumāras, they took three births as enemies of the Lord: Hiraṇyākṣa and Hiraṇyakaśipu, Rāvaṇa and Kumbhakarṇa, and Śiśupāla and Dantavakra. Each time the Lord killed them, and after the third birth they returned to Vaikuṇṭha.',
    names: 'jaya and vijaya|jaya[- ]vijaya',
    read: sb(3, 16),
  },
  {
    id: 'kasyapa', name: 'Kaśyapa Muni', role: 'Prajāpati; father of the demigods and the demons',
    about: 'A son of Marīci. Through Aditi he fathered the demigods and, later, Lord Vāmanadeva; through Diti, the demons Hiraṇyākṣa and Hiraṇyakaśipu.',
    names: 'kasyapa(?:[- ]muni)?',
    read: sb(3, 14),
  },
  {
    id: 'aditi', name: 'Aditi', role: 'Mother of the demigods and of Lord Vāmana',
    about: 'A daughter of Dakṣa and wife of Kaśyapa. When Bali Mahārāja took the heavenly planets, she observed the payo-vrata, and the Lord appeared as her son Vāmanadeva.',
    names: 'aditi',
    read: sb(8, 16, 17),
  },
  {
    id: 'diti', name: 'Diti', role: 'Mother of Hiraṇyākṣa and Hiraṇyakaśipu',
    about: 'A daughter of Dakṣa and wife of Kaśyapa. She pressed her husband for union at an inauspicious evening hour, and the two great demons were conceived. Later she vowed to bear a son who would kill Indra.',
    names: 'diti',
    read: [...sb(3, 14), ...sb(6, 18)],
  },
  {
    id: 'marici', name: 'Marīci', role: 'Son of Brahmā; father of Kaśyapa',
    about: 'One of the great sages born from Brahmā. In the Gītā (10.21) Kṛṣṇa says, "Of the Maruts I am Marīci."',
    names: 'marici',
    read: bg('10.21'),
  },
  {
    id: 'angira', name: 'Aṅgirā Ṛṣi', role: 'Son of Brahmā; father of Bṛhaspati',
    about: 'One of the great sages. Together with Nārada he instructed King Citraketu when the king was grieving for his dead son.',
    names: 'angira(?:s|[- ]rsi|[- ]muni)?',
    read: sb(6, 14, 15),
  },
  {
    id: 'brhaspati', name: 'Bṛhaspati', role: 'Spiritual master of the demigods',
    about: 'Son of Aṅgirā and priest of the heavenly kings. When Indra, proud of his opulence, failed to stand for him, he left, and the demigods were defeated by the demons. In the Gītā (10.24) Kṛṣṇa says, "Of priests I am Bṛhaspati."',
    names: 'brhaspati',
    read: [...sb(6, 7), ...bg('10.24')],
  },
  {
    id: 'sukracarya', name: 'Śukrācārya', role: 'Spiritual master of the demons',
    about: 'Son of Bhṛgu. He advised Bali Mahārāja not to give Lord Vāmana the three steps of land, and cursed Bali when he refused. Śrīla Prabhupāda cites Bali\'s rejection of him as rejecting a guru who stands against the Lord.',
    names: 'sukracarya|sukra(?=[- ]acarya)',
    read: sb(8, 19, 20),
  },
  {
    id: 'dattatreya', name: 'Dattātreya', role: 'Incarnation of the Lord, son of Atri',
    about: 'Born to Atri and Anasūyā, He spoke on transcendence to Alarka, Prahlāda and others. The avadhūta of the Eleventh Canto, who learned from twenty-four teachers in nature, is understood to be Dattātreya.',
    names: 'dattatreya',
    read: [...sb(4, 1), sbAt(11, 7, 24)],
  },
  {
    id: 'valmiki', name: 'Vālmīki Muni', role: 'Author of the Rāmāyaṇa',
    about: 'The great sage who composed the original Rāmāyaṇa, the history of Lord Rāmacandra. Sītā lived in his āśrama, where her sons Lava and Kuśa were born.',
    names: 'valmiki(?:[- ]muni)?',
    read: sb(9, 11),
  },
  {
    id: 'samika', name: 'Śamīka Ṛṣi', role: 'The sage whose son cursed Mahārāja Parīkṣit',
    about: 'While hunting, the thirsty Mahārāja Parīkṣit placed a dead snake on the shoulder of Śamīka, who was in meditation. Śamīka\'s boy Śṛṅgi cursed the king to die in seven days. Śamīka regretted his son\'s act and sent word to the king.',
    names: 'samika(?:[- ]rsi|[- ]muni)?',
    read: sb(1, 18),
  },
  {
    id: 'srngi', name: 'Śṛṅgi', role: 'Brāhmaṇa boy who cursed Mahārāja Parīkṣit',
    about: 'The young son of Śamīka Ṛṣi. Angry that the king had put a dead snake on his father, he cursed Parīkṣit to be bitten by a snakebird in seven days. Śrīla Prabhupāda points to this as the start of the brāhmaṇas\' decline in Kali-yuga.',
    names: 'srngi',
    read: sb(1, 18),
  },
  {
    id: 'saubhari', name: 'Saubhari Muni', role: 'Mystic sage who fell to sex desire',
    about: 'While performing austerities underwater, he saw fish mating and wanted family life. By mystic power he married fifty princesses, then lamented his fall and returned to the forest.',
    names: 'saubhari(?:[- ]muni|[- ]rsi)?',
    read: sb(9, 6),
  },
  {
    id: 'maitreya', name: 'Maitreya Ṛṣi', role: 'Sage who instructed Vidura',
    about: 'A great sage and friend of Vyāsadeva. Vidura met him at Hardwar and heard from him the account of creation and the Lord\'s pastimes that fills much of the Third and Fourth Cantos.',
    names: 'maitreya(?:[- ]rsi|[- ]muni)?',
    read: sb(3, 4, 5),
  },
  {
    id: 'sandipani', name: 'Sāndīpani Muni', role: 'Teacher of Kṛṣṇa and Balarāma',
    about: 'At his āśrama in Avantī (Ujjain), Kṛṣṇa and Balarāma learned all the arts in sixty-four days. As His fee, Kṛṣṇa brought back his teacher\'s dead son from Yamarāja.',
    names: 'sandipani(?:[- ]muni)?',
    read: sb(10, 45),
  },
  {
    id: 'garga', name: 'Gargamuni', role: 'Priest of the Yadu dynasty',
    about: 'He secretly performed the name-giving ceremony of Kṛṣṇa and Balarāma in Nanda Mahārāja\'s house and foretold that Kṛṣṇa would be equal to Nārāyaṇa in His qualities.',
    names: 'garga(?:muni|[- ]muni|[- ]rsi|acarya)?|gargacarya',
    read: sb(10, 8),
  },
  {
    id: 'dadhici', name: 'Dadhīci', role: 'Sage who gave his body for the demigods',
    about: 'When the demigods needed a weapon to kill Vṛtrāsura, he gave up his body, and Indra\'s thunderbolt was made from his bones.',
    names: 'dadhici',
    read: sb(6, 10),
  },

  // ─── Kings, devotees and others of the Bhāgavatam ─────────────────────
  {
    id: 'dhruva', name: 'Dhruva Mahārāja', role: 'Boy devotee who reached the polestar',
    about: 'Son of King Uttānapāda and Sunīti. Insulted by his stepmother Suruci when he was five, he left home for the forest. Nārada initiated him, and after six months of austerity he saw Lord Viṣṇu. He ruled for 36,000 years and was given Dhruvaloka, the polestar.',
    names: '(?:maharaja )?dhruva(?:[- ]maharaja)?',
    read: sb(4, 8, 9, 12),
  },
  {
    id: 'prahlada', name: 'Prahlāda Mahārāja', role: 'Great devotee, son of Hiraṇyakaśipu',
    about: 'Taught by Nārada while still in his mother\'s womb, he preached devotional service to his schoolmates at the age of five. His father tried to kill him in many ways, and the Lord appeared as Nṛsiṁhadeva to protect him. He is one of the twelve mahājanas.',
    names: '(?:maharaja )?prahlada(?:[- ]maharaja)?',
    read: sb(7, 5, 6, 9),
  },
  {
    id: 'hiranyakasipu', name: 'Hiraṇyakaśipu', role: 'Demon king, father of Prahlāda',
    about: 'A son of Diti, and formerly one of the doorkeepers of Vaikuṇṭha. By austerity he got Brahmā\'s blessing that he could not be killed by man or animal, by day or night, inside or outside, on land or in the sky. Lord Nṛsiṁhadeva killed him at dusk, on the threshold, on His lap, with His nails.',
    names: 'hiranyakasipu',
    read: sb(7, 3, 8),
  },
  {
    id: 'hiranyaksa', name: 'Hiraṇyākṣa', role: 'Demon killed by Lord Varāha',
    about: 'The brother of Hiraṇyakaśipu. He fought Lord Varāha, who had come to lift the earth from the Garbhodaka Ocean, and was killed by Him.',
    names: 'hiranyaksa',
    read: sb(3, 17, 18, 19),
  },
  {
    id: 'ajamila', name: 'Ajāmila', role: 'A fallen brāhmaṇa saved by the holy name',
    about: 'A brāhmaṇa who fell into the company of a prostitute and lived by sinful means. At death he called his youngest son, Nārāyaṇa, and because he had chanted the Lord\'s name the Viṣṇudūtas stopped the Yamadūtas from taking him. He then went to Hardwar and attained perfection.',
    names: 'ajamila',
    read: sb(6, 1, 2),
  },
  {
    id: 'gajendra', name: 'Gajendra', role: 'King of elephants, saved by the Lord',
    about: 'Seized by a crocodile in a lake on Trikūṭa Mountain, he struggled for a thousand years, then surrendered and prayed. Lord Viṣṇu came on Garuḍa and freed him. In his previous life he was King Indradyumna, cursed by Agastya Muni.',
    names: 'gajendra',
    read: sb(8, 2, 3, 4),
  },
  {
    id: 'bali', name: 'Bali Mahārāja', role: 'Demon king who gave everything to Lord Vāmana',
    about: 'Grandson of Prahlāda. After conquering the heavenly planets, he gave Lord Vāmanadeva the three steps of land He begged, against Śukrācārya\'s advice. With two steps the Lord covered the universe, and Bali offered his own head for the third. The Lord made him king of Sutala. He is one of the twelve mahājanas.',
    names: '(?:maharaja |king )?bali(?:[- ]maharaja)?',
    read: sb(8, 19, 20, 22),
  },
  {
    id: 'ambarisa', name: 'Ambarīṣa Mahārāja', role: 'Ideal devotee king',
    about: 'Though emperor of the world, he engaged every sense in the Lord\'s service — his mind on Kṛṣṇa\'s lotus feet, his words in describing Him, his hands in cleaning the temple. When Durvāsā Muni tried to harm him, the Sudarśana cakra protected him.',
    names: '(?:maharaja )?ambarisa(?:[- ]maharaja)?',
    read: sb(9, 4, 5),
  },
  {
    id: 'pariksit', name: 'Mahārāja Parīkṣit', role: 'Emperor who heard the Bhāgavatam',
    about: 'Son of Abhimanyu and Uttarā, and grandson of Arjuna. Kṛṣṇa saved him in the womb from Aśvatthāmā\'s brahmāstra. Cursed to die in seven days, he sat by the Ganges and heard the Bhāgavatam from Śukadeva Gosvāmī, attaining perfection simply by hearing.',
    names: '(?:maharaja |king )?pariksit(?:[- ]maharaja)?',
    read: sb(1, 12, 16, 19),
  },
  {
    id: 'vidura', name: 'Vidura', role: 'Devotee uncle of the Pāṇḍavas',
    about: 'Born of Vyāsadeva and a maidservant, he was a younger brother of Dhṛtarāṣṭra and Pāṇḍu. Insulted by Duryodhana, he left on pilgrimage, heard from Uddhava and Maitreya, then returned and persuaded Dhṛtarāṣṭra to leave home. He was Yamarāja, born as a śūdra by the curse of Maṇḍūka Muni.',
    names: 'vidura',
    read: [...sb(1, 13), ...sb(3, 1)],
  },
  {
    id: 'uddhava', name: 'Uddhava', role: 'Kṛṣṇa\'s dear friend and counsellor',
    about: 'A cousin of Kṛṣṇa and minister in Dvārakā. He carried Kṛṣṇa\'s message to the gopīs of Vṛndāvana and was humbled by their love. Kṛṣṇa\'s last teachings to him fill most of the Eleventh Canto. He told Vidura of Kṛṣṇa\'s departure.',
    names: 'uddhava',
    read: [...sb(3, 2), ...sb(10, 46, 47)],
  },
  {
    id: 'akrura', name: 'Akrūra', role: 'Who took Kṛṣṇa from Vṛndāvana to Mathurā',
    about: 'Sent by Kaṁsa, he came to Vṛndāvana to bring Kṛṣṇa and Balarāma to Mathurā. Bathing in the Yamunā on the way, he saw Them and Lord Viṣṇu in the water. He is the example of perfection by offering prayers (vandana).',
    names: 'akrura',
    read: sb(10, 38, 39, 40),
  },
  {
    id: 'kunti', name: 'Queen Kuntī', role: 'Mother of the Pāṇḍavas; Kṛṣṇa\'s aunt',
    about: 'Sister of Vasudeva and wife of King Pāṇḍu; mother of Yudhiṣṭhira, Bhīma and Arjuna, and of Karṇa before her marriage. When Kṛṣṇa was leaving for Dvārakā she prayed for calamities, so that she might always remember Him.',
    names: '(?:queen )?kunti(?:devi|[- ]devi)?',
    read: sb(1, 8),
  },
  {
    id: 'bhisma', name: 'Bhīṣmadeva', role: 'Grandsire of the Kuru dynasty',
    about: 'Son of King Śantanu and Gaṅgā. He vowed lifelong celibacy so his father could marry Satyavatī. At Kurukṣetra he fought for Duryodhana but was a great devotee: lying on a bed of arrows he instructed Yudhiṣṭhira and passed away looking at Kṛṣṇa. He is one of the twelve mahājanas.',
    names: 'bhismadeva|bhisma',
    read: sb(1, 9),
  },
  {
    id: 'drona', name: 'Droṇācārya', role: 'Military teacher of the Kurus and Pāṇḍavas',
    about: 'A brāhmaṇa expert in military science and the father of Aśvatthāmā. He was Arjuna\'s teacher but fought for Duryodhana at Kurukṣetra, and was killed by Dhṛṣṭadyumna.',
    names: 'dronacarya|drona',
    read: bg('1.2', '1.3'),
  },
  {
    id: 'krpa', name: 'Kṛpācārya', role: 'Teacher of the Kuru princes',
    about: 'Droṇa\'s brother-in-law (his sister married Droṇācārya). He fought on Duryodhana\'s side at Kurukṣetra.',
    names: 'krpacarya',
    read: bg('1.8'),
  },
  {
    id: 'dhrtarastra', name: 'Dhṛtarāṣṭra', role: 'Blind king, father of Duryodhana',
    about: 'Son of Vyāsadeva and elder brother of Pāṇḍu. His attachment to his sons led to the war. The Gītā opens with his question to Sañjaya. Vidura later persuaded him to leave home, and he gave up his body by mystic fire in the Himālayas.',
    names: 'dhrtarastra',
    read: [...bg('1.1'), ...sb(1, 13)],
  },
  {
    id: 'sanjaya', name: 'Sañjaya', role: 'Dhṛtarāṣṭra\'s secretary, who narrated the Gītā',
    about: 'A disciple of Vyāsadeva. By Vyāsa\'s mercy he could see the battle from the palace and tell the blind king Kṛṣṇa\'s words to Arjuna.',
    names: 'sanjaya',
    read: bg('1.1'),
  },
  {
    id: 'duryodhana', name: 'Duryodhana', role: 'Eldest son of Dhṛtarāṣṭra',
    about: 'He plotted against the Pāṇḍavas — the house of lac, the poisoned cake, the gambling match and the insult of Draupadī — and refused to return their kingdom, which led to the battle of Kurukṣetra. Bhīma broke his thighs in the fight that ended the war.',
    names: 'duryodhana',
    read: [...bg('1.2'), ...sb(1, 8)],
  },
  {
    id: 'yudhisthira', name: 'Mahārāja Yudhiṣṭhira', role: 'Eldest Pāṇḍava; emperor after Kurukṣetra',
    about: 'Son of Kuntī by Dharmarāja (Yamarāja), famous for truthfulness. After the war he ruled the world as Kṛṣṇa wished. When Kṛṣṇa left the world, he installed Parīkṣit on the throne and retired with his brothers.',
    names: '(?:maharaja )?yudhisthira(?:[- ]maharaja)?',
    read: sb(1, 9, 15),
  },
  {
    id: 'bhima', name: 'Bhīma', role: 'Second Pāṇḍava, son of Vāyu',
    about: 'The strongest of the Pāṇḍavas. He killed the sons of Dhṛtarāṣṭra at Kurukṣetra, and Jarāsandha in a wrestling match arranged by Kṛṣṇa.',
    names: 'bhimasena|bhima',
    read: [...bg('1.10', '1.15'), ...sb(10, 72)],
  },
  {
    id: 'nakula', name: 'Nakula', role: 'Fourth Pāṇḍava',
    about: 'One of the twin sons of Mādrī, Pāṇḍu\'s second wife. He blew the conchshell Sughoṣa at Kurukṣetra.',
    names: 'nakula',
    read: bg('1.16'),
  },
  {
    id: 'sahadeva', name: 'Sahadeva', role: 'Youngest Pāṇḍava',
    about: 'Nakula\'s twin, son of Mādrī. He blew the conchshell Maṇipuṣpaka at Kurukṣetra.',
    names: 'sahadeva',
    read: bg('1.16'),
  },
  {
    id: 'draupadi', name: 'Draupadī', role: 'Wife of the Pāṇḍavas; daughter of King Drupada',
    about: 'When Duḥśāsana tried to strip her in the assembly after the gambling match, she gave up her own efforts and called on Kṛṣṇa, who supplied unlimited cloth. Though Aśvatthāmā killed her sons, she asked that he be spared out of respect for his mother.',
    names: 'draupadi',
    read: sb(1, 7),
  },
  {
    id: 'gandhari', name: 'Gāndhārī', role: 'Wife of Dhṛtarāṣṭra',
    about: 'A chaste wife who covered her eyes for life because her husband was blind. She followed him when he left home, and entered the fire in which he left his body.',
    names: 'gandhari',
    read: sb(1, 13),
  },
  {
    id: 'karna', name: 'Karṇa', role: 'Son of Kuntī by the sun-god',
    about: 'Born to Kuntī before her marriage to King Pāṇḍu, so a half-brother of Arjuna. He fought on Duryodhana\'s side at Kurukṣetra.',
    names: 'karna',
    read: bg('1.8'),
  },
  {
    id: 'asvatthama', name: 'Aśvatthāmā', role: 'Son of Droṇācārya',
    about: 'He killed the five sleeping sons of Draupadī. Arjuna arrested him; at Draupadī\'s request he was not killed but was shaven and stripped of the jewel on his head. He also released a brahmāstra at the unborn Parīkṣit, which Kṛṣṇa stopped.',
    names: 'asvatthama',
    read: [...sb(1, 7, 8), ...bg('1.8')],
  },
  {
    id: 'abhimanyu', name: 'Abhimanyu', role: 'Son of Arjuna; father of Parīkṣit',
    about: 'Son of Arjuna and Subhadrā, a great fighter though still a youth. He was killed at Kurukṣetra while his wife Uttarā was carrying Parīkṣit.',
    names: 'abhimanyu',
    read: [...bg('1.6'), ...sb(1, 12)],
  },
  {
    id: 'pandu', name: 'Pāṇḍu', role: 'Father of the Pāṇḍavas',
    about: 'Son of Vyāsadeva and younger brother of Dhṛtarāṣṭra. He died young, leaving his sons in the care of Kuntī and the elders of the Kuru dynasty.',
    names: 'pandu',
    read: bg('1.1'),
  },
  {
    id: 'drupada', name: 'Drupada', role: 'King of Pāñcāla, father of Draupadī',
    about: 'A great warrior on the Pāṇḍava side and the father of Draupadī and Dhṛṣṭadyumna. He had a political quarrel with Droṇācārya, and performed a sacrifice for a son who could kill Droṇa.',
    names: 'drupada',
    read: bg('1.3', '1.4'),
  },
  {
    id: 'dhrstadyumna', name: 'Dhṛṣṭadyumna', role: 'Son of Drupada; Pāṇḍava general',
    about: 'He arranged the Pāṇḍavas\' military formation at Kurukṣetra. Droṇācārya, though knowing he was destined to kill him, taught him military science; he killed Droṇa in the battle.',
    names: 'dhrstadyumna',
    read: bg('1.3'),
  },
  {
    id: 'sikhandi', name: 'Śikhaṇḍī', role: 'Son of Drupada',
    about: 'A son of King Drupada who fought on the Pāṇḍava side at Kurukṣetra.',
    names: 'sikhandi',
    read: bg('1.17'),
  },
  {
    id: 'virata', name: 'Virāṭa', role: 'King who sheltered the Pāṇḍavas',
    about: 'The Pāṇḍavas lived hidden in his kingdom during their exile. His daughter Uttarā married Abhimanyu, and he fought for the Pāṇḍavas at Kurukṣetra.',
    names: 'virata(?![- ]rupa)',
    read: bg('1.4'),
  },
  {
    id: 'yuyudhana', name: 'Yuyudhāna (Sātyaki)', role: 'Yādava warrior',
    about: 'A great fighter of the Yadu dynasty, a disciple of Arjuna and a friend of Kṛṣṇa, who fought for the Pāṇḍavas at Kurukṣetra.',
    names: 'yuyudhana|satyaki',
    read: bg('1.4'),
  },
  {
    id: 'subhadra', name: 'Subhadrā', role: 'Sister of Kṛṣṇa; wife of Arjuna',
    about: 'Mother of Abhimanyu. She is worshiped at Jagannātha Purī between Lord Jagannātha and Balarāma.',
    names: 'subhadra',
    read: bg('1.6'),
  },

  // ─── Kṛṣṇa's pastimes ─────────────────────────────────────────────────
  {
    id: 'kamsa', name: 'Kaṁsa', role: 'Demon king of Mathurā; Kṛṣṇa\'s maternal uncle',
    about: 'Told that Devakī\'s eighth son would kill him, he imprisoned Devakī and Vasudeva and killed their children. Always thinking of Kṛṣṇa in fear, he sent demon after demon to Vṛndāvana. Kṛṣṇa killed him in the wrestling arena at Mathurā.',
    names: 'kamsa',
    read: sb(10, 1, 4, 44),
  },
  {
    id: 'devaki', name: 'Devakī', role: 'Mother of Kṛṣṇa',
    about: 'Kaṁsa\'s cousin and the wife of Vasudeva. Kṛṣṇa appeared as her eighth son in Kaṁsa\'s prison and was carried to Gokula. In a previous life she and Vasudeva were Pṛśni and Sutapā, and the Lord became their son three times.',
    names: 'devaki(?![- ](?:nandana|suta|putra))',
    read: sb(10, 1, 3),
  },
  {
    id: 'rohini', name: 'Rohiṇī', role: 'Mother of Balarāma',
    about: 'A wife of Vasudeva. Balarāma was moved from Devakī\'s womb to hers, and she lived in Nanda Mahārāja\'s house in Gokula.',
    names: 'rohini(?:[- ]devi)?',
  },
  {
    id: 'putana', name: 'Pūtanā', role: 'Witch who tried to kill the infant Kṛṣṇa',
    about: 'Sent by Kaṁsa, she came to Gokula as a beautiful woman and offered Kṛṣṇa her poisoned breast. He sucked out her life with the milk, and because she had acted as His mother she was given a mother\'s place.',
    names: 'putana',
    read: sb(10, 6),
  },
  {
    id: 'aghasura', name: 'Aghāsura', role: 'Python demon',
    about: 'The brother of Pūtanā and Bakāsura. He spread himself out like a huge cave with open mouth, and the cowherd boys walked in; Kṛṣṇa entered, expanded, and killed him from within. His soul merged into Kṛṣṇa\'s body.',
    names: 'aghasura',
    read: sb(10, 12),
  },
  {
    id: 'bakasura', name: 'Bakāsura', role: 'Demon in the form of a huge duck',
    about: 'He swallowed Kṛṣṇa, but Kṛṣṇa burned his throat, and when the demon tried again Kṛṣṇa tore his beak apart.',
    names: 'bakasura',
    read: sb(10, 11),
  },
  {
    id: 'kaliya', name: 'Kāliya', role: 'Many-hooded serpent of the Yamunā',
    about: 'His poison polluted the Yamunā. Kṛṣṇa jumped into the lake and danced on his hoods until he was subdued. At the prayers of his wives Kṛṣṇa spared him and sent him to Ramaṇaka Island.',
    names: 'kaliya',
    read: sb(10, 16),
  },
  {
    id: 'nalakuvara', name: 'Nalakūvara and Maṇigrīva', role: 'Sons of Kuvera, freed by Lord Dāmodara',
    about: 'Drunk and naked in the company of women, they did not cover themselves when Nārada passed. He cursed them to stand as twin arjuna trees in Gokula until Kṛṣṇa freed them. Baby Kṛṣṇa, bound to a mortar, pulled the trees down.',
    names: 'nalakuvara|manigriva',
    read: sb(10, 10),
  },
  {
    id: 'sudama', name: 'Sudāmā Vipra', role: 'Kṛṣṇa\'s poor brāhmaṇa friend',
    about: 'Kṛṣṇa\'s classmate at Sāndīpani Muni\'s school. Urged by his wife, he went to Dvārakā with a handful of chipped rice; Kṛṣṇa ate it with great love and secretly made him wealthy. (A florist of Mathurā named Sudāmā also served Kṛṣṇa.)',
    names: 'sudama(?:[- ]vipra)?',
    read: sb(10, 80, 81),
  },
  {
    id: 'kubja', name: 'Kubjā', role: 'Hunchbacked girl of Mathurā',
    about: 'She offered Kṛṣṇa the sandalwood paste she was carrying for Kaṁsa. Kṛṣṇa straightened her body and she became beautiful.',
    names: 'kubja',
    read: sb(10, 42),
  },
  {
    id: 'rukmini', name: 'Rukmiṇī', role: 'Chief queen of Dvārakā',
    about: 'Daughter of King Bhīṣmaka of Vidarbha and an expansion of the goddess of fortune. Her brother had promised her to Śiśupāla, but she wrote to Kṛṣṇa, who carried her away and defeated the opposing kings.',
    names: 'rukmini(?:devi|[- ]devi)?',
    read: sb(10, 52, 53, 54),
  },
  {
    id: 'satyabhama', name: 'Satyabhāmā', role: 'Queen of Kṛṣṇa in Dvārakā',
    about: 'Daughter of Satrājit, given to Kṛṣṇa with the Syamantaka jewel. Kṛṣṇa brought the pārijāta tree from heaven for her.',
    names: 'satyabhama',
    read: sb(10, 56),
  },
  {
    id: 'pradyumna', name: 'Pradyumna', role: 'Son of Kṛṣṇa and Rukmiṇī',
    about: 'Cupid (Kāmadeva) born again as Kṛṣṇa\'s son. Stolen as a baby by the demon Śambara, he grew up and killed him. Pradyumna is also the name of one of the Lord\'s four original expansions (catur-vyūha).',
    names: 'pradyumna',
    read: sb(10, 55),
  },
  {
    id: 'aniruddha', name: 'Aniruddha', role: 'Grandson of Kṛṣṇa',
    about: 'Son of Pradyumna. Bāṇāsura\'s daughter Ūṣā fell in love with him; Bāṇa imprisoned him, and Kṛṣṇa fought Bāṇa to free him. Aniruddha is also the name of one of the Lord\'s four original expansions (catur-vyūha).',
    names: 'aniruddha',
    read: sb(10, 62, 63),
  },
  {
    id: 'jambavan', name: 'Jāmbavān', role: 'King of the bears',
    about: 'He served Lord Rāmacandra. Later he fought Kṛṣṇa for twenty-eight days over the Syamantaka jewel, recognized Him as his worshipable Lord, and gave Him the jewel and his daughter Jāmbavatī.',
    names: 'jambavan',
    read: sb(10, 56),
  },
  {
    id: 'jarasandha', name: 'Jarāsandha', role: 'King of Magadha',
    about: 'Kaṁsa\'s father-in-law, who attacked Mathurā again and again to avenge him. He was a great respecter of brāhmaṇas. Kṛṣṇa, Arjuna and Bhīma came to him dressed as brāhmaṇas, and Bhīma killed him in a wrestling match.',
    names: 'jarasandha',
    read: sb(10, 50, 72),
  },
  {
    id: 'sisupala', name: 'Śiśupāla', role: 'King of Cedi, Kṛṣṇa\'s envious cousin',
    about: 'He insulted Kṛṣṇa at Mahārāja Yudhiṣṭhira\'s Rājasūya sacrifice, and Kṛṣṇa cut off his head with His disc. Because he had always thought of Kṛṣṇa, even in envy, a light rose from his body and entered Kṛṣṇa. He was formerly one of the doorkeepers of Vaikuṇṭha.',
    names: 'sisupala',
    read: sb(10, 74),
  },
  {
    id: 'dantavakra', name: 'Dantavakra', role: 'Friend of Śiśupāla',
    about: 'He attacked Kṛṣṇa to avenge Śiśupāla and was killed by Kṛṣṇa\'s club. He was formerly one of the doorkeepers of Vaikuṇṭha.',
    names: 'dantavakra',
    read: sb(10, 78),
  },
  {
    id: 'narakasura', name: 'Narakāsura (Bhaumāsura)', role: 'Demon son of the earth',
    about: 'He stole Aditi\'s earrings and held 16,100 princesses captive. Kṛṣṇa killed him and married the princesses.',
    names: 'narakasura|bhaumasura',
    read: sb(10, 59),
  },
  {
    id: 'banasura', name: 'Bāṇāsura', role: 'Thousand-armed demon, son of Bali',
    about: 'A devotee of Lord Śiva who imprisoned Kṛṣṇa\'s grandson Aniruddha. Kṛṣṇa defeated even Śiva in battle and cut off all but four of Bāṇa\'s arms, sparing his life because he was Prahlāda\'s descendant.',
    names: 'banasura',
    read: sb(10, 62, 63),
  },
  {
    id: 'mucukunda', name: 'Mucukunda', role: 'King who slept in a cave',
    about: 'After helping the demigods he was blessed with long sleep. Kṛṣṇa led the demon Kālayavana into his cave, and Mucukunda\'s glance burned the demon to ashes. Then he saw Kṛṣṇa and took to devotional service.',
    names: 'mucukunda',
    read: sb(10, 51),
  },
  {
    id: 'lalita', name: 'Lalitā', role: 'Chief friend of Śrīmatī Rādhārāṇī',
    about: 'The foremost of Rādhārāṇī\'s eight principal gopī friends (aṣṭa-sakhīs).',
    names: 'lalita(?:[- ]devi|[- ]sakhi)?(?![- ]madhava)',
  },
  {
    id: 'visakha', name: 'Viśākhā', role: 'Intimate friend of Śrīmatī Rādhārāṇī',
    about: 'One of Rādhārāṇī\'s eight principal gopī friends. In Caitanya-līlā she appears as Rāya Rāmānanda.',
    names: 'visakha',
  },
  {
    id: 'ugrasena', name: 'Ugrasena', role: 'King of the Yadus; father of Kaṁsa',
    about: 'Kaṁsa imprisoned him and took the throne. After killing Kaṁsa, Kṛṣṇa made Ugrasena king again.',
    names: 'ugrasena',
    read: sb(10, 45),
  },

  // ─── Creation and the early dynasties ─────────────────────────────────
  {
    id: 'svayambhuva', name: 'Svāyambhuva Manu', role: 'First Manu, son of Brahmā',
    about: 'The first father of mankind in this day of Brahmā. His sons were Priyavrata and Uttānapāda, and his daughters Ākūti, Devahūti and Prasūti. He gave Devahūti to Kardama Muni.',
    names: 'svayambhuva manu',
    read: sb(3, 21, 22),
  },
  {
    id: 'vaivasvata', name: 'Vaivasvata Manu', role: 'The present Manu, son of the sun-god',
    about: 'There are fourteen Manus in one day of Brahmā; Vaivasvata is the seventh, who rules now. The sun-god Vivasvān taught him the Bhagavad-gītā, and he taught it to Ikṣvāku (Gītā 4.1).',
    names: 'vaivasvata(?: manu)?',
    read: bg('4.1'),
  },
  {
    id: 'manu', name: 'Manu', role: 'Father and lawgiver of mankind',
    about: 'In one day of Brahmā there are fourteen Manus, each ruling for about 306 million years. The present one is Vaivasvata Manu, to whom the sun-god spoke the Gītā. The Manu-saṁhitā is the lawbook of human society.',
    names: 'manu(?![- ](?:samhita|smrti|antara))',
    read: bg('4.1'),
  },
  {
    id: 'vivasvan', name: 'Vivasvān', role: 'The sun-god',
    about: 'The king of the sun planet. Kṛṣṇa says in the Gītā (4.1) that He first taught this science to Vivasvān, who taught it to Manu.',
    names: 'vivasvan',
    read: bg('4.1'),
  },
  {
    id: 'iksvaku', name: 'Ikṣvāku', role: 'Son of Manu; first king of the Sun dynasty',
    about: 'He received the Bhagavad-gītā from his father Manu (Gītā 4.1). Lord Rāmacandra appeared in his dynasty.',
    names: 'iksvaku',
    read: bg('4.1'),
  },
  {
    id: 'daksa', name: 'Dakṣa', role: 'Prajāpati, son of Brahmā; father of Satī',
    about: 'Envious of his son-in-law Lord Śiva, he insulted him in an assembly and later at his own sacrifice, where his daughter Satī gave up her body. Śiva\'s follower Vīrabhadra cut off his head; it was replaced with a goat\'s head.',
    names: 'daksa(?:[- ]prajapati)?',
    read: sb(4, 2, 4, 5, 7),
  },
  {
    id: 'sati', name: 'Satī', role: 'Daughter of Dakṣa, wife of Lord Śiva',
    about: 'Unable to bear her father\'s insults to her husband, she gave up her body by yoga at his sacrifice. She was later born again as Pārvatī.',
    names: 'sati(?:devi|[- ]devi)?',
    read: sb(4, 3, 4),
  },
  {
    id: 'uttanapada', name: 'Uttānapāda', role: 'King, father of Dhruva',
    about: 'A son of Svāyambhuva Manu. He favored his wife Suruci and her son Uttama, and neglected Sunīti and her son Dhruva.',
    names: 'uttanapada',
    read: sb(4, 8),
  },
  {
    id: 'priyavrata', name: 'Priyavrata', role: 'Son of Svāyambhuva Manu',
    about: 'He wanted only to meditate on the Lord, but at Brahmā\'s request ruled the world. Driving his chariot around Mount Sumeru, he made the seven oceans and seven islands. Finally he renounced everything.',
    names: 'priyavrata',
    read: sb(5, 1),
  },
  {
    id: 'rsabhadeva', name: 'Lord Ṛṣabhadeva', role: 'Incarnation of the Lord, son of Nābhi',
    about: 'He taught His hundred sons that the human body is not meant for hard work for sense gratification but for austerity, by which one attains unending happiness. He then lived as an avadhūta.',
    names: '(?:lord )?rsabha(?:deva)?',
    read: sb(5, 3, 5, 6),
  },
  {
    id: 'jada-bharata', name: 'Jaḍa Bharata', role: 'Bharata Mahārāja in his third life',
    about: 'Bharata Mahārāja, eldest son of Ṛṣabhadeva, after whom this land is called Bhārata-varṣa, renounced his kingdom but grew attached to a deer and was born as a deer. Next he was born a brāhmaṇa who acted dull and dumb so as not to be distracted again. He instructed King Rahūgaṇa.',
    names: 'jada[- ]bharata|bharata maharaja',
    read: sb(5, 7, 8, 9, 10),
  },
  {
    id: 'rahugana', name: 'Rahūgaṇa', role: 'King who learned from Jaḍa Bharata',
    about: 'King of Sindhu and Sauvīra. He forced Jaḍa Bharata to carry his palanquin and rebuked him, then begged forgiveness on hearing his wisdom.',
    names: 'rahugana',
    read: sb(5, 10, 12),
  },
  {
    id: 'vena', name: 'King Vena', role: 'Atheist king, father of Pṛthu',
    about: 'He forbade sacrifices and claimed to be God. The sages killed him with their curses, and from his churned body came Pṛthu Mahārāja.',
    names: '(?:king )?vena',
    read: sb(4, 14),
  },
  {
    id: 'prthu', name: 'Pṛthu Mahārāja', role: 'Empowered incarnation; the ideal king',
    about: 'Born from the body of King Vena. When the earth withheld her produce, he made her yield it — "milking" the earth in the form of a cow. He performed great sacrifices, received the Lord\'s blessings, and asked for ten thousand ears to hear His glories.',
    names: '(?:maharaja )?prthu(?:[- ]maharaja)?',
    read: sb(4, 15, 18, 20, 23),
  },
  {
    id: 'puranjana', name: 'King Purañjana', role: 'Hero of Nārada\'s allegory of the soul',
    about: 'Nārada\'s story for King Prācīnabarhi: the soul (Purañjana) forgets his eternal friend (the Supersoul), enters the city of nine gates (the body) and is entangled by his queen (intelligence). In his next life he is born a woman, until the friend reveals Himself.',
    names: 'puranjana',
    read: sb(4, 25, 28, 29),
  },
  {
    id: 'citraketu', name: 'King Citraketu', role: 'King who became Vṛtrāsura',
    about: 'After his only son died, Nārada and Aṅgirā taught him, and he saw Lord Saṅkarṣaṇa. As king of the Vidyādharas he laughed at Lord Śiva embracing Pārvatī in an assembly; Pārvatī cursed him, and he was born as the demon Vṛtrāsura.',
    names: '(?:king )?citraketu',
    read: sb(6, 14, 15, 16, 17),
  },
  {
    id: 'vrtrasura', name: 'Vṛtrāsura', role: 'A demon who was a great devotee',
    about: 'Produced from a sacrificial fire to kill Indra; in his previous life he was King Citraketu. In battle he prayed to serve the servants of the Lord\'s servants and to be the friend of devotees, and Indra killed him with the thunderbolt made from Dadhīci\'s bones.',
    names: 'vrtrasura|vrtra',
    read: sb(6, 9, 11, 12),
  },
  {
    id: 'yamaraja', name: 'Yamarāja', role: 'Lord of death; one of the twelve mahājanas',
    about: 'He judges the sinful after death. After Ajāmila was saved, he told his servants never to approach devotees who chant the Lord\'s name. He was born on earth as Vidura.',
    names: 'yamaraja',
    read: sb(6, 3),
  },
  {
    id: 'yayati', name: 'King Yayāti', role: 'King who learned the futility of sense pleasure',
    about: 'Cursed by Śukrācārya with old age, he took his son Pūru\'s youth and enjoyed for a thousand years, then concluded that desire is never satisfied by enjoyment, like fire fed with butter, and renounced.',
    names: '(?:king |maharaja )?yayati',
    read: sb(9, 18, 19),
  },
  {
    id: 'nahusa', name: 'King Nahuṣa', role: 'King who took Indra\'s post',
    about: 'Father of Yayāti. He became king of heaven while Indra was in hiding, desired Indra\'s wife Śacī, insulted the sages, and was cursed to become a snake.',
    names: '(?:king )?nahusa',
  },
  {
    id: 'pururava', name: 'King Purūravā', role: 'King enchanted by Urvaśī',
    about: 'He was so attached to the heavenly dancer Urvaśī that he lost all sense; later he realized his folly and renounced.',
    names: '(?:king )?pururava(?:s)?',
    read: sb(9, 14),
  },
  {
    id: 'urvasi', name: 'Urvaśī', role: 'Celebrated dancer of the heavenly planets',
    about: 'An apsarā famous for her beauty, with whom King Purūravā lived.',
    names: 'urvasi',
    read: sb(9, 14),
  },
  {
    id: 'hariscandra', name: 'King Hariścandra', role: 'King of the Sun dynasty, famed for truthfulness',
    about: 'Childless, he promised Varuṇa that he would sacrifice the son he would get; then he kept postponing the sacrifice.',
    names: '(?:king |maharaja )?hariscandra',
    read: sb(9, 7),
  },
  {
    id: 'sagara', name: 'Mahārāja Sagara', role: 'Emperor of the Sun dynasty',
    about: 'His sixty thousand sons, searching for his sacrificial horse, accused Lord Kapila of stealing it and were burned to ashes. His descendant Bhagīratha brought the Ganges down to deliver them.',
    names: '(?:maharaja|king) sagara|sagara maharaja',
    read: sb(9, 8),
  },
  {
    id: 'bhagiratha', name: 'King Bhagīratha', role: 'Brought the Ganges to earth',
    about: 'By his austerities the Ganges came down to earth, and her waters delivered his ancestors, the sons of Sagara. The Ganges is therefore called Bhāgīrathī.',
    names: '(?:king |maharaja )?bhagiratha',
    read: sb(9, 9),
  },
  {
    id: 'khatvanga', name: 'Mahārāja Khaṭvāṅga', role: 'King who attained perfection in a moment',
    about: 'Told that only a muhūrta (48 minutes) of his life remained, he gave up everything and surrendered to the Lord, and attained perfection in that short time.',
    names: '(?:maharaja |king )?khatvanga',
    read: [...sb(2, 1), ...sb(9, 9)],
  },
  {
    id: 'rantideva', name: 'King Rantideva', role: 'King of great compassion',
    about: 'After forty-eight days without food or water, he gave away the food and water he received to guests, a śūdra, dogs and a caṇḍāla, wishing only to take on others\' suffering.',
    names: '(?:king )?rantideva',
    read: sb(9, 21),
  },
  {
    id: 'janaka', name: 'King Janaka', role: 'King of Mithilā; father of Sītā',
    about: 'A self-realized king, one of the twelve mahājanas. The Gītā (3.20) cites him as one who attained perfection by doing his prescribed duties.',
    names: '(?:king |maharaja )?janaka(?![- ](?:pura|nandini))',
    read: bg('3.20'),
  },
  {
    id: 'parasurama', name: 'Lord Paraśurāma', role: 'Incarnation who cleared the earth of kṣatriyas',
    about: 'Son of the sage Jamadagni. After the Haihaya king Kārtavīryārjuna stole his father\'s cow and his sons killed his father, He killed the kṣatriyas of the earth twenty-one times.',
    names: '(?:lord )?parasurama',
    read: sb(9, 15, 16),
  },
  {
    id: 'dasaratha', name: 'Mahārāja Daśaratha', role: 'Father of Lord Rāmacandra',
    about: 'King of Ayodhyā in the Sun dynasty. Bound by his promise to Queen Kaikeyī, he sent Rāma to the forest for fourteen years and died of grief at the separation.',
    names: '(?:maharaja |king )?dasaratha',
    read: sb(9, 10),
  },
  {
    id: 'ravana', name: 'Rāvaṇa', role: 'Ten-headed demon king of Laṅkā',
    about: 'He kidnapped Sītā and was killed by Lord Rāma. Śrīla Prabhupāda uses him as the example of materialists who want to enjoy the goddess of fortune without Nārāyaṇa and to build a "staircase to heaven." He was formerly one of the doorkeepers of Vaikuṇṭha.',
    names: 'ravana',
    read: sb(9, 10),
  },
  {
    id: 'vibhisana', name: 'Vibhīṣaṇa', role: 'Rāvaṇa\'s devotee brother',
    about: 'He advised Rāvaṇa to return Sītā, was driven away, and surrendered to Lord Rāma, who made him king of Laṅkā.',
    names: 'vibhisana',
    read: sb(9, 10),
  },
  {
    id: 'kumbhakarna', name: 'Kumbhakarṇa', role: 'Giant brother of Rāvaṇa',
    about: 'Brother of Rāvaṇa, killed by Lord Rāmacandra. He was formerly one of the doorkeepers of Vaikuṇṭha.',
    read: sb(7, 1),
    names: 'kumbhakarna',
  },
  {
    id: 'sugriva', name: 'Sugrīva', role: 'King of the monkeys, ally of Lord Rāma',
    about: 'Lord Rāma helped him regain his kingdom from his brother Vālī, and his army of monkeys helped Rāma build the bridge to Laṅkā.',
    names: 'sugriva',
    read: sb(9, 10),
  },
  {
    id: 'purana-buddha', name: 'Lord Buddha', role: 'Incarnation of the Lord',
    about: 'Foretold in the Bhāgavatam (1.3.24) to appear in Gayā. He rejected the Vedas to stop the killing of animals in the name of Vedic sacrifice, and preached nonviolence to bewilder the atheists.',
    names: '(?:lord )?buddha(?:deva)?',
    read: sb(1, 3),
  },

  // ─── Ācāryas and associates of Lord Caitanya ─────────────────────────
  {
    id: 'six-gosvamis', name: 'The six Gosvāmīs of Vṛndāvana', role: 'Rūpa, Sanātana, Jīva, Raghunātha dāsa, Raghunātha Bhaṭṭa and Gopāla Bhaṭṭa',
    about: 'Followers of Lord Caitanya who, on His order, uncovered the places of Kṛṣṇa\'s pastimes in Vṛndāvana, established temples there, and wrote the books that are the basis of Gauḍīya Vaiṣṇava philosophy.',
    names: 'six gosvamis',
  },
  {
    id: 'rupa', name: 'Śrīla Rūpa Gosvāmī', role: 'Chief of the six Gosvāmīs',
    about: 'A minister of the Nawab Hussain Shah who gave up his post to join Lord Caitanya. At Prayāga the Lord taught him the science of devotional service for ten days. He wrote Bhakti-rasāmṛta-sindhu, Upadeśāmṛta and Ujjvala-nīlamaṇi; Lord Caitanya\'s followers are called rūpānugas, followers of Rūpa.',
    names: '(?:srila |sri )?rupa[- ]gosvami|sri rupa(?![- ]manjari)',
    read: cc(2, 19),
  },
  {
    id: 'sanatana', name: 'Śrīla Sanātana Gosvāmī', role: 'Elder brother of Rūpa Gosvāmī',
    about: 'Chief minister of the Nawab; he was jailed for neglecting his duties, escaped, and met Lord Caitanya at Benares, who taught him for two months — on the soul, Kṛṣṇa, devotional service and its goal. He wrote Bṛhad-bhāgavatāmṛta and, with Gopāla Bhaṭṭa, Hari-bhakti-vilāsa.',
    names: '(?:srila |sri )?sanatana[- ]gosvami|sri sanatana',
    read: cc(2, 20, 24),
  },
  {
    id: 'jiva', name: 'Śrīla Jīva Gosvāmī', role: 'Nephew of Rūpa and Sanātana; great philosopher',
    about: 'He wrote the Ṣaṭ-sandarbhas and many other works establishing Gauḍīya philosophy, and founded the Rādhā-Dāmodara temple in Vṛndāvana, where Śrīla Prabhupāda later lived.',
    names: '(?:srila |sri )?jiva[- ]gosvami',
  },
  {
    id: 'raghunatha-dasa', name: 'Śrīla Raghunātha dāsa Gosvāmī', role: 'One of the six Gosvāmīs; model of renunciation',
    about: 'Son of a very rich landowner, he left his wealth and wife to join Lord Caitanya at Purī, where he lived under Svarūpa Dāmodara. After the Lord\'s departure he lived at Rādhā-kuṇḍa in severe renunciation.',
    names: '(?:srila |sri )?raghunatha dasa(?:[- ]gosvami)?|dasa gosvami',
    read: cc(3, 6),
  },
  {
    id: 'raghunatha-bhatta', name: 'Raghunātha Bhaṭṭa Gosvāmī', role: 'One of the six Gosvāmīs',
    about: 'Son of Tapana Miśra. On Lord Caitanya\'s instruction he lived in Vṛndāvana, reciting the Bhāgavatam with great feeling.',
    names: 'raghunatha bhatta(?:[- ]gosvami)?',
  },
  {
    id: 'gopala-bhatta', name: 'Gopāla Bhaṭṭa Gosvāmī', role: 'One of the six Gosvāmīs',
    about: 'Lord Caitanya stayed four months in his family\'s home at Śrī Raṅgam. He later went to Vṛndāvana, compiled the Hari-bhakti-vilāsa and established the Rādhā-ramaṇa deity.',
    names: 'gopala bhatta(?:[- ]gosvami)?',
    read: cc(2, 9),
  },
  {
    id: 'kaviraja', name: 'Kṛṣṇadāsa Kavirāja Gosvāmī', role: 'Author of the Śrī Caitanya-caritāmṛta',
    about: 'A disciple of the six Gosvāmīs. He wrote the Caitanya-caritāmṛta in Vṛndāvana when he was very old, drawing on the notes of Svarūpa Dāmodara and Raghunātha dāsa Gosvāmī.',
    names: 'krsnadasa kaviraja(?:[- ]gosvami)?|kaviraja gosvami',
  },
  {
    id: 'vrndavana-dasa', name: 'Vṛndāvana dāsa Ṭhākura', role: 'Author of the Caitanya-bhāgavata',
    about: 'Called the Vyāsa of Caitanya-līlā. His Caitanya-bhāgavata describes Lord Caitanya\'s early pastimes in detail. His mother Nārāyaṇī was the niece of Śrīvāsa Ṭhākura.',
    names: 'vrndavana dasa(?:[- ]thakura)?',
  },
  {
    id: 'narottama', name: 'Narottama dāsa Ṭhākura', role: 'Ācārya and author of devotional songs',
    about: 'A prince of Kheturi who renounced everything and became the disciple of Lokanātha Gosvāmī. His Bengali songs (Prārthanā, Prema-bhakti-candrikā) are accepted as Vedic truth.',
    names: 'narottama(?: dasa)?(?:[- ]thakura)?',
  },
  {
    id: 'visvanatha', name: 'Viśvanātha Cakravartī Ṭhākura', role: 'Ācārya in the line of Rūpa Gosvāmī',
    about: 'He wrote commentaries on the Bhagavad-gītā and the Bhāgavatam (Sārārtha-darśinī) and the Gurv-aṣṭaka prayers, "saṁsāra-dāvānala…", sung each morning in ISKCON temples.',
    names: 'visvanatha cakravarti(?:[- ]thakura)?',
  },
  {
    id: 'baladeva-vidyabhusana', name: 'Baladeva Vidyābhūṣaṇa', role: 'Gauḍīya ācārya; commentator on Vedānta-sūtra',
    about: 'At Galta, near Jaipur, he wrote the Govinda-bhāṣya commentary on the Vedānta-sūtra, establishing the Gauḍīya sampradāya before the scholars of other schools.',
    names: 'baladeva vidyabhusana',
  },
  {
    id: 'bhaktivinoda', name: 'Śrīla Bhaktivinoda Ṭhākura', role: 'Ācārya; father of Bhaktisiddhānta Sarasvatī',
    about: 'A magistrate and family man who revived Lord Caitanya\'s movement, located the Lord\'s birthplace at Māyāpur, wrote many books and songs, and foresaw people of all countries chanting together.',
    names: '(?:srila )?bhaktivinoda(?:[- ]thakura)?',
  },
  {
    id: 'jagannatha-dasa', name: 'Jagannātha dāsa Bābājī', role: 'Ācārya who confirmed Lord Caitanya\'s birthplace',
    about: 'A great Vaiṣṇava of Navadvīpa, then very old, who confirmed the Lord\'s birthplace at Māyāpur that Bhaktivinoda Ṭhākura had found.',
    names: 'jagannatha dasa babaji',
  },
  {
    id: 'gaurakisora', name: 'Gaurakiśora dāsa Bābājī', role: 'Spiritual master of Bhaktisiddhānta Sarasvatī',
    about: 'A renounced bābājī of Navadvīpa, without formal learning, who lived in complete renunciation, always absorbed in chanting.',
    names: 'gaura[- ]?kisora(?: dasa)?(?: babaji)?',
  },
  {
    id: 'bhaktisiddhanta', name: 'Śrīla Bhaktisiddhānta Sarasvatī Ṭhākura', role: 'Spiritual master of Śrīla Prabhupāda',
    about: 'Son of Bhaktivinoda Ṭhākura and a great scholar and preacher. He founded the Gauḍīya Maṭha with temples throughout India. At their first meeting in Calcutta in 1922 he told Śrīla Prabhupāda to preach Kṛṣṇa consciousness in English.',
    names: '(?:srila |sri )?bhaktisiddhanta(?: sarasvati)?(?:[- ](?:thakura|gosvami(?: maharaja)?|prabhupada))?',
  },
  {
    id: 'haridasa', name: 'Haridāsa Ṭhākura', role: 'Nāmācārya, master of the holy name',
    about: 'Born in a Muslim family, he chanted three hundred thousand names of the Lord every day. Flogged in twenty-two marketplaces, he never stopped chanting. He passed away at Jagannātha Purī in Lord Caitanya\'s presence.',
    names: '(?:srila )?haridasa(?:[- ]thakura)?',
    read: cc(3, 3, 11),
  },
  {
    id: 'svarupa', name: 'Svarūpa Dāmodara Gosvāmī', role: 'Lord Caitanya\'s secretary at Purī',
    about: 'An expert in transcendental rasa, he sang to the Lord in His ecstasies and checked every book or song before it was presented to Him. He is Lalitā in Kṛṣṇa-līlā.',
    names: 'svarupa damodara(?:[- ]gosvami)?',
  },
  {
    id: 'ramananda', name: 'Rāmānanda Rāya', role: 'Governor and intimate associate of Lord Caitanya',
    about: 'Governor at Vidyānagara on the Godāvarī. Lord Caitanya questioned him and he explained the highest truths of devotion, culminating in Rādhā\'s love for Kṛṣṇa.',
    names: '(?:ramananda|raya ramananda)(?: raya)?',
    read: cc(2, 8),
  },
  {
    id: 'sarvabhauma', name: 'Sārvabhauma Bhaṭṭācārya', role: 'Logician at Purī who became Lord Caitanya\'s devotee',
    about: 'The leading Māyāvādī scholar at Purī. For seven days he taught the young Caitanya Vedānta; then the Lord explained the ātmārāma verse in eighteen ways and showed him His six-armed form, and he became a devotee.',
    names: 'sarvabhauma(?:[- ]bhattacarya)?',
    read: cc(2, 6),
  },
  {
    id: 'prakasananda', name: 'Prakāśānanda Sarasvatī', role: 'Māyāvādī leader at Benares',
    about: 'Leader of the Māyāvādī sannyāsīs of Benares, who criticized Lord Caitanya for chanting and dancing. The Lord defeated his arguments, and he and his followers became devotees.',
    names: 'prakasananda(?:[- ]sarasvati)?',
    read: [...cc(1, 7), ...cc(2, 25)],
  },
  {
    id: 'advaita', name: 'Advaita Ācārya', role: 'Member of the Pañca-tattva',
    about: 'An incarnation of Mahā-Viṣṇu who prayed for the Lord to come, offering tulasī and Ganges water to His śālagrāma. Lord Caitanya appeared in answer.',
    names: '(?:sri )?advaita(?:[- ]acarya|[- ]prabhu)',
  },
  {
    id: 'gadadhara', name: 'Gadādhara Paṇḍita', role: 'Member of the Pañca-tattva',
    about: 'Lord Caitanya\'s internal potency and lifelong companion; Śrīmatī Rādhārāṇī in Caitanya-līlā.',
    names: '(?:sri )?gadadhara(?:[- ]pandita)?',
  },
  {
    id: 'srivasa', name: 'Śrīvāsa Ṭhākura', role: 'Member of the Pañca-tattva',
    about: 'Lord Caitanya began His saṅkīrtana movement in Śrīvāsa\'s courtyard, where devotees gathered for kīrtana every night. He represents the pure devotees.',
    names: 'srivasa(?:[- ]thakura|[- ]pandita)?',
  },
  {
    id: 'madhavendra', name: 'Mādhavendra Purī', role: 'Root of the tree of devotion',
    about: 'A sannyāsī of the Madhva line and spiritual master of Īśvara Purī. Gopāla appeared to him at Govardhana, and Gopīnātha at Remuṇā stole condensed milk for him (Kṣīra-corā Gopīnātha).',
    names: 'madhavendra puri',
    read: cc(2, 4),
  },
  {
    id: 'isvara-puri', name: 'Īśvara Purī', role: 'Spiritual master of Lord Caitanya',
    about: 'A disciple of Mādhavendra Purī. Lord Caitanya accepted initiation from him at Gayā.',
    names: 'isvara puri',
  },
  {
    id: 'kesava-bharati', name: 'Keśava Bhāratī', role: 'Gave sannyāsa to Lord Caitanya',
    about: 'The Lord accepted sannyāsa from him at Katwa when He was twenty-four.',
    names: 'kesava bharati',
  },
  {
    id: 'jagai-madhai', name: 'Jagāi and Mādhāi', role: 'Two drunkards delivered by Lord Nityānanda',
    about: 'Brāhmaṇa brothers of Navadvīpa who lived as drunkards and rogues. Mādhāi struck Lord Nityānanda, but Nityānanda forgave them, and Lord Caitanya accepted them when they promised to give up their sins.',
    names: 'jagai(?: and madhai)?|madhai',
  },
  {
    id: 'kazi', name: 'Chand Kazi', role: 'Magistrate of Navadvīpa',
    about: 'He broke the devotees\' mṛdaṅga and forbade saṅkīrtana. Lord Caitanya led a huge kīrtana procession to his house, and after their discussion the Kazi promised never to stop saṅkīrtana.',
    names: 'chand kazi|kazi',
    read: cc(1, 17),
  },
  {
    id: 'saci', name: 'Śacīmātā', role: 'Mother of Lord Caitanya',
    about: 'Wife of Jagannātha Miśra. After her son took sannyāsa, at her request He made Jagannātha Purī His residence so she could get news of Him.',
    names: 'saci(?:[- ]?mata|[- ]?devi)',
  },
  {
    id: 'jagannatha-misra', name: 'Jagannātha Miśra', role: 'Father of Lord Caitanya',
    about: 'A brāhmaṇa of Navadvīpa from Sylhet, husband of Śacīdevī.',
    names: 'jagannatha misra',
  },
  {
    id: 'lokanatha', name: 'Lokanātha Gosvāmī', role: 'Spiritual master of Narottama dāsa Ṭhākura',
    about: 'An associate of Lord Caitanya sent to Vṛndāvana early on. He accepted only one disciple, Narottama dāsa Ṭhākura.',
    names: 'lokanatha(?:[- ]gosvami)',
  },
  {
    id: 'srinivasa', name: 'Śrīnivāsa Ācārya', role: 'Preacher who brought the Gosvāmīs\' books to Bengal',
    about: 'A student of Jīva Gosvāmī. With Narottama dāsa Ṭhākura and Śyāmānanda he carried the Gosvāmīs\' books to Bengal and Orissa.',
    names: 'srinivasa acarya',
  },
  {
    id: 'bilvamangala', name: 'Bilvamaṅgala Ṭhākura', role: 'Author of Kṛṣṇa-karṇāmṛta',
    about: 'Once infatuated with a prostitute, Cintāmaṇi, he was awakened by her words and became a great devotee. Lord Caitanya relished his Kṛṣṇa-karṇāmṛta.',
    names: 'bilvamangala(?:[- ]thakura)?',
  },
  {
    id: 'jayadeva', name: 'Jayadeva Gosvāmī', role: 'Author of Gīta-govinda',
    about: 'Poet of Bengal whose Gīta-govinda, on Rādhā and Kṛṣṇa, Lord Caitanya relished. His Daśāvatāra-stotra glorifies the ten incarnations.',
    names: 'jayadeva(?:[- ]gosvami)?',
  },
  {
    id: 'kulasekhara', name: 'King Kulaśekhara', role: 'Author of Mukunda-mālā-stotra',
    about: 'A king of South India and great devotee; Śrīla Prabhupāda often quotes his prayers.',
    names: '(?:king )?kulasekhara',
  },
  {
    id: 'yamunacarya', name: 'Yāmunācārya', role: 'Ācārya of the Śrī sampradāya',
    about: 'A king who renounced his throne, and Rāmānuja\'s predecessor; author of the Stotra-ratna. Śrīla Prabhupāda often quotes his verse: since my mind has been engaged in Kṛṣṇa\'s service, the thought of sex pleasure makes me spit.',
    names: 'yamunacarya',
  },
  {
    id: 'ramanuja', name: 'Rāmānujācārya', role: 'Ācārya of the Śrī sampradāya',
    about: 'He taught viśiṣṭādvaita, refuted Śaṅkara\'s impersonalism, and wrote the Śrī-bhāṣya on the Vedānta-sūtra. His line is one of the four Vaiṣṇava sampradāyas.',
    names: 'ramanujacarya|ramanuja',
  },
  {
    id: 'madhva', name: 'Madhvācārya', role: 'Ācārya of the Brahma sampradāya',
    about: 'He taught dvaita (duality of the Lord and the soul) against Māyāvāda. Lord Caitanya appeared in his line, called the Brahma-Madhva-Gauḍīya sampradāya.',
    names: 'madhvacarya|madhva',
  },
  {
    id: 'nimbarka', name: 'Nimbārka', role: 'Ācārya of the Kumāra sampradāya',
    about: 'He taught dvaitādvaita (simultaneous oneness and difference), coming in the line of the four Kumāras.',
    names: 'nimbarka(?:carya)?',
  },
  {
    id: 'visnusvami', name: 'Viṣṇusvāmī', role: 'Ācārya of the Rudra sampradāya',
    about: 'The ācārya of the sampradāya coming from Lord Śiva; Vallabhācārya is in his line.',
    names: 'visnusvami',
  },
  {
    id: 'sankara', name: 'Śaṅkarācārya', role: 'Incarnation of Lord Śiva; preacher of Māyāvāda',
    about: 'By the Lord\'s order he preached impersonalism to bring India back from Buddhism to Vedic authority. Still, he accepted Nārāyaṇa as beyond the material creation, and he taught "bhaja govindam" — worship Govinda.',
    names: 'sankaracarya',
    read: cc(1, 7),
  },
  {
    id: 'sridhara', name: 'Śrīdhara Svāmī', role: 'Commentator on the Bhāgavatam',
    about: 'Author of the Bhāvārtha-dīpikā commentary on the Bhāgavatam. Lord Caitanya said one who does not follow Śrīdhara Svāmī is not to be accepted.',
    names: 'sridhara svami',
    read: cc(3, 7),
  },
  {
    id: 'vallabha', name: 'Vallabhācārya', role: 'Ācārya of the Viṣṇusvāmī line',
    about: 'He visited Lord Caitanya at Purī and boasted that he had refuted Śrīdhara Svāmī; the Lord corrected him.',
    names: 'vallabhacarya|vallabha bhatta',
    read: cc(3, 7),
  },
];
