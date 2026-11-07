/**
 * What each member of a frequent epithet compound means *in that compound*,
 * where a member's usual sense would mislead ("para" alone is "supreme";
 * in param-tapa it is "the enemy"). Keys are the compound as Śrīla
 * Prabhupāda lists it, without its ending, lower-case IAST; values are the
 * members' senses in order. His meaning of the whole compound stays the
 * authority; these only explain its parts.
 */
export const COMPOUND_MEMBERS: Record<string, string[]> = {
  'param-tapa': ['the enemy (para, "other"), as the object', 'one who scorches, torments (from √tap)'],
  'paran-tapa': ['the enemy (para, "other"), as the object', 'one who scorches, torments (from √tap)'],
  'dhanam-jaya': ['wealth', 'conqueror, winner (from √ji)'],
  'mahā-bāho': ['great, mighty', 'armed (bāhu, arm)'],
  'mahā-bāhu': ['great, mighty', 'armed (bāhu, arm)'],
  'puruṣa-ṛṣabha': ['among men', 'the best (ṛṣabha, a bull)'],
  'bharata-ṛṣabha': ['of the Bhāratas', 'the best (ṛṣabha, a bull)'],
  'kuru-nandana': ['of the Kurus', 'the beloved child, the delight'],
  'pāṇḍu-putra': ['of Pāṇḍu', 'son'],
  'kuntī-putra': ['of Kuntī', 'son'],
  'śrī-bhagavān': ['the beautiful, opulent', 'the Supreme Personality of Godhead'],
};
