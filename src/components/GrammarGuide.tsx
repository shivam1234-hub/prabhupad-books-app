import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import type { ColorScheme } from '@/constants/colors';
import {
  CASES, GENDERS, NUMBERS, PARADIGMS, PERSONS, VERB_ENDINGS, paradigmTable,
} from '@/services/sanskrit/sanskritGrammar';
import { UPAPADA } from '@/services/sanskrit/sentenceRules';
import { slp1ToIast } from '@/services/sanskrit/sanskritTranslit';

/**
 * A reader's guide to the labels the word analysis uses: the three things a
 * noun's ending carries (liṅga, vacana, vibhakti), each declension's full
 * table, a "if it ends with…" lookup, verb endings, and the sandhi rules.
 *
 * The declension tables and verb endings are rendered from
 * services/sanskrit/sanskritGrammar.ts — the same data the analysis reads endings with —
 * so the guide always teaches exactly what the analysis applies.
 */

// "If a word ends with…": the endings a reader meets most, with their usual
// reading. Curated (rather than generated) so the commonest reading of each
// ambiguous ending comes first.
const ENDING_HINTS: [ending: string, reading: string, example: string][] = [
  ['-aḥ', 'nominative singular (masculine -a)', 'rāmaḥ — Rāma (does something)'],
  ['-āḥ', 'nominative plural; also vocative plural, or feminine accusative plural', 'svarga-parāḥ — those who …'],
  ['-am', 'accusative singular (masculine); nominative / accusative (neuter)', 'phalam, vācam'],
  ['-ām', 'accusative singular (feminine -ā)', 'puṣpitām, imām'],
  ['-ān', 'accusative plural (masculine)', 'dharmān — duties (object)'],
  ['-ena / -eṇa', 'instrumental singular — by, with', 'rāmeṇa, karmaṇā'],
  ['-aiḥ / -ābhiḥ', 'instrumental plural', 'devaiḥ — by the demigods'],
  ['-āya / -āyai', 'dative singular — for, to', 'rāmāya — for Rāma'],
  ['-āt', 'ablative singular — from', 'rāmāt — from Rāma'],
  ['-asya', 'genitive singular — of', 'rāmasya — Rāma\'s'],
  ['-ānām / -āṇām', 'genitive plural — of them', 'devānām — of the demigods'],
  ['-e', 'locative singular — in, on (masculine / neuter -a)', 'kuru-kṣetre — at Kurukṣetra'],
  ['-eṣu / -āsu', 'locative plural', 'sarveṣu — in all'],
  ['-au', 'dual — two of them (nominative, accusative, vocative)', 'rāmau — the two'],
  ['bare -a', 'vocative of a masculine name — calling', 'pārtha — O Pārtha!'],
];

const SANDHI_RULES: [name: string, what: string, example: string][] = [
  ['Savarṇa-dīrgha', 'two like vowels merge into one long vowel', 'na + anyat → nānyat; asti + iti → astīti'],
  ['Guṇa', 'a/ā + i/ī → e, a/ā + u/ū → o, a/ā + ṛ → ar', 'kṛṣṇa + iti → kṛṣṇeti'],
  ['Vṛddhi', 'a/ā + e/ai → ai, a/ā + o/au → au', 'ca + eva → caiva; bhoga + aiśvarya → bhogaiśvarya'],
  ['Yaṇ', 'i/ī → y, u/ū → v before an unlike vowel', 'pravadanti + a… → pravadanty a…'],
  ['Ayādi', 'e → ay, o → av, ai → āy, au → āv before a vowel', ''],
  ['Visarga', '-aḥ → -o before a voiced sound; -ḥ → -ś / -s before c / t; -āḥ drops before a voiced sound', 'prājñaḥ → prājño; pāṇḍavāḥ ca → pāṇḍavāś ca'],
  ['Jaśtva', 'a final consonant turns voiced before a voiced sound', 'anyat asti → anyad asti; tat api → tad api'],
  ['Anusvāra', 'final m → ṁ before a consonant', 'vācam pravadanti → vācaṁ pravadanti'],
  ['Parasavarṇa', 'ṁ / n takes the nasal of the next consonant', 'sam + kalpa → saṅkalpa'],
  ['Avagraha (\')', 'initial a- drops after -e / -o and is marked \'', 'dehinaḥ asmin → dehino \'smin'],
  ['Samāsa', 'a compound: words joined, only the last takes an ending', 'veda-vāda-ratāḥ'],
];

