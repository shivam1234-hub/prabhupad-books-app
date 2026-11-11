// Collapsible contents sidebar for the reading screens: book → (canto) →
// chapter → verses, so any verse is one click away. The current chapter is
// open, with its verses as a grid of numbers.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { BookMeta } from '@/types';
import { BookCover } from '@/components/BookCover';
import { SANS, SERIF, SIDEBAR_W, tints, web } from './theme';
import { IconBtn } from './ui';
import { useDesktopUi } from './uiStore';
import {
  flatChapters, chapterHref, isProseBook, cantoLabel, useVerseIds, verseHref, idContains, FlatChapter,
} from './bookNav';

type PState = { pressed: boolean; hovered?: boolean };

// Huge vanisource collections (thousands of lectures) list a window around the
// open page rather than every row.
const WINDOW = 120;

function VerseGrid({ book, ch, current }: { book: BookMeta; ch: FlatChapter; current?: string }) {
  const { colors } = useTheme();
  const t = tints(colors);
  const router = useRouter();
  const ids = useVerseIds(book, ch.chapter, ch.canto);
  if (!ids.length) return null;
  return (
    <View style={s.grid}>
      {ids.map((id) => {
        const on = current !== undefined && idContains(id, current);
        return (
          <Pressable
            key={id}
            onPress={() => router.replace(verseHref(book.slug, ch.chapter, id, ch.canto))}
            accessibilityLabel={`Text ${id}`}
            style={(st: PState) => [
              s.cell,
              id.includes('-') && s.cellWide,
              { backgroundColor: on ? colors.primary : st.hovered ? t.hoverStrong : 'transparent', borderColor: on ? colors.primary : colors.border },
              web({ cursor: 'pointer' }),
            ]}
          >
            <Text style={[s.cellText, { color: on ? '#FFF' : colors.textSecondary }]}>{id}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BookToc({ book, canto, chapter, verse, pageId }: {
  book: BookMeta; canto?: number; chapter?: number; verse?: string; pageId?: string;
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  const router = useRouter();
  const toggle = useDesktopUi((st) => st.toggleToc);
  const prose = isProseBook(book);
  const chapters = useMemo(() => flatChapters(book), [book]);
  const [openCanto, setOpenCanto] = useState<number | undefined>(canto);
  useEffect(() => setOpenCanto(canto), [canto]);

  const isCurrent = (ch: FlatChapter) =>
    ch.pageId ? ch.pageId === pageId
      : prose && !book.hasCantos ? String(ch.chapter) === verse
        : ch.chapter === chapter && ch.canto === canto;

  // Scroll the open chapter into view once.
  const activeRef = useRef<any>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current) return;
    const el = activeRef.current as HTMLElement | null;
    if (el?.scrollIntoView) { el.scrollIntoView({ block: 'center' }); scrolled.current = true; }
  });

  let rows = chapters;
  let clipped = false;
  if (rows.length > WINDOW * 2) {
    const i = Math.max(0, rows.findIndex(isCurrent));
    rows = rows.slice(Math.max(0, i - WINDOW), i + WINDOW);
    clipped = true;
  }

  const chapterRow = (ch: FlatChapter) => {
    const on = isCurrent(ch);
    const showVerses = on && !prose && !ch.pageId && book.slug !== 'kb';
    return (
      <View key={`${ch.canto ?? 0}-${ch.chapter}-${ch.pageId ?? ''}`} ref={on ? activeRef : undefined}>
        <Pressable
          onPress={() => router.push(chapterHref(book, ch))}
          style={(st: PState) => [
            s.chRow,
            { backgroundColor: on ? t.selected : st.hovered ? t.hover : 'transparent' },
            web({ cursor: 'pointer' }),
          ]}
        >
          {!ch.pageId ? <Text style={[s.chNum, { color: on ? colors.primary : colors.textMuted }]}>{ch.chapter}</Text> : null}
          <Text style={[s.chTitle, { color: on ? colors.primary : colors.text, fontWeight: on ? '700' : '500' }]} numberOfLines={2}>
            {ch.title}
          </Text>
        </Pressable>
        {showVerses ? <VerseGrid book={book} ch={ch} current={verse} /> : null}
      </View>
    );
  };

  return (
    <View style={[s.side, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      <View style={[s.head, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.push({ pathname: '/book/[slug]', params: { slug: book.slug } })} style={[s.bookLink, web({ cursor: 'pointer' })]}>
          <BookCover book={book} width={30} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.contents, { color: colors.textMuted }]}>CONTENTS</Text>
            <Text style={[s.bookTitle, { color: colors.text }]} numberOfLines={2}>{book.title}</Text>
          </View>
        </Pressable>
        <IconBtn icon="⇤" tip="Hide contents  [" onPress={toggle} size={30} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list}>
        {book.frontMatter?.length ? (
          <View style={{ marginBottom: 6 }}>
            {book.frontMatter.map((fm) => {
              const on = fm.id === verse;
              return (
                <Pressable
                  key={fm.id}
                  onPress={() => router.push(verseHref(book.slug, 1, fm.id))}
                  style={(st: PState) => [s.chRow, { backgroundColor: on ? t.selected : st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}
                >
                  <Text style={[s.chNum, { color: colors.textMuted }]}>§</Text>
                  <Text style={[s.chTitle, { color: on ? colors.primary : colors.textSecondary }]} numberOfLines={1}>{fm.title}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {clipped ? <Text style={[s.note, { color: colors.textMuted }]}>Showing pages near this one — open the book for the full list.</Text> : null}
        {book.hasCantos && book.cantos
          ? book.cantos.map((c) => {
            const open = openCanto === c.number;
            return (
              <View key={c.number}>
                <Pressable
                  onPress={() => setOpenCanto(open ? undefined : c.number)}
                  style={(st: PState) => [s.cantoRow, { backgroundColor: st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}
                >
                  <Text style={[s.caret, { color: colors.textMuted }, web({ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' })]}>›</Text>
                  <Text style={[s.cantoTitle, { color: c.number === canto ? colors.primary : colors.text }]} numberOfLines={1}>
                    {book.slug === 'sb' ? `Canto ${c.number}: ${c.title}` : cantoLabel(book, c.number)}
                  </Text>
                </Pressable>
                {open ? <View style={s.cantoBody}>{rows.filter((r) => r.canto === c.number).map(chapterRow)}</View> : null}
              </View>
            );
          })
          : rows.map(chapterRow)}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  side: { width: SIDEBAR_W, borderRightWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  bookLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  contents: { fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  bookTitle: { fontFamily: SERIF, fontSize: 14, fontWeight: '600', marginTop: 2, lineHeight: 18 },
  list: { padding: 8, paddingBottom: 40 },
  note: { fontFamily: SANS, fontSize: 11.5, padding: 8, fontStyle: 'italic' },
  cantoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 7 },
  caret: { fontSize: 16, width: 12, textAlign: 'center', fontWeight: '700' },
  cantoTitle: { flex: 1, fontFamily: SANS, fontSize: 13, fontWeight: '700' },
  cantoBody: { paddingLeft: 10 },
  chRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 7 },
  chNum: { fontFamily: SANS, fontSize: 12, fontWeight: '700', width: 22, textAlign: 'right', marginTop: 1 },
  chTitle: { flex: 1, fontFamily: SANS, fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingLeft: 38, paddingRight: 6, paddingTop: 4, paddingBottom: 10 },
  cell: { minWidth: 32, height: 26, paddingHorizontal: 4, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  cellWide: { minWidth: 48 },
  cellText: { fontFamily: SANS, fontSize: 11.5, fontWeight: '600' },
});
