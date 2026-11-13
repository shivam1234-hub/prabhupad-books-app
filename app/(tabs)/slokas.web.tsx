// Desktop Ślokas: the list (Most Quoted / Prayers / All Verses, search,
// memorized filter and progress) on the left, the selected śloka on the right.
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useMemorizedStore } from '@/store/memorizedStore';
import { MemorizedCheck } from '@/components/MemorizedCheck';
import {
  PRAYERS, QUOTED_VERSES, RANKED, fold, firstLine, matchesQuery, quotedVerse, rankedTitle, sectionName,
} from '@/services/mostQuoted';
import { Segmented, Chip } from '@/desktop/ui';
import { SlokaDetail, SlokaList, LIST_LENGTH } from '@/desktop/SlokaDetail';
import { FocusBar } from '@/desktop/FocusBar';
import { useAutoHideBar, AutoHideBar, BarSpacer, useRevealAtTop } from '@/desktop/autoHide';
import { useDesktopUi } from '@/desktop/uiStore';
import { typingInField } from '@/desktop/uiStore';
import { SANS, SERIF, tints, web, alpha } from '@/desktop/theme';

type Show = 'all' | 'todo' | 'done';
type PState = { pressed: boolean; hovered?: boolean };

const MODES: { key: SlokaList; label: string }[] = [
  { key: 'ranked', label: 'Most Quoted' },
  { key: 'prayers', label: 'Prayers' },
  { key: 'all', label: 'All Verses' },
];
const INTRO: Record<SlokaList, string> = {
  ranked: 'The verses Śrīla Prabhupāda quoted most often in his books, lectures, conversations and letters, from most to least quoted. Compiled by the Bhaktivedanta Archives.',
  prayers: 'Auspicious invocation prayers — the praṇāmas to the spiritual master, the ācāryas, Lord Caitanya and Rādhā-Kṛṣṇa, the mahā-mantras, Gurv-aṣṭaka, Ṣaḍ-gosvāmy-aṣṭaka and Śikṣāṣṭaka.',
  all: 'Every verse of the Bhaktivedanta Archives’ selection, by source.',
};

