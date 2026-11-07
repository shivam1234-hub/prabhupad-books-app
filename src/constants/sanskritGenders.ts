/**
 * The fixed gender of common nouns of the verses (SLP1 stem → m / f / n),
 * where Apte's entry leads with an adjective sense ("indriya, a. belonging to
 * Indra … n. a sense") and so doesn't settle it. A noun has one gender; these
 * are the standard ones.
 */
export const NOUN_GENDER: Record<string, 'm' | 'f' | 'n'> = {
  indriya: 'n', karman: 'n', janman: 'n', nAman: 'n', brahman: 'n', manas: 'n', cetas: 'n', tapas: 'n',
  jYAna: 'n', vijYAna: 'n', sukha: 'n', duHKa: 'n', citta: 'n', hfdaya: 'n', SarIra: 'n', Pala: 'n',
  pApa: 'n', puRya: 'n', rAjya: 'n', ADipatya: 'n', vacas: 'n', karma: 'n', bala: 'n', Bala: 'n', Buvana: 'n',
  jagat: 'n', Darma: 'm', yoga: 'm', Atman: 'm', deha: 'm', loka: 'm', kAma: 'm', kroDa: 'm', guRa: 'm',
  prARa: 'm', puruza: 'm', deva: 'm', sura: 'm', asura: 'm', Soka: 'm', moha: 'm', Bakta: 'm', muni: 'm',
  buddDi: 'f', buddhi: 'f', Bakti: 'f', vidyA: 'f', gati: 'f', vAc: 'f', prakfti: 'f', Sakti: 'f', mAyA: 'f',
  BUmi: 'f', mati: 'f', smfti: 'f', Sraddha: 'f', SraddhA: 'f', kriyA: 'f', senA: 'f',
  // Nominative forms that the glossary lists as terms: their stems' gender.
  AtmA: 'm', brahmA: 'm', rAjA: 'm',
  // Names of persons: masculine.
  kfzRa: 'm', arjuna: 'm', pArTa: 'm', hfzIkeSa: 'm', govinda: 'm', keSava: 'm', mADava: 'm', janArdana: 'm',
  maDusUdana: 'm', acyuta: 'm', vAsudeva: 'm', saYjaya: 'm', DftarAzwra: 'm', guqAkeSa: 'm', Darmaputra: 'm',
  BIzma: 'm', droRa: 'm', duryoDana: 'm', yuDizWira: 'm', BIma: 'm', kOnteya: 'm', BArata: 'm', parantapa: 'm',
  tapa: 'm', DanaMjaya: 'm', DanaYjaya: 'm', mahAbAhu: 'm',
};