type Section = 'basics' | 'tables' | 'endings' | 'verbs' | 'upasarga' | 'sentences' | 'sandhi';
const SECTIONS: [Section, string][] = [
  ['basics', 'Basics'], ['tables', 'Tables'], ['endings', 'Endings'], ['verbs', 'Verbs'], ['upasarga', 'Upasarga'],
  ['sentences', 'Sentences'], ['sandhi', 'Sandhi'],
];

// The sentence rules (numbers match the verse analysis's "Sentence rules").
const SENTENCE_RULES: { no: number; title: string; body: string; examples: string[] }[] = [
  {
    no: 1, title: 'The verb follows the doer (kartā–kriyā agreement)',
    body: 'The verb takes the same person and number as the subject — the 1st-vibhakti word.',
    examples: ['bālakaḥ paṭhati — one boy reads', 'bālakau paṭhataḥ — two boys read', 'bālakāḥ paṭhanti — many boys read',
      'Two subjects joined with ca take a dual verb: rāmaḥ lakṣmaṇaḥ ca gacchataḥ — Rāma and Lakṣmaṇa go'],
  },
  {
    no: 2, title: 'Adjectives copy their noun',
    body: 'A describing word takes the same gender, number and vibhakti as its noun.',
    examples: ['puṣpitām vācam — flowery speech (both feminine accusative singular)'],
  },
  {
    no: 3, title: 'Two names for the same thing share the vibhakti (samānādhikaraṇa)',
    body: 'When two nouns refer to the same person or thing, they take the same vibhakti.',
    examples: ['kṛṣṇaḥ bhagavān uvāca — Kṛṣṇa, the Lord, said (both nominative)',
      'avipaścitaḥ … vādinaḥ — the same people, so both nominative plural (BG 2.42)'],
  },
  {
    no: 4, title: 'Some words fix the vibhakti (upapada-vibhakti)',
    body: 'Certain words always take a particular vibhakti on the noun beside them, whatever its role would otherwise be. See the table below.',
    examples: ['bhogaiśvarya-gatiṁ prati — gatim is accusative because of prati, not because it is the object of "speak" (BG 2.43)'],
  },
  {
    no: 5, title: 'In a passive sentence the roles swap (karmaṇi prayoga)',
    body: 'The doer moves to the 3rd vibhakti, the object to the 1st, and the verb agrees with the object — which is why the 1st vibhakti is not always the doer.',
    examples: ['Active: rāmaḥ granthaṁ paṭhati — Rāma reads the book', 'Passive: rāmeṇa granthaḥ paṭhyate — the book is read by Rāma'],
  },
  {
    no: 6, title: 'Pronoun pairs: yad … tad',
    body: 'A relative pronoun (yad, "which / who") is usually answered by tad ("that / he"). Each takes the gender and number of its noun, but its vibhakti comes from its own clause.',
    examples: ['yaḥ paṭhati saḥ jānāti — he who reads, he knows', 'yaṁ paśyasi saḥ rāmaḥ — the one whom you see is Rāma',
      'yām (BG 2.42) points to vācam; its partner comes in 2.44'],
  },
  {
    no: 7, title: 'Participles act like adjectives',
    body: 'A participle is a verb turned into an adjective ("blossomed", "speaking"), so it follows rule 2 and copies its noun.',
    examples: ['puṣpitām vācam — blossomed speech', 'gacchantaḥ bālakāḥ — going boys'],
  },
  {
    no: 8, title: 'Word order is free',
    body: 'The endings carry the meaning, so words can stand in almost any order — which is why a verse can place yām imām … vācam far from pravadanti.',
    examples: ['rāmaḥ rāvaṇaṁ hanti = rāvaṇaṁ rāmaḥ hanti = hanti rāmaḥ rāvaṇam — Rāma kills Rāvaṇa'],
  },
  {
    no: 9, title: 'Small particles have fixed positions',
    body: 'ca, iti, api and eva come after the word they belong to.',
    examples: ['ca: rāmaḥ lakṣmaṇaḥ ca — Rāma and Lakṣmaṇa', 'iti: na anyad asti iti — "there is nothing else", thus',
      'api: aham api — I also', 'eva: karmaṇi eva — in action only (BG 2.47)'],
  },
];

