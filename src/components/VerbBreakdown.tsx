import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import type { VerbView } from '@/services/dictionary';
import { NUMBERS, PERSONS } from '@/services/sanskrit/sanskritGrammar';

/** Who the ending says is acting, by person row (3rd, 2nd, 1st) × number. */
const WHO = [
  ['he / she / it', 'the two', 'they'],
  ['you', 'you two', 'you all'],
  ['I', 'we two', 'we'],
];
const ROW_OF = { 3: 0, 2: 1, 1: 2 } as const;

/**
 * A verb taken apart the way a teacher does it on the board:
 *   pra (upasarga) + vad (dhātu) + a (vikaraṇa) + nti (tiṅ ending) = pravadanti
 * then what the prefix does to the root, notes (the "-anti" spelling …), the
 * whole table of the verb in this tense with the verse's form marked, and —
 * when the caller knows it — which doer in the verse the ending agrees with.
 */
export function VerbBreakdown({ verb, form, agreement }: { verb: VerbView; form: string; agreement?: string | null }) {
  const { colors: c } = useTheme();
  const fs = useSettingsStore(s => s.settings.fontScale ?? 1);
  const t = (n: number) => ({ fontSize: n * fs, lineHeight: n * fs * 1.45 });
  const row = ROW_OF[verb.person];
  const who = WHO[row][verb.number];

  const pieces: { text: string; label: string }[] = [
    ...verb.upasargas.map(u => ({ text: u.prefix, label: `upasarga${u.sense ? ` — ${u.sense}` : ''}` })),
    // A substitute stem (paśya- for √dṛś, u-vāc- in the perfect) stands in
    // for root + connecting vowel; the root is still named with its meaning.
    verb.substitute
      ? { text: verb.substitute.text, label: `${verb.substitute.label}. Root: √${verb.root}${verb.rootMeaning ? ` — ${verb.rootMeaning}` : ''}` }
      : { text: verb.root, label: `dhātu (root)${verb.rootMeaning ? ` — ${verb.rootMeaning}` : ''}` },
    ...(verb.marker ? [{ text: verb.marker.text, label: verb.marker.label }] : []),
    { text: verb.tin, label: `tiṅ ending — ${PERSONS[verb.person].english} ${NUMBERS[verb.number].english}, "${who}"` },
  ].filter(p => p.text);

  return (
    <View style={[styles.box, { borderColor: c.border }]}>
      <Text style={[styles.head, t(11), { color: c.primary }]}>HOW THE VERB IS BUILT</Text>
      <Text style={[styles.equation, t(14), { color: c.text }]}>
        {pieces.map(p => p.text).join(' + ')} = <Text style={{ color: c.primary }}>{form}</Text>
      </Text>
      {pieces.map((p, i) => (
        <Text key={i} style={[t(12), { color: c.textSecondary }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontStyle: 'italic' }}>{p.text}</Text> — {p.label}
        </Text>
      ))}
      {verb.upasargas.length > 0 && (
        <Text style={[t(12), { color: c.textSecondary, marginTop: 4 }]}>
          {verb.upasargas.map(u => u.prefix).join(' + ')} + √{verb.root}
          {verb.combinedMeaning
            ? ` → ${verb.combinedMeaning}`
            : verb.rootMeaning ? ` → ${verb.rootMeaning}, with the prefix's sense added` : ''}
          {!verb.combinedMeaning && verb.upasargas[0]?.example
            ? <Text style={{ color: c.textMuted }}>{`  (compare ${verb.upasargas[0].example})`}</Text> : null}
        </Text>
      )}
      <Text style={[t(12), { color: c.textSecondary, marginTop: 4 }]}>
        Tense: <Text style={{ color: c.text, fontWeight: '600' }}>{verb.tense}</Text>
      </Text>
      {verb.notes.map((n, i) => <Text key={i} style={[t(12), { color: c.textMuted, marginTop: 2 }]}>{n}</Text>)}
      {!!agreement && (
        <Text style={[t(12), { color: c.textSecondary, marginTop: 4 }]}>
          <Text style={{ color: c.text, fontWeight: '700' }}>Agrees with: </Text>{agreement}
        </Text>
      )}

      {verb.table && (
        <View style={styles.table}>
          <View style={[styles.tr, { borderBottomWidth: 1, borderColor: c.border }]}>
            <Text style={[styles.th, styles.tdPerson, t(11), { color: c.textMuted }]}>person</Text>
            {NUMBERS.map(n => <Text key={n.english} style={[styles.th, styles.td, t(11), { color: c.textMuted }]}>{n.english}</Text>)}
          </View>
          {verb.table.map((cells, ri) => {
            const person = ([3, 2, 1] as const)[ri];
            return (
              <View key={ri} style={styles.tr}>
                <Text style={[styles.tdPerson, t(11), { color: c.textSecondary }]}>
                  {PERSONS[person].english.replace(' person', '')} ({WHO[ri][2]})
                </Text>
                {cells.map((cell, ci) => {
                  const here = ri === row && ci === verb.number;
                  return (
                    <Text
                      key={ci}
                      style={[
                        styles.td, t(12),
                        { color: here ? c.primary : c.text, fontWeight: here ? '800' : '400', fontStyle: 'italic' },
                        here && { backgroundColor: c.primary + '1f' },
                      ]}
                    >
                      {cell}
                    </Text>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 6, marginBottom: 4 },
  head: { fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  equation: { fontWeight: '700', fontStyle: 'italic', marginBottom: 4 },
  table: { marginTop: 8 },
  tr: { flexDirection: 'row', paddingVertical: 3 },
  th: { fontWeight: '700' },
  tdPerson: { flex: 1.1, paddingHorizontal: 2 },
  td: { flex: 1, paddingHorizontal: 2, borderRadius: 4 },
});
