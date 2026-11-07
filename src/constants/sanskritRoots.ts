/**
 * Plain meanings of the verb roots (dhātu, √) the verses use most, worded the
 * way Śrīla Prabhupāda's word-for-word renders their forms ("pravadanti —
 * they say", "prapadyante — surrender"). Keys are SLP1 (see
 * services/sanskrit/sanskritTranslit.ts); a prefix's own effect is noted
 * where it changes the sense.
 */
export const ROOT_MEANINGS: Record<string, string> = {
  ah: 'to say', As: 'to sit; with upa-, to worship', Ap: 'to obtain, to achieve', aS: 'to eat, to taste',
  vah: 'to carry, to bear', as: 'to be', BU: 'to become, to be', Baj: 'to worship, to serve', Buj: 'to enjoy, to eat',
  car: 'to move, to act; with ā-, to practise', cint: 'to think', dA: 'to give', DA: 'to place, to hold',
  dfS: 'to see', gam: 'to go', grah: 'to take, to accept', hA: 'to give up', han: 'to kill',
  jan: 'to be born', jYA: 'to know', kf: 'to do, to make', kram: 'to step', kzip: 'to throw',
  laB: 'to obtain, to achieve', man: 'to think', mf: 'to die', muc: 'to release, to free',
  muh: 'to be bewildered', nI: 'to lead', niyam: 'to regulate, to control', pA: 'to drink',
  pad: 'to go; with pra-, to surrender', pat: 'to fall', puzp: 'to bloom', ruh: 'to grow, to rise',
  sTA: 'to stand, to stay', smf: 'to remember', spfS: 'to touch', sfj: 'to create', sU: 'to produce, to bring forth',
  Sru: 'to hear', tfp: 'to be satisfied', tyaj: 'to give up, to renounce', vac: 'to speak, to say',
  vad: 'to speak, to say', vid: 'to know', vft: 'to exist, to act, to turn', vfD: 'to grow, to increase',
  yA: 'to go', yam: 'to control', yudh: 'to fight', yuj: 'to join, to engage, to link',
  yuD: 'to fight', hf: 'to carry, to take', nud: 'to push, to drive away', saj: 'to cling, to be attached',
  buD: 'to know, to awaken', sf: 'to move, to flow', DI: 'to think',
};

/** A past participle's plain English, by prefix|root or root (SLP1). */
export const PARTICIPLE_ENGLISH: Record<string, string> = {
  hf: 'carried, taken', 'apa|hf': 'carried away, stolen', 'A|hf': 'brought, taken in', gam: 'gone',
  'A|gam': 'come', kf: 'done, made', vac: 'spoken', BU: 'become, being', jYA: 'known', 'vi|jYA': 'realised',
  yuj: 'engaged, joined', saj: 'attached', 'pra|saj': 'attached (to), addicted', dfS: 'seen', Sru: 'heard',
  muh: 'bewildered', 'vi|muh': 'bewildered', sTA: 'standing, situated', 'ava|sTA': 'situated', jan: 'born',
  'sam|ava|i': 'assembled', 'pra|kAS': 'manifested',
};

/**
 * The pronouns' own meanings and the stems their forms are built on, by
 * gender (SLP1). "yad → yā- (feminine) → yām" is spelt out from these.
 */
export const PRONOUNS: Record<string, { meaning: string; m?: string; f?: string; n?: string }> = {
  yad: { meaning: 'which, who (relative pronoun)', m: 'ya', f: 'yA', n: 'ya' },
  tad: { meaning: 'that; he, she, it', m: 'ta', f: 'tA', n: 'ta' },
  idam: { meaning: 'this', m: 'ima', f: 'imA', n: 'ima' },
  etad: { meaning: 'this (here)', m: 'eta', f: 'etA', n: 'eta' },
  sarva: { meaning: 'all', m: 'sarva', f: 'sarvA', n: 'sarva' },
  anya: { meaning: 'other, else', m: 'anya', f: 'anyA', n: 'anya' },
  kim: { meaning: 'what, who (question)', m: 'ka', f: 'kA', n: 'ka' },
  asmad: { meaning: 'I, we (first person)' },
  yuṣmad: { meaning: 'you (second person)' },
};

/**
 * The upasargas (verb prefixes, Pāṇini 1.4.58–59: prādayaḥ, upasargāḥ
 * kriyā-yoge) with their basic sense and a familiar example. Keys are SLP1.
 */
export const UPASARGA_INFO: Record<string, { sense: string; example: string }> = {
  pra: { sense: 'forward, forth', example: 'pra-vad — proclaim' },
  parA: { sense: 'away, back', example: 'parā-jaya — defeat' },
  apa: { sense: 'away, off', example: 'apa-harati — takes away' },
  sam: { sense: 'together, fully', example: 'saṁ-gacchati — meets' },
  anu: { sense: 'after, along', example: 'anu-gacchati — follows' },
  ava: { sense: 'down', example: 'ava-tarati — comes down (avatāra)' },
  nis: { sense: 'out, without', example: 'nir-gacchati — goes out' },
  nir: { sense: 'out, without', example: 'nir-gacchati — goes out' },
  dus: { sense: 'bad, difficult', example: 'dur-jana — a bad person' },
  dur: { sense: 'bad, difficult', example: 'dur-jana — a bad person' },
  vi: { sense: 'apart, special', example: 'vi-jñāna — special knowledge' },
  A: { sense: 'towards, up to', example: 'ā-gacchati — comes' },
  ni: { sense: 'down, into', example: 'ni-vasati — dwells' },
  aDi: { sense: 'over, upon', example: 'adhi-gacchati — attains' },
  api: { sense: 'on, near', example: 'api-dhāna — covering' },
  ati: { sense: 'beyond, too much', example: 'ati-krāmati — goes beyond' },
  su: { sense: 'good, well', example: 'su-kara — easy to do' },
  ut: { sense: 'up', example: 'ut-tiṣṭhati — stands up' },
  ud: { sense: 'up', example: 'ut-tiṣṭhati — stands up' },
  aBi: { sense: 'towards, facing', example: 'abhi-mukha — facing' },
  prati: { sense: 'back, against', example: 'prati-vadati — answers back' },
  pari: { sense: 'around, fully', example: 'pari-krāmati — walks around' },
  upa: { sense: 'near', example: 'upa-gacchati — approaches' },
};

/** What prefix + root means together, where it differs from the root. Keys
 * "prefix|root" in SLP1. */
export const PREFIXED_MEANINGS: Record<string, string> = {
  'apa|hf': 'to carry away, to steal',
  'apa|nud': 'to drive away, to remove',
  'pra|saj': 'to become attached',
  'ava|Ap': 'to obtain',
  'pra|vad': 'to speak out, to proclaim',
  'pra|vac': 'to explain, to declare',
  'pra|pad': 'to surrender',
  'pra|Ap': 'to attain, to achieve',
  'pra|sU': 'to bring forth, to prosper',
  'pari|upa|As': 'to worship fully',
  'upa|As': 'to worship',
  'sam|ni|yam': 'to control completely',
  'aBi|jYA': 'to know fully',
  'A|car': 'to practise, to act',
  'vi|jYA': 'to know specifically, to realise',
  'anu|gam': 'to follow',
  'A|gam': 'to come',
  'ava|tF': 'to come down, to descend',
  'pari|tyaj': 'to give up completely',
};