const RULE_SUMMARY: [string, string][] = [
  ['Subject–verb agreement', 'the verb copies the subject\'s person and number'],
  ['Adjective agreement', 'the adjective copies its noun\'s gender, number and vibhakti'],
  ['Same-thing agreement', 'two names for one thing share the vibhakti'],
  ['Fixed-vibhakti words', 'prati → 2nd, saha → 3rd, namaḥ → 4th, and so on'],
  ['Passive', 'doer → 3rd, object → 1st'],
  ['yad … tad', 'the relative takes its noun\'s gender and number, and its own clause\'s vibhakti'],
  ['Participles', 'behave like adjectives'],
  ['Free word order', 'endings, not position, decide meaning'],
  ['Particles', 'ca, iti, api and eva come after the word'],
];

// Verb (tiṅ) endings next to noun (vibhakti / sup) endings.
const VERB_VS_NOUN: [aspect: string, noun: string, verb: string][] = [
  ['Goes on', 'nouns, pronouns, adjectives', 'verbs'],
  ['Answers', 'what role the word plays (who / what / by what / where …)', 'who does the action, and when'],
  ['Shows', 'case (vibhakti) + number', 'person (he / you / I) + number + tense'],
  ['Grid', '8 cases × 3 numbers', '3 persons × 3 numbers, one table per tense'],
  ['Endings', '-aḥ, -am, -ena, -āya, -āt, -asya, -e', '-ti, -taḥ, -nti, -si, -thaḥ, -tha, -āmi, -āvaḥ, -āmaḥ'],
  ['Example', 'rāmaḥ, rāmam, rāmeṇa', 'vadati, vadanti, vadāmi'],
];

const AGREEMENT: [doer: string, verb: string][] = [
  ['rāmaḥ (one — "he")', 'vadati'],
  ['rāmau (two)', 'vadataḥ'],
  ['avipaścitaḥ (many — "they")', 'pravadanti'],
  ['aham (I)', 'vadāmi'],
  ['tvam (you)', 'vadasi'],
];

// One entry per upasarga for the list (nis/nir and dus/dur shown together).
const UPASARGA_LIST: [string, string, string][] = [
  ['pra', 'forward, forth', 'pra-vad — proclaim'], ['parā', 'away, back', 'parā-jaya — defeat'],
  ['apa', 'away, off', 'apa-harati — takes away'], ['sam', 'together, fully', 'saṁ-gacchati — meets'],
  ['anu', 'after, along', 'anu-gacchati — follows'], ['ava', 'down', 'ava-tarati — comes down (avatāra)'],
  ['nis / nir', 'out, without', 'nir-gacchati — goes out'], ['dus / dur', 'bad, difficult', 'dur-jana — a bad person'],
  ['vi', 'apart, special', 'vi-jñāna — special knowledge'], ['ā (āṅ)', 'towards, up to', 'ā-gacchati — comes'],
  ['ni', 'down, into', 'ni-vasati — dwells'], ['adhi', 'over, upon', 'adhi-gacchati — attains'],
  ['api', 'on, near', 'api-dhāna — covering'], ['ati', 'beyond, too much', 'ati-krāmati — goes beyond'],
  ['su', 'good, well', 'su-kara — easy to do'], ['ut (ud)', 'up', 'ut-tiṣṭhati — stands up'],
  ['abhi', 'towards, facing', 'abhi-mukha — facing'], ['prati', 'back, against', 'prati-vadati — answers back'],
  ['pari', 'around, fully', 'pari-krāmati — walks around'], ['upa', 'near', 'upa-gacchati — approaches'],
];

// Same root √hṛ (to carry, take), different prefixes.
const HR_WORDS: [string, string, string][] = [
  ['hāra', '√hṛ', 'carrying (a garland)'], ['prahāra', 'pra + √hṛ', 'a strike, attack'],
  ['āhāra', 'ā + √hṛ', 'food ("taken in")'], ['saṁhāra', 'sam + √hṛ', 'destruction'],
  ['vihāra', 'vi + √hṛ', 'wandering for pleasure'], ['parihāra', 'pari + √hṛ', 'avoidance, remedy'],
];

const UPASARGA_RULES = [
  'It always comes before the root: pra + vad, never vad + pra.',
  'Ordinary sandhi applies at the join: pra + ā + gacchati → prāgacchati; ut + gacchati → udgacchati.',
  'In the past tense the past-marker a- goes between the upasarga and the root: vadati → avadat, but pravadati → prāvadat (not apravadat).',
  'n can become ṇ after pra, pari and similar prefixes (the r causes it): pra + namati → praṇamati (from which praṇām).',
  'Two or more can stack: sam + ā + gacchati → samāgacchati; samavetāḥ = sam + ava + ita, "assembled" (BG 1.1).',
];

