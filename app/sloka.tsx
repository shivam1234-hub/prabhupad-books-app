import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { useMemorizedStore } from '@/store/memorizedStore';
import { MemorizedCheck } from '@/components/MemorizedCheck';
import type { LibraryRef } from '@/services/purport/citations';
import {
  PRAYERS, QUOTED_VERSES, RANKED, QuotedVerse, quotedVerse, rankFor, rankedTitle, sectionName,
} from '@/services/mostQuoted';

type List = 'ranked' | 'prayers' | 'all';

const LENGTH: Record<List, number> = { ranked: RANKED.length, prayers: PRAYERS.length, all: QUOTED_VERSES.length };

/**
 * One entry from the Ślokas tab — a most-quoted verse, a prayer (all its
 * verses), or any selected verse — with previous / next through that list and
 * a link to the verse in the library when the book is in it.
 */
export default function SlokaScreen() {
  const params = useLocalSearchParams<{ list?: string; i?: string }>();
  const list: List = params.list === 'prayers' || params.list === 'all' ? params.list : 'ranked';
  const i = Math.max(0, Math.min(Number(params.i) || 0, LENGTH[list] - 1));
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const sc = useSettingsStore(s => s.settings.fontScale ?? 1);
  const px = (n: number) => Math.round(n * sc);
  const scroll = useRef<ScrollView>(null);
  const memo = useMemorizedStore(s => s.ids);
  const loadMemo = useMemorizedStore(s => s.load);
  const setMemo = useMemorizedStore(s => s.set);
  useEffect(() => { loadMemo(); }, [loadMemo]);
  const insets = useSafeAreaInsets();

  let heading = '';
  let badge: string | null = null;
  let verses: QuotedVerse[] = [];
  let fallback: { line: string; source: string } | null = null;
  let author: string | undefined;

  if (list === 'ranked') {
    const r = RANKED[i];
    heading = rankedTitle(r);
    badge = `#${r.rank} most quoted · ${r.times} times`;
    const v = quotedVerse(r.verseId);
    if (v) verses = [v];
    else fallback = { line: r.firstLine, source: r.source };
  } else if (list === 'prayers') {
    const p = PRAYERS[i];
    heading = p.title;
    author = p.author;
    verses = p.verseIds.map(id => quotedVerse(id)!).filter(Boolean);
  } else {
    const v = QUOTED_VERSES[i];
    heading = v.title ?? sectionName(v.section);
    verses = [v];
    const r = rankFor(v.id);
    badge = r ? `#${r.rank} most quoted · ${r.times} times` : sectionName(v.section);
  }

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: list === 'prayers' ? 'Prayer' : 'Śloka' });
  }, [navigation, list]);

  const go = (to: number) => {
    router.setParams({ i: String(to) });
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const openRef = (r: LibraryRef) => router.push({
    pathname: '/verse',
    params: {
      book: r.bookSlug, chapter: String(r.chapter), verse: r.verse,
      ...(r.canto != null ? { canto: String(r.canto) } : {}),
    },
  });

  const libRef = list === 'ranked' ? (RANKED[i].ref ?? verses[0]?.ref) : verses.length === 1 ? verses[0].ref : undefined;

  const ids = verses.map(v => v.id);
  const allDone = ids.length > 0 && ids.every(id => memo[id]);
  const someDone = ids.some(id => memo[id]);

  /** A tappable "Memorized" line with its tick box. */
  const memoRow = (rowIds: number[], done: boolean, partial: boolean, text: string, doneText: string) => (
    <Pressable
      onPress={() => setMemo(rowIds, !done)}
      style={({ pressed }) => [
        styles.memoRow,
        {
          borderColor: done ? colors.primary : colors.border,
          backgroundColor: done ? colors.primaryLight : colors.card,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: partial && !done ? 'mixed' : done }}
    >
      <MemorizedCheck checked={done} partial={partial} onPress={() => setMemo(rowIds, !done)} size={24} />
      <Text style={[styles.memoText, { color: done ? colors.primaryDark : colors.textSecondary }]}>
        {done ? doneText : text}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        {!!badge && (
          <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.badgeText, { color: colors.primaryDark }]}>{badge}</Text>
          </View>
        )}
        <Text style={[styles.heading, { color: colors.primary, fontSize: px(20) }]}>{heading}</Text>
        {!!author && <Text style={[styles.author, { color: colors.textSecondary }]}>by {author}</Text>}
        {ids.length > 0 && memoRow(
          ids, allDone, someDone,
          ids.length > 1 ? `Tick when you know the whole prayer by heart (${ids.filter(id => memo[id]).length}/${ids.length})` : 'Tick when memorized',
          ids.length > 1 ? 'Whole prayer memorized' : 'Memorized',
        )}

        {fallback && (
          <View style={styles.block}>
            <Text style={[styles.verse, { color: colors.devanagari, fontSize: px(17), lineHeight: px(27) }]}>
              {fallback.line}
            </Text>
            <Text style={[styles.note, { color: colors.textMuted }]}>
              Quoted from {fallback.source}. The full text isn't included in this collection.
            </Text>
          </View>
        )}

        {verses.map((v, k) => (
          <View key={v.id} style={[styles.block, k > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            {verses.length > 1 && v.title && v.title !== heading && (
              <Text style={[styles.subheading, { color: colors.primary }]}>{v.title}</Text>
            )}
            {!!v.note && <Text style={[styles.note, { color: colors.textMuted }]}>{v.note}</Text>}
            <Text style={[styles.verse, { color: colors.devanagari, fontSize: px(17), lineHeight: px(27) }]}>{v.text}</Text>
            {!!v.synonyms && (
              <>
                <Text style={[styles.label, { color: colors.primary }]}>WORD FOR WORD</Text>
                <Text style={[styles.synonyms, { color: colors.synonyms, fontSize: px(14), lineHeight: px(22) }]}>
                  {v.synonyms}
                </Text>
              </>
            )}
            {!!v.translation && (
              <>
                <Text style={[styles.label, { color: colors.primary }]}>TRANSLATION</Text>
                <Text style={[styles.translation, { color: colors.translation, fontSize: px(16), lineHeight: px(25) }]}>
                  {v.translation}
                </Text>
              </>
            )}
            {!!v.attribution && (
              <Text style={[styles.attribution, { color: colors.textSecondary, fontSize: px(13) }]}>({v.attribution})</Text>
            )}
            {verses.length > 1 && memoRow([v.id], !!memo[v.id], false, 'Tick when this verse is memorized', 'Verse memorized')}
          </View>
        ))}

        {!!libRef && (
          <Pressable
            onPress={() => openRef(libRef)}
            style={({ pressed }) => [styles.openBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={styles.openText}>Read with purport ›</Text>
          </Pressable>
        )}
        <Text style={[styles.source, { color: colors.textMuted }]}>
          From “Verses Most Quoted by Śrīla Prabhupāda”, Bhaktivedanta Archives.
        </Text>
      </ScrollView>

      <View style={[styles.nav, { borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: 10 + insets.bottom }]}>
        <Pressable disabled={i === 0} onPress={() => go(i - 1)} hitSlop={8} style={styles.navBtn}>
          <Text style={[styles.navText, { color: i === 0 ? colors.textMuted : colors.primary }]}>‹ Previous</Text>
        </Pressable>
        <Text style={[styles.navPos, { color: colors.textMuted }]}>{i + 1} / {LENGTH[list]}</Text>
        <Pressable disabled={i >= LENGTH[list] - 1} onPress={() => go(i + 1)} hitSlop={8} style={[styles.navBtn, { alignItems: 'flex-end' }]}>
          <Text style={[styles.navText, { color: i >= LENGTH[list] - 1 ? colors.textMuted : colors.primary }]}>Next ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  heading: { fontWeight: '800' },
  author: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  block: { paddingVertical: 16, gap: 8 },
  subheading: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  verse: { fontStyle: 'italic', textAlign: 'center', fontWeight: '600', marginVertical: 6 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 6 },
  synonyms: {},
  translation: { fontWeight: '600' },
  attribution: { fontStyle: 'italic', textAlign: 'right', marginTop: 4 },
  note: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  memoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  memoText: { flex: 1, fontSize: 14, fontWeight: '700' },
  openBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  openText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  source: { fontSize: 11, textAlign: 'center', marginTop: 18 },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { paddingVertical: 4, minWidth: 90 },
  navText: { fontSize: 15, fontWeight: '700' },
  navPos: { fontSize: 12 },
});
