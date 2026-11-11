// Desktop Library: the whole collection as a grid of covers, grouped by the
// same categories as the phone's Library tab.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { BOOKS, BOOK_CATEGORIES } from '@/constants/books';
import { BookCover } from '@/components/BookCover';
import { useTourStore } from '@/components/FeatureTour';
import { getDownloadedBookSlugs } from '@/database/queries';
import { useDownloadStore } from '@/services/downloadManager';
import { BookMeta, BookCategory } from '@/types';
import { Page, Chip, Btn, SectionHeader } from '@/desktop/ui';
import { SANS, SERIF, web } from '@/desktop/theme';

const EXTRA_CATEGORIES = ['lecture', 'letter', 'conversation'];
const WORKS = BOOKS.filter((b) => !EXTRA_CATEGORIES.includes(b.category)).length;
const EXTRAS = BOOKS.filter((b) => EXTRA_CATEGORIES.includes(b.category)).reduce((n, b) => n + (b.totalVerses ?? 0), 0);

const TILE_W = 148;

function BookTile({ book, offline, onPress }: { book: BookMeta; offline: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const dl = useDownloadStore((s) => s.entries[book.slug]);
  const downloading = dl?.status === 'downloading' || dl?.status === 'queued';
  const pct = dl?.total ? Math.round((dl.done / dl.total) * 100) : 0;
  const extra = EXTRA_CATEGORIES.includes(book.category);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={book.title}
      style={[s.tile, web({ cursor: 'pointer' })]}
    >
      {({ hovered }: any) => (
        <>
          <View
            style={[
              s.coverWrap,
              web({
                transition: 'transform 160ms ease, box-shadow 160ms ease',
                transform: hovered ? 'translateY(-4px)' : 'none',
                boxShadow: hovered
                  ? '0 4px 10px rgba(0,0,0,0.16), 0 18px 34px rgba(0,0,0,0.20)'
                  : '0 1px 3px rgba(0,0,0,0.14), 0 6px 14px rgba(0,0,0,0.10)',
              }),
            ]}
          >
            <BookCover book={book} width={TILE_W} />
            {offline ? (
              <View style={[s.badge, { backgroundColor: colors.success }]}>
                <Text style={s.badgeText}>✓ Offline</Text>
              </View>
            ) : downloading ? (
              <View style={[s.badge, { backgroundColor: colors.primary }]}>
                <Text style={s.badgeText}>{dl?.status === 'queued' ? 'Queued' : `${pct}%`}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[s.tileTitle, { color: hovered ? colors.primary : colors.text }]} numberOfLines={2}>{book.title}</Text>
          {book.subtitle ? (
            <Text style={[s.tileSub, { color: colors.textMuted }]} numberOfLines={1}>{book.subtitle}</Text>
          ) : null}
          {extra && book.totalVerses ? (
            <Text style={[s.tileSub, { color: colors.textMuted }]}>{book.totalVerses.toLocaleString()} items</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const showTour = useTourStore((st) => st.show);
  const [filter, setFilter] = useState<BookCategory | 'all'>('all');
  const [offline, setOffline] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    getDownloadedBookSlugs().then((x) => setOffline(new Set(x))).catch(() => {});
  }, []));

  const cats = BOOK_CATEGORIES.filter((c) => filter === 'all' || c.id === filter)
    .map((c) => ({ ...c, books: BOOKS.filter((b) => b.category === c.id) }))
    .filter((c) => c.books.length > 0);

  return (
    <Page>
      <View style={[s.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.eyebrow, { color: colors.primary }]}>ŚRĪLA PRABHUPĀDA</Text>
          <Text style={[s.heroTitle, { color: colors.text }]}>Vedabase Library</Text>
          <Text style={[s.heroSub, { color: colors.textSecondary }]}>
            {WORKS} books · {EXTRAS.toLocaleString()} lectures, letters & talks · {offline.size} available offline
          </Text>
        </View>
        <View style={s.heroActions}>
          <Btn label="Download Manager" icon="⬇" kind="primary" size="lg" onPress={() => router.push('/downloads')} tip="Save all or individual books for offline reading" />
          <Btn label="Feature tour" icon="✨" kind="ghost" onPress={showTour} />
        </View>
      </View>

      <View style={s.filters}>
        <Chip label="All books" on={filter === 'all'} onPress={() => setFilter('all')} />
        {BOOK_CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} on={filter === c.id} onPress={() => setFilter(c.id as BookCategory)} />
        ))}
      </View>

      {cats.map((c) => (
        <View key={c.id}>
          <SectionHeader title={c.label} count={c.books.length} />
          <View style={s.grid}>
            {c.books.map((b) => (
              <BookTile
                key={b.slug}
                book={b}
                offline={offline.has(b.slug)}
                onPress={() => router.push({ pathname: '/book/[slug]', params: { slug: b.slug } })}
              />
            ))}
          </View>
        </View>
      ))}
      <Text style={[s.footer, { color: colors.textMuted }]}>
        Content © The Bhaktivedanta Book Trust International, from vedabase.io
      </Text>
    </Page>
  );
}

const s = StyleSheet.create({
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap',
    paddingHorizontal: 32, paddingVertical: 28, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: { fontFamily: SANS, fontSize: 11.5, fontWeight: '700', letterSpacing: 2 },
  heroTitle: { fontFamily: SERIF, fontSize: 36, fontWeight: '600', marginTop: 6, letterSpacing: -0.3 },
  heroSub: { fontFamily: SANS, fontSize: 14.5, marginTop: 8 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 30, rowGap: 30 },
  tile: { width: TILE_W },
  coverWrap: { borderRadius: 4, marginBottom: 10 },
  badge: { position: 'absolute', top: 8, right: 8, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#FFF', fontFamily: SANS, fontSize: 10.5, fontWeight: '700' },
  tileTitle: { fontFamily: SERIF, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  tileSub: { fontFamily: SANS, fontSize: 12, marginTop: 3, fontStyle: 'normal' },
  footer: { fontFamily: SANS, fontSize: 12, textAlign: 'center', marginTop: 48 },
});