export function GrammarGuide({ accentColor }: { accentColor: string }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fs = useSettingsStore(s => s.settings.fontScale ?? 1);
  const [section, setSection] = useState<Section>('basics');
  const [paradigmId, setParadigmId] = useState(PARADIGMS[0].id);
  const paradigm = PARADIGMS.find(p => p.id === paradigmId) ?? PARADIGMS[0];
  const t = (size: number) => ({ fontSize: size * fs, lineHeight: size * fs * 1.45 });

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {SECTIONS.map(([id, label]) => (
          <TouchableOpacity
            key={id}
            onPress={() => setSection(id)}
            style={[styles.tab, section === id && { borderColor: accentColor, backgroundColor: accentColor + '1f' }]}
          >
            <Text style={[styles.tabText, t(13), section === id && { color: accentColor }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {section === 'basics' && (
        <View>
          <Text style={[styles.p, t(14)]}>
            A Sanskrit noun's ending shows three things at once: its gender (liṅga), its number (vacana) and
            its case (vibhakti) — the role it plays in the sentence. English shows the role with word order and
            words like "of" or "to"; Sanskrit shows it in the ending.
          </Text>
          <Text style={[styles.h, t(12)]}>GENDER · LIṄGA</Text>
          {Object.values(GENDERS).map(g => (
            <Text key={g.english} style={[styles.row, t(14)]}><Text style={styles.term}>{g.english}</Text> · {g.sanskrit}</Text>
          ))}
          <Text style={[styles.h, t(12)]}>NUMBER · VACANA</Text>
          {NUMBERS.map((n, i) => (
            <Text key={n.english} style={[styles.row, t(14)]}>
              <Text style={styles.term}>{n.english}</Text> · {n.sanskrit} — {['one', 'exactly two', 'three or more'][i]}
            </Text>
          ))}
          <Text style={[styles.h, t(12)]}>CASE · VIBHAKTI</Text>
          {CASES.map(k => (
            <View key={k.no} style={styles.caseRow}>
              <Text style={[styles.caseNo, t(13), { color: accentColor }]}>{k.no}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.row, t(14)]}>
                  <Text style={styles.term}>{k.english}</Text> · {k.sanskrit} · {k.hindi}
                </Text>
                <Text style={[styles.dim, t(13)]}>{k.role} ({k.sign})</Text>
              </View>
            </View>
          ))}
          <Text style={[styles.p, t(13), { marginTop: 10 }]}>
            So "feminine, accusative singular" (vācam) reads: a feminine word · the object of the sentence · one of it.
          </Text>
        </View>
      )}

      {section === 'tables' && (
        <View>
          <Text style={[styles.p, t(13)]}>
            Which table a word follows depends on how its dictionary form (stem) ends. Pick a pattern:
          </Text>
          <View style={styles.chips}>
            {PARADIGMS.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setParadigmId(p.id)}
                style={[styles.chip, p.id === paradigmId && { borderColor: accentColor, backgroundColor: accentColor + '1f' }]}
              >
                <Text style={[styles.chipText, t(12), p.id === paradigmId && { color: accentColor }]}>
                  {p.title} · {p.model}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View>
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.tdCase, styles.th, t(11)]}>vibhakti</Text>
              {NUMBERS.map(n => <Text key={n.english} style={[styles.td, styles.th, t(11)]}>{n.english}</Text>)}
            </View>
            {paradigmTable(paradigm).map((row, i) => (
              <View key={i} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                <Text style={[styles.tdCase, t(11)]}>{i + 1} {CASES[i].english}</Text>
                {row.map((cell, j) => <Text key={j} style={[styles.td, styles.form, t(12)]}>{cell}</Text>)}
              </View>
            ))}
          </View>
          <Text style={[styles.dim, t(12), { marginTop: 8 }]}>Also: {paradigm.examples}</Text>
        </View>
      )}

      {section === 'endings' && (
        <View>
          <Text style={[styles.p, t(13)]}>
            A quick reverse lookup. An ending can fit more than one case, so the word's meaning in the verse
            settles it — the analysis uses Śrīla Prabhupāda's translation for that.
          </Text>
          {ENDING_HINTS.map(([ending, reading, example]) => (
            <View key={ending} style={styles.hintRow}>
              <Text style={[styles.hintEnding, t(14), { color: accentColor }]}>{ending}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.row, t(14)]}>{reading}</Text>
                <Text style={[styles.dim, t(12)]}>{example}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {section === 'verbs' && (
        <View>
          <Text style={[styles.p, t(13)]}>
            A verb's ending shows person (puruṣa), number and tense (lakāra). Sanskrit counts persons the other
            way round from English:
          </Text>
          {([3, 2, 1] as const).map(pn => (
            <Text key={pn} style={[styles.row, t(14)]}>
              <Text style={styles.term}>{PERSONS[pn].english}</Text> · {PERSONS[pn].sanskrit} — {PERSONS[pn].who}
            </Text>
          ))}
          <Text style={[styles.h, t(12)]}>ENDINGS</Text>
          {VERB_ENDINGS.map(v => (
            <View key={v.ending} style={styles.hintRow}>
              <Text style={[styles.hintEnding, t(14), { color: accentColor }]}>-{slp1ToIast(v.ending)}</Text>
              <Text style={[styles.row, t(14), { flex: 1 }]}>
                {v.form ?? `${v.tense}, ${PERSONS[v.person!].english} ${NUMBERS[v.number!].english}`}
              </Text>
            </View>
          ))}
          <Text style={[styles.p, t(13), { marginTop: 8 }]}>
            A root (dhātu, √) is the seed a verb grows from — √vad, to speak. A prefix (upasarga) in front adjusts
            it: pra + √vad, to proclaim. Between the root and the ending most verbs add a connecting vowel
            (vikaraṇa) a: vad + a = vada-, then + nti = vadanti, "they speak". Grammar books write that ending -anti
            (Pāṇini's jhi → anti, 7.1.3); the two a's merge, so only -nti shows.
          </Text>

          <Text style={[styles.h, t(12)]}>VERB ENDINGS VS VIBHAKTI</Text>
          <Text style={[styles.p, t(13)]}>
            Both are endings, but they go on different words and answer different questions. A verb has no
            vibhakti: it is the action itself, and every other word takes its role in relation to it.
          </Text>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.tdCase, styles.th, t(11)]}> </Text>
            <Text style={[styles.td, styles.th, t(11)]}>vibhakti (sup)</Text>
            <Text style={[styles.td, styles.th, t(11)]}>verb (tiṅ)</Text>
          </View>
          {VERB_VS_NOUN.map(([aspect, noun, verb], i) => (
            <View key={aspect} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
              <Text style={[styles.tdCase, t(11)]}>{aspect}</Text>
              <Text style={[styles.td, t(11)]}>{noun}</Text>
              <Text style={[styles.td, t(11)]}>{verb}</Text>
            </View>
          ))}
          <Text style={[styles.h, t(12)]}>AGREEMENT</Text>
          <Text style={[styles.p, t(13)]}>
            The doer (1st vibhakti) and the verb ending must match in number and person:
          </Text>
          {AGREEMENT.map(([doer, verb]) => (
            <Text key={doer} style={[styles.row, t(14)]}>
              <Text style={styles.term}>{doer}</Text>  →  <Text style={styles.form}>{verb}</Text>
            </Text>
          ))}
          <Text style={[styles.dim, t(12), { marginTop: 6 }]}>
            Pāṇini calls both sets "vibhakti" (1.4.104, vibhaktiś ca); in everyday teaching "vibhakti" means the
            noun case endings, and verb endings are called tiṅ.
          </Text>
        </View>
      )}

      {section === 'sentences' && (
        <View>
          <Text style={[styles.p, t(13)]}>
            Once the words are separated, these rules put the sentence back together. Rules 1, 2 and 4 alone explain
            most Gītā verses. The verse analysis points out which ones are at work in the verse you are reading.
          </Text>
          {SENTENCE_RULES.map(r => (
            <View key={r.no} style={styles.ruleRow}>
              <Text style={[styles.term, t(14), { color: accentColor }]}>{r.no}. {r.title}</Text>
              <Text style={[styles.row, t(13)]}>{r.body}</Text>
              {r.examples.map((e, i) => <Text key={i} style={[styles.dim, t(12)]}>• {e}</Text>)}
              {r.no === 4 && (
                <View style={{ marginTop: 6 }}>
                  {UPAPADA.map(u => (
                    <View key={u.word} style={styles.hintRow}>
                      <Text style={[styles.hintEnding, t(13), { color: accentColor }]}>{u.word}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.row, t(13)]}>{u.sense} → {u.forces.join(' / ')}</Text>
                        <Text style={[styles.dim, t(12)]}>{u.example}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          <Text style={[styles.h, t(12)]}>QUICK SUMMARY</Text>
          {RULE_SUMMARY.map(([rule, line], i) => (
            <Text key={rule} style={[styles.row, t(13), { marginBottom: 3 }]}>
              <Text style={styles.term}>{i + 1}. {rule}</Text> — {line}
            </Text>
          ))}
        </View>
      )}

      {section === 'upasarga' && (
        <View>
          <Text style={[styles.p, t(13)]}>
            An upasarga is a small prefix placed before a verb root to change or add to its meaning. Pāṇini:
            prādayaḥ (1.4.58) — pra and a fixed list of words form a group; upasargāḥ kriyā-yoge (1.4.59) — they
            are called upasarga when joined to a verb. So pra is an upasarga in pra + vad → pravadati.
          </Text>
          <Text style={[styles.h, t(12)]}>THE UPASARGAS</Text>
          {UPASARGA_LIST.map(([u, sense, ex]) => (
            <View key={u} style={styles.hintRow}>
              <Text style={[styles.hintEnding, t(14), { color: accentColor }]}>{u}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.row, t(14)]}>{sense}</Text>
                <Text style={[styles.dim, t(12)]}>{ex}</Text>
              </View>
            </View>
          ))}
          <Text style={[styles.dim, t(12)]}>Counted as 22 because nis/nir and dus/dur are each counted twice.</Text>

          <Text style={[styles.h, t(12)]}>WHAT AN UPASARGA DOES</Text>
          <Text style={[styles.form, t(14)]}>upasargeṇa dhātv-artho balād anyatra nīyate</Text>
          <Text style={[styles.form, t(14)]}>prahārāhāra-saṁhāra-vihāra-parihāravat</Text>
          <Text style={[styles.p, t(13), { marginTop: 4 }]}>
            "An upasarga forcibly carries the root's meaning elsewhere — as in prahāra, āhāra, saṁhāra, vihāra,
            parihāra." All use the same root √hṛ (to carry, take):
          </Text>
          {HR_WORDS.map(([w, parts, m]) => (
            <Text key={w} style={[styles.row, t(14)]}>
              <Text style={styles.term}>{w}</Text> · {parts} — {m}
            </Text>
          ))}
          <Text style={[styles.p, t(13), { marginTop: 6 }]}>
            So an upasarga either changes the meaning completely (hāra → āhāra, carrying → food), strengthens or
            adds to it (vad → pra-vad, speak → proclaim), or barely changes it.
          </Text>

          <Text style={[styles.h, t(12)]}>RULES FOR JOINING</Text>
          {UPASARGA_RULES.map((r, i) => (
            <Text key={i} style={[styles.row, t(13), { marginBottom: 4 }]}>• {r}</Text>
          ))}
        </View>
      )}

      {section === 'sandhi' && (
        <View>
          <Text style={[styles.p, t(13)]}>
            Sandhi is the change sounds undergo where words meet. Sandhi-viccheda undoes it to show the separate words.
          </Text>
          {SANDHI_RULES.map(([name, what, example]) => (
            <View key={name} style={styles.ruleRow}>
              <Text style={[styles.term, t(14), { color: accentColor }]}>{name}</Text>
              <Text style={[styles.row, t(14)]}>{what}</Text>
              {!!example && <Text style={[styles.dim, t(12)]}>{example}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ColorScheme) => StyleSheet.create({
  tabs: { gap: 8, paddingBottom: 12 },
  tab: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  tabText: { color: c.textSecondary, fontWeight: '600' },
  p: { color: c.text, marginBottom: 8 },
  h: { color: c.primary, fontWeight: '800', letterSpacing: 1.2, marginTop: 12, marginBottom: 4 },
  row: { color: c.text },
  term: { color: c.text, fontWeight: '700' },
  dim: { color: c.textMuted },
  caseRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  caseNo: { fontWeight: '800', minWidth: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: c.textSecondary },
  tr: { flexDirection: 'row', paddingVertical: 5 },
  trAlt: { backgroundColor: c.surfaceElevated },
  thead: { borderBottomWidth: 1, borderColor: c.border },
  th: { color: c.textMuted, fontWeight: '700' },
  // Flex columns so the whole table fits a phone without sideways scrolling.
  tdCase: { flex: 1.15, color: c.textSecondary, paddingHorizontal: 3 },
  td: { flex: 1, color: c.text, paddingHorizontal: 3 },
  form: { fontStyle: 'italic', color: c.text },
  hintRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  hintEnding: { fontWeight: '700', fontStyle: 'italic', minWidth: 92 },
  ruleRow: { marginBottom: 10 },
});