export default function SlokasScreen() {
  const params = useLocalSearchParams<{ list?: string; i?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = tints(colors);
  const mode: SlokaList = params.list === 'prayers' || params.list === 'all' ? params.list : 'ranked';
  const sel = Math.max(0, Math.min(Number(params.i) || 0, LIST_LENGTH[mode] - 1));
  const [query, setQuery] = React.useState('');
  const [show, setShow] = React.useState<Show>('all');
  const q = fold(query.trim()).replace(/\s+/g, ' ');
  const memo = useMemorizedStore((st) => st.ids);
  const loadMemo = useMemorizedStore((st) => st.load);
  const toggle = useMemorizedStore((st) => st.toggle);
  const setMemo = useMemorizedStore((st) => st.set);
  useEffect(() => { loadMemo(); }, [loadMemo]);

  const select = (list: SlokaList, i: number) => router.setParams({ list, i: String(i) });
  const keep = (done: boolean) => show === 'all' || (show === 'done') === done;
  const prayerDone = (ids: number[]) => ids.every((id) => memo[id]);

  const rows = useMemo(() => {
    if (mode === 'ranked') {
      return RANKED.map((r, i) => ({ r, i })).filter(({ r }) =>
        matchesQuery(quotedVerse(r.verseId), q, `${r.firstLine} ${r.source}`) && keep(r.verseId != null && !!memo[r.verseId]))
        .map(({ r, i }) => {
          const v = quotedVerse(r.verseId);
          return { i, band: `QUOTED ${r.times} TIMES`, num: String(r.rank), line: v ? firstLine(v) : r.firstLine, title: rankedTitle(r), check: r.verseId != null ? { done: !!memo[r.verseId], partial: false, on: () => toggle(r.verseId!) } : undefined };
        });
    }
    if (mode === 'prayers') {
      return PRAYERS.map((p, i) => ({ p, i })).filter(({ p }) =>
        (!q || fold(p.title).includes(q) || p.verseIds.some((id) => matchesQuery(quotedVerse(id), q))) && keep(prayerDone(p.verseIds)))
        .map(({ p, i }) => {
          const v = quotedVerse(p.verseIds[0]);
          const n = p.verseIds.filter((id) => memo[id]).length;
          return {
            i, band: '', num: '🙏', line: p.title, title: `${v ? firstLine(v) : ''}`,
            meta: `${p.verseIds.length > 1 ? `${n ? `${n} of ` : ''}${p.verseIds.length} verses` : '1 verse'}${p.author ? ` · ${p.author}` : ''}`,
            check: { done: prayerDone(p.verseIds), partial: n > 0, on: () => setMemo(p.verseIds, !prayerDone(p.verseIds)) },
          };
        });
    }
    return QUOTED_VERSES.map((v, i) => ({ v, i })).filter(({ v }) => matchesQuery(v, q) && keep(!!memo[v.id]))
      .map(({ v, i }) => ({ i, band: sectionName(v.section).toUpperCase(), num: '', line: firstLine(v), title: v.title ?? '', check: { done: !!memo[v.id], partial: false, on: () => toggle(v.id) } }));
  }, [mode, q, show, memo]);

  const progress = useMemo(() => {
    if (mode === 'ranked') return { done: RANKED.filter((r) => r.verseId != null && memo[r.verseId]).length, total: RANKED.length, unit: 'verses' };
    if (mode === 'prayers') return { done: PRAYERS.filter((p) => prayerDone(p.verseIds)).length, total: PRAYERS.length, unit: 'prayers' };
    return { done: QUOTED_VERSES.filter((v) => memo[v.id]).length, total: QUOTED_VERSES.length, unit: 'verses' };
  }, [mode, memo]);
  const pct = progress.total ? progress.done / progress.total : 0;

  // ↑/↓ or ←/→ step through the list — the rows actually shown (search and
  // memorized filter applied), not the whole unfiltered list.
  const selRef = useRef({ sel, mode, shown: [] as number[] });
  selRef.current = { sel, mode, shown: rows.map((r) => r.i) };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingInField() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[data-vb-pop], [aria-modal="true"]')) return; // a popup has the keyboard
      const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const { sel: cur, mode: m, shown } = selRef.current;
      if (!shown.length) return;
      const at = shown.indexOf(cur);
      // Selected row filtered out: go to the first / last shown one.
      const nx = at === -1 ? (d > 0 ? shown[0] : shown[shown.length - 1]) : shown[at + d];
      if (nx !== undefined) select(m, nx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep the selected row in view.
  const activeRef = useRef<any>(null);
  useEffect(() => { (activeRef.current as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' }); }, [sel, mode]);
  const detailRef = useRef<ScrollView>(null);
  useEffect(() => { detailRef.current?.scrollTo({ y: 0, animated: false }); }, [sel, mode]);

  const focus = useDesktopUi((st) => st.focusMode);
  const bar = useAutoHideBar();
  // Full screen: mouse to the top brings back the bar (search, Exit).
  useRevealAtTop(focus, bar.height);
  return (
    <View style={[s.row, focus && { flexDirection: 'column' }]} {...(focus ? ({ onClick: bar.onTap } as any) : {})}>
      {focus ? <AutoHideBar bar={bar}><FocusBar label={`Most Quoted Ślokas · ${sel + 1} / ${LIST_LENGTH[mode]}`} /></AutoHideBar> : null}
      {focus ? null : <View style={[s.listPane, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
        <View style={[s.top, { borderBottomColor: colors.border }]}>
          <Text style={[s.h1, { color: colors.text }]}>Most Quoted Ślokas</Text>
          <Segmented<SlokaList> value={mode} onChange={(m) => select(m, 0)} options={MODES} style={{ alignSelf: 'stretch' }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search (e.g. janma karma, 2.13, spiritual master)"
            placeholderTextColor={colors.textMuted}
            style={[s.search, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }, web({ outlineColor: colors.primary })]}
          />
          <View style={s.progressRow}>
            <View style={[s.bar, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[s.progressText, { color: colors.textSecondary }]}>{progress.done} / {progress.total} {progress.unit} memorized</Text>
          </View>
          <View style={s.chips}>
            {(['all', 'todo', 'done'] as Show[]).map((k) => (
              <Chip key={k} small label={k === 'all' ? 'All' : k === 'todo' ? 'To learn' : 'Memorized ✓'} on={show === k} onPress={() => setShow(k)} />
            ))}
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8, paddingBottom: 30 }}>
          {!q ? <Text style={[s.intro, { color: colors.textMuted }]}>{INTRO[mode]}</Text> : null}
          {rows.length === 0 ? (
            <Text style={[s.empty, { color: colors.textMuted }]}>
              {q ? `No verse matches “${query.trim()}”.` : show === 'done' ? 'Nothing ticked yet. Tick the box beside a verse once you know it by heart.' : 'All memorized — jaya!'}
            </Text>
          ) : rows.map((r, k) => {
            const on = r.i === sel;
            const newBand = r.band && (k === 0 || rows[k - 1].band !== r.band);
            return (
              <View key={r.i} ref={on ? activeRef : undefined}>
                {newBand ? <Text style={[s.band, { color: colors.primary }]}>{r.band}</Text> : null}
                <Pressable
                  onPress={() => select(mode, r.i)}
                  style={(st: PState) => [s.item, { backgroundColor: on ? t.selected : st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}
                >
                  {r.num ? (
                    <View style={[s.rank, { backgroundColor: on ? colors.primary : alpha(colors.primary, 0.12) }]}>
                      <Text style={[s.rankText, { color: on ? '#FFF' : colors.primary }]}>{r.num}</Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.line, { color: colors.text }, mode === 'prayers' && { fontStyle: 'normal', fontWeight: '700' }]} numberOfLines={1}>{r.line}</Text>
                    {r.title ? <Text style={[s.title, { color: mode === 'prayers' ? colors.textSecondary : colors.primary }, mode === 'prayers' && { fontStyle: 'italic', fontFamily: SERIF }]} numberOfLines={1}>{r.title}</Text> : null}
                    {'meta' in r && r.meta ? <Text style={[s.meta, { color: colors.textMuted }]}>{r.meta as string}</Text> : null}
                  </View>
                  {r.check ? <MemorizedCheck checked={r.check.done} partial={r.check.partial} onPress={r.check.on} size={20} /> : null}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>}
      <ScrollView ref={detailRef} style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={s.detail} onScroll={focus ? (e) => bar.onScrollY(e.nativeEvent.contentOffset.y) : undefined} scrollEventThrottle={32}>
        {focus ? <BarSpacer bar={bar} /> : null}
        <View style={{ width: '100%', maxWidth: 720 }} dataSet={{ vbPage: '1' }}>
          <SlokaDetail list={mode} i={sel} onGo={(i) => select(mode, i)} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', minHeight: 0 },
  listPane: { width: 420, borderRightWidth: StyleSheet.hairlineWidth },
  top: { padding: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  h1: { fontFamily: SERIF, fontSize: 22, fontWeight: '700' },
  search: { height: 36, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontFamily: SANS, fontSize: 13.5 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  progressText: { fontFamily: SANS, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', gap: 6 },
  intro: { fontFamily: SANS, fontSize: 12.5, lineHeight: 18, padding: 8 },
  empty: { fontFamily: SANS, fontSize: 13, textAlign: 'center', padding: 24 },
  band: { fontFamily: SANS, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 12, marginBottom: 4, marginLeft: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8 },
  rank: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: SANS, fontSize: 12, fontWeight: '800' },
  line: { fontFamily: SERIF, fontSize: 14.5, fontStyle: 'italic' },
  title: { fontFamily: SANS, fontSize: 12, fontWeight: '600', marginTop: 1 },
  meta: { fontFamily: SANS, fontSize: 11.5, marginTop: 1 },
  detail: { paddingVertical: 32, paddingHorizontal: 40, alignItems: 'center' },
});
