import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList, Pressable, SectionList, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { useMemorizedStore } from '@/store/memorizedStore';
import { MemorizedCheck } from '@/components/MemorizedCheck';
import {
  PRAYERS, QUOTED_VERSES, RANKED, fold, firstLine, matchesQuery, quotedVerse, rankedTitle, sectionName,
} from '@/services/mostQuoted';

type Mode = 'ranked' | 'prayers' | 'all';

const MODES: { key: Mode; label: string }[] = [
  { key: 'ranked', label: 'Most Quoted' },
  { key: 'prayers', label: 'Prayers' },
  { key: 'all', label: 'All Verses' },
];

type Show = 'all' | 'todo' | 'done';
const SHOWS: { key: Show; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'To learn' },
  { key: 'done', label: 'Memorized ✓' },
];

/**
 * Ślokas: the verses Śrīla Prabhupāda quoted most, in order of how often he
 * quoted them; the prayers he began his classes and books with; and every
 * verse of the Bhaktivedanta Archives' selection. All bundled — no download.
 */
export default function SlokasScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const sc = useSettingsStore(s => s.settings.fontScale ?? 1);
  const px = (n: number) => Math.round(n * sc);
  const [mode, setMode] = useState<Mode>('ranked');
  const [query, setQuery] = useState('');
  const q = fold(query.trim()).replace(/\s+/g, ' ');
  const [show, setShow] = useState<Show>('all');
  const memo = useMemorizedStore(s => s.ids);
  const loadMemo = useMemorizedStore(s => s.load);
  const toggle = useMemorizedStore(s => s.toggle);
  const setMemo = useMemorizedStore(s => s.set);
  useEffect(() => { loadMemo(); }, [loadMemo]);

  /** Keep an item under the To learn / Memorized filter. */
  const keep = (done: boolean) => show === 'all' || (show === 'done') === done;
  const prayerDone = (ids: number[]) => ids.every(id => memo[id]);

  const ranked = useMemo(
    () => RANKED.map((r, i) => ({ r, i })).filter(({ r }) =>
      matchesQuery(quotedVerse(r.verseId), q, `${r.firstLine} ${r.source}`)
      && keep(r.verseId != null && !!memo[r.verseId])),
    [q, show, memo],
  );
  const prayers = useMemo(
    () => PRAYERS.map((p, i) => ({ p, i })).filter(({ p }) =>
      (!q || fold(p.title).includes(q) || p.verseIds.some(id => matchesQuery(quotedVerse(id), q)))
      && keep(prayerDone(p.verseIds))),
    [q, show, memo],
  );
  const sections = useMemo(() => {
    const out: { title: string; data: { id: number; i: number }[] }[] = [];
    QUOTED_VERSES.forEach((v, i) => {
      if (!matchesQuery(v, q) || !keep(!!memo[v.id])) return;
      const title = sectionName(v.section);
      if (out[out.length - 1]?.title !== title) out.push({ title, data: [] });
      out[out.length - 1].data.push({ id: v.id, i });
    });
    return out;
  }, [q, show, memo]);

  // Progress for the open list.
  const progress = useMemo(() => {
    if (mode === 'ranked') {
      return { done: RANKED.filter(r => r.verseId != null && memo[r.verseId]).length, total: RANKED.length, unit: 'verses' };
    }
    if (mode === 'prayers') {
      return { done: PRAYERS.filter(p => prayerDone(p.verseIds)).length, total: PRAYERS.length, unit: 'prayers' };
    }
    return { done: QUOTED_VERSES.filter(v => memo[v.id]).length, total: QUOTED_VERSES.length, unit: 'verses' };
  }, [mode, memo]);

  const open = (list: Mode, i: number) => router.push({ pathname: '/sloka', params: { list, i: String(i) } });

  const empty = (
    <Text style={[styles.empty, { color: colors.textMuted }]}>
      {q ? `No verse matches “${query.trim()}”.`
        : show === 'done' ? 'Nothing ticked yet. Tick the box beside a verse once you know it by heart.'
          : 'All memorized — jaya!'}
    </Text>
  );
  const pct = progress.total ? progress.done / progress.total : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.top, { borderBottomColor: colors.border }]}>
        <View style={[styles.segment, { backgroundColor: colors.surfaceElevated }]}>
          {MODES.map(m => {
            const on = m.key === mode;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[styles.segBtn, on && { backgroundColor: colors.card, borderColor: colors.border }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.segText, { color: on ? colors.primary : colors.textSecondary }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search (e.g. janma karma, 2.13, spiritual master)"
          placeholderTextColor={colors.textMuted}
          style={[styles.search, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        <View style={styles.progressRow}>
          <View style={[styles.bar, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {progress.done} / {progress.total} {progress.unit} memorized
          </Text>
        </View>
        <View style={styles.chips}>
          {SHOWS.map(f => {
            const on = f.key === show;
            return (
              <Pressable
                key={f.key}
                onPress={() => setShow(f.key)}
                style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primaryLight : 'transparent' }]}
              >
                <Text style={[styles.chipText, { color: on ? colors.primaryDark : colors.textSecondary }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mode === 'ranked' && (
        <FlatList
          data={ranked}
          keyExtractor={({ r }) => String(r.rank)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={!q ? (
            <Text style={[styles.intro, { color: colors.textSecondary }]}>
              The verses Śrīla Prabhupāda quoted most often in his books, lectures, conversations and letters,
              from most to least quoted. Compiled by the Bhaktivedanta Archives.
            </Text>
          ) : null}
          ListEmptyComponent={empty}
          renderItem={({ item: { r, i }, index }) => {
            const v = quotedVerse(r.verseId);
            const newBand = index === 0 || ranked[index - 1].r.times !== r.times;
            return (
              <View>
                {newBand && (
                  <Text style={[styles.band, { color: colors.primary }]}>QUOTED {r.times} TIMES</Text>
                )}
                <Pressable
                  onPress={() => open('ranked', i)}
                  style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
                >
                  <View style={[styles.rank, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.rankText, { color: colors.primaryDark }]}>{r.rank}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.verseLine, { color: colors.text, fontSize: px(15) }]} numberOfLines={1}>
                      {v ? firstLine(v) : r.firstLine}
                    </Text>
                    <Text style={[styles.rowTitle, { color: colors.primary }]} numberOfLines={1}>{rankedTitle(r)}</Text>
                    {!!v?.translation && (
                      <Text style={[styles.snippet, { color: colors.textSecondary, fontSize: px(13) }]} numberOfLines={2}>
                        {v.translation}
                      </Text>
                    )}
                  </View>
                  {r.verseId != null && (
                    <MemorizedCheck checked={!!memo[r.verseId]} onPress={() => toggle(r.verseId!)} />
                  )}
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {mode === 'prayers' && (
        <FlatList
          data={prayers}
          keyExtractor={({ i }) => String(i)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={!q ? (
            <Text style={[styles.intro, { color: colors.textSecondary }]}>
              Auspicious invocation prayers — the praṇāmas to the spiritual master, the ācāryas, Lord Caitanya and
              Rādhā-Kṛṣṇa, the mahā-mantras, Gurv-aṣṭaka, Ṣaḍ-gosvāmy-aṣṭaka and Śikṣāṣṭaka.
            </Text>
          ) : null}
          ListEmptyComponent={empty}
          renderItem={({ item: { p, i } }) => {
            const v = quotedVerse(p.verseIds[0]);
            return (
              <Pressable
                onPress={() => open('prayers', i)}
                style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={styles.prayerIcon}>🙏</Text>
                <View style={styles.rowBody}>
                  <Text style={[styles.prayerTitle, { color: colors.text, fontSize: px(15) }]}>{p.title}</Text>
                  {!!v && (
                    <Text style={[styles.verseLine, { color: colors.textSecondary, fontSize: px(14) }]} numberOfLines={1}>
                      {firstLine(v)}
                    </Text>
                  )}
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {p.verseIds.length > 1
                      ? `${p.verseIds.filter(id => memo[id]).length ? `${p.verseIds.filter(id => memo[id]).length} of ` : ''}${p.verseIds.length} verses`
                      : '1 verse'}
                    {p.author ? ` · ${p.author}` : ''}
                  </Text>
                </View>
                <MemorizedCheck
                  checked={prayerDone(p.verseIds)}
                  partial={p.verseIds.some(id => memo[id])}
                  onPress={() => setMemo(p.verseIds, !prayerDone(p.verseIds))}
                  label="Whole prayer memorized"
                />
              </Pressable>
            );
          }}
        />
      )}

      {mode === 'all' && (
        <SectionList
          sections={sections}
          keyExtractor={({ id }) => String(id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled
          initialNumToRender={20}
          ListEmptyComponent={empty}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHead, { backgroundColor: colors.background }]}>
              <Text style={[styles.band, { color: colors.primary, marginTop: 0 }]}>
                {section.title.toUpperCase()} · {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item: { id, i } }) => {
            const v = quotedVerse(id)!;
            return (
              <Pressable
                onPress={() => open('all', i)}
                style={({ pressed }) => [styles.compactRow, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={styles.rowBody}>
                  <Text style={[styles.verseLine, { color: colors.text, fontSize: px(15) }]} numberOfLines={1}>
                    {firstLine(v)}
                  </Text>
                  <Text style={[styles.rowTitle, { color: colors.textSecondary }]} numberOfLines={1}>{v.title}</Text>
                </View>
                <MemorizedCheck checked={!!memo[id]} onPress={() => toggle(id)} size={24} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent',
  },
  segText: { fontSize: 13, fontWeight: '700' },
  search: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14,
  },
  // Room for the floating search bar.
  list: { padding: 12, paddingBottom: 100 },
  intro: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  band: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontWeight: '800', fontSize: 13 },
  rowBody: { flex: 1, gap: 2 },
  verseLine: { fontStyle: 'italic', fontWeight: '600' },
  rowTitle: { fontSize: 12, fontWeight: '700' },
  snippet: { lineHeight: 18, marginTop: 2 },
  prayerIcon: { fontSize: 22 },
  prayerTitle: { fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 1 },
  sectionHead: { paddingTop: 12, paddingBottom: 2 },
  compactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '700' },
});
