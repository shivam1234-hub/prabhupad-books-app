// One entry of the Ślokas collection (a most-quoted verse, a prayer with all
// its verses, or any selected verse) — the reading pane of the desktop Ślokas
// page. Content and memorized ticks are the same as the phone's sloka screen.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { useMemorizedStore } from '@/store/memorizedStore';
import { MemorizedCheck } from '@/components/MemorizedCheck';
import type { LibraryRef } from '@/services/purport/citations';
import {
  PRAYERS, QUOTED_VERSES, RANKED, QuotedVerse, quotedVerse, rankFor, rankedTitle, sectionName,
} from '@/services/mostQuoted';
import { Btn, IconBtn } from './ui';
import { FullScreenBtn } from './FocusBar';
import { useDesktopUi } from './uiStore';
import { verseHref } from './bookNav';
import { parseSynonyms } from './ReaderVerse';
import { WordMeaningSheet } from '@/components/WordMeaningSheet';
import { SANS, SERIF, web, alpha } from './theme';

export type SlokaList = 'ranked' | 'prayers' | 'all';
export const LIST_LENGTH: Record<SlokaList, number> = { ranked: RANKED.length, prayers: PRAYERS.length, all: QUOTED_VERSES.length };

export function SlokaDetail({ list, i, onGo }: { list: SlokaList; i: number; onGo: (i: number) => void }) {
  const [lookup, setLookup] = useState<string | null>(null);
  const focus = useDesktopUi((st) => st.focusMode);
  const router = useRouter();
  const { colors } = useTheme();
  const sc = useSettingsStore((st) => st.settings.fontScale ?? 1);
  const px = (n: number) => Math.round(n * sc);
  const memo = useMemorizedStore((st) => st.ids);
  const setMemo = useMemorizedStore((st) => st.set);

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
    if (v) verses = [v]; else fallback = { line: r.firstLine, source: r.source };
  } else if (list === 'prayers') {
    const p = PRAYERS[i];
    heading = p.title; author = p.author;
    verses = p.verseIds.map((id) => quotedVerse(id)!).filter(Boolean);
  } else {
    const v = QUOTED_VERSES[i];
    heading = v.title ?? sectionName(v.section);
    verses = [v];
    const r = rankFor(v.id);
    badge = r ? `#${r.rank} most quoted · ${r.times} times` : sectionName(v.section);
  }

  const libRef: LibraryRef | undefined = list === 'ranked' ? (RANKED[i].ref ?? verses[0]?.ref) : verses.length === 1 ? verses[0].ref : undefined;
  const ids = verses.map((v) => v.id);
  const allDone = ids.length > 0 && ids.every((id) => memo[id]);
  const someDone = ids.some((id) => memo[id]);
  const len = LIST_LENGTH[list];

  const memoRow = (rowIds: number[], done: boolean, partial: boolean, text: string, doneText: string) => (
    <Pressable
      onPress={() => setMemo(rowIds, !done)}
      style={({ hovered }: any) => [
        s.memoRow,
        { borderColor: done ? colors.primary : colors.border, backgroundColor: done ? alpha(colors.primary, 0.12) : hovered ? alpha(colors.primary, 0.05) : colors.card },
        web({ cursor: 'pointer' }),
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: partial && !done ? 'mixed' : done }}
    >
      <MemorizedCheck checked={done} partial={partial} onPress={() => setMemo(rowIds, !done)} size={22} />
      <Text style={[s.memoText, { color: done ? colors.primary : colors.textSecondary }]}>{done ? doneText : text}</Text>
    </Pressable>
  );

  return (
    <View style={s.wrap}>
      <View style={s.navRow}>
        <IconBtn icon="‹" tip="Previous (←)" onPress={() => onGo(i - 1)} disabled={i === 0} />
        <Text style={[s.pos, { color: colors.textMuted }]}>{i + 1} / {len}</Text>
        <IconBtn icon="›" tip="Next (→)" onPress={() => onGo(i + 1)} disabled={i >= len - 1} />
        <View style={{ flex: 1 }} />
        {badge ? <Text style={[s.badge, { color: colors.primary, backgroundColor: alpha(colors.primary, 0.12) }]}>{badge}</Text> : null}
        {focus ? null : <FullScreenBtn />}
      </View>

      <Text style={[s.heading, { color: colors.text, fontSize: px(26) }]}>{heading}</Text>
      {author ? <Text style={[s.author, { color: colors.textSecondary }]}>by {author}</Text> : null}
      {ids.length > 0 ? memoRow(
        ids, allDone, someDone,
        ids.length > 1 ? `Tick when you know the whole prayer by heart (${ids.filter((id) => memo[id]).length}/${ids.length})` : 'Tick when memorized',
        ids.length > 1 ? 'Whole prayer memorized' : 'Memorized',
      ) : null}

      {fallback ? (
        <View style={s.block}>
          <Text style={[s.verse, { color: colors.devanagari, fontSize: px(19), lineHeight: px(32) }]}>{fallback.line}</Text>
          <Text style={[s.note, { color: colors.textMuted }]}>Quoted from {fallback.source}. The full text isn't included in this collection.</Text>
        </View>
      ) : null}

      {verses.map((v, k) => (
        <View key={v.id} style={[s.block, k > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          {verses.length > 1 && v.title && v.title !== heading ? <Text style={[s.sub, { color: colors.primary }]}>{v.title}</Text> : null}
          {v.note ? <Text style={[s.note, { color: colors.textMuted }]}>{v.note}</Text> : null}
          <Text selectable style={[s.verse, { color: colors.text, fontSize: px(19), lineHeight: px(32) }]}>{v.text}</Text>
          {v.synonyms ? (
            <>
              <Text style={[s.label, { color: colors.text }]}>Synonyms</Text>
              <Text selectable style={[s.body, { color: colors.text, fontSize: px(15.5), lineHeight: px(26) }]}>
                {parseSynonyms(v.synonyms).map((p, k2, all) => (
                  <React.Fragment key={k2}>
                    <Text
                      dataSet={{ vbSyn: '1' }}
                      accessibilityRole="link"
                      onPress={() => setLookup(p.word)}
                      style={[{ fontStyle: 'italic', color: colors.primary }, web({ cursor: 'pointer' })]}
                    >
                      {p.word}
                    </Text>
                    {p.meaning ? ` — ${p.meaning}` : ''}
                    {k2 < all.length - 1 ? '; ' : ''}
                  </React.Fragment>
                ))}
              </Text>
            </>
          ) : null}
          {v.translation ? (
            <>
              <Text style={[s.label, { color: colors.text }]}>Translation</Text>
              <Text selectable style={[s.body, { color: colors.text, fontWeight: '700', fontSize: px(17), lineHeight: px(28) }]}>{v.translation}</Text>
            </>
          ) : null}
          {v.attribution ? <Text style={[s.attr, { color: colors.textSecondary }]}>({v.attribution})</Text> : null}
          {verses.length > 1 ? memoRow([v.id], !!memo[v.id], false, 'Tick when this verse is memorized', 'Verse memorized') : null}
        </View>
      ))}

      {libRef ? (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Btn kind="primary" size="lg" label="Read with purport ›" onPress={() => router.push(verseHref(libRef.bookSlug, libRef.chapter, libRef.verse, libRef.canto ?? undefined))} />
        </View>
      ) : null}
      <Text style={[s.source, { color: colors.textMuted }]}>From “Verses Most Quoted by Śrīla Prabhupāda”, Bhaktivedanta Archives.</Text>
      <WordMeaningSheet
        word={lookup}
        sanskritFirst
        onClose={() => setLookup(null)}
        onOpenVerse={(r) => { setLookup(null); router.push(verseHref(r.bookSlug, r.chapter, r.verse, r.canto ?? undefined)); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 14 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pos: { fontFamily: SANS, fontSize: 12.5, fontWeight: '600', minWidth: 70, textAlign: 'center' },
  badge: { fontFamily: SANS, fontSize: 12, fontWeight: '700', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  heading: { fontFamily: SERIF, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  author: { fontFamily: SERIF, fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: -6 },
  memoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'center', minWidth: 320 },
  memoText: { fontFamily: SANS, fontSize: 13.5, fontWeight: '600' },
  block: { paddingVertical: 18, gap: 12 },
  sub: { fontFamily: SERIF, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  verse: { fontFamily: SERIF, fontStyle: 'italic', textAlign: 'center' },
  label: { fontFamily: SERIF, fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  body: { fontFamily: SERIF },
  attr: { fontFamily: SERIF, fontStyle: 'italic', textAlign: 'right' },
  note: { fontFamily: SERIF, fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  source: { fontFamily: SANS, fontSize: 11.5, textAlign: 'center', marginTop: 10 },
});
