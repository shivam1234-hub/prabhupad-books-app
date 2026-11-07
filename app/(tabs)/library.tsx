import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, Pressable, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { BOOKS, BOOK_CATEGORIES } from '@/constants/books';
import { BookCard } from '@/components/BookCard';
import { FontSizeControl } from '@/components/FontSizeControl';
import { useTourStore } from '@/components/FeatureTour';
import { getDownloadedBookSlugs } from '@/database/queries';
import { BookMeta, BookCategory } from '@/types';

type Section = { title: string; data: BookMeta[] };

function buildSections(filter: BookCategory | 'all'): Section[] {
  const filtered = filter === 'all' ? BOOKS : BOOKS.filter((b) => b.category === filter);
  const groups: Record<string, BookMeta[]> = {};
  for (const book of filtered) {
    const cat = book.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(book);
  }
  return Object.entries(groups).map(([cat, data]) => ({
    title: BOOK_CATEGORIES.find((c) => c.id === cat)?.label ?? cat,
    data,
  }));
}

// BOOKS now also holds the lecture / letter / conversation sections, so a plain
// BOOKS.length would claim 82 "scriptures". Count the works and the talks apart.
const EXTRA_CATEGORIES = ['lecture', 'letter', 'conversation'];
const LIBRARY_SUMMARY = (() => {
  const works = BOOKS.filter((b) => !EXTRA_CATEGORIES.includes(b.category));
  const extras = BOOKS.filter((b) => EXTRA_CATEGORIES.includes(b.category))
    .reduce((n, b) => n + (b.totalVerses ?? 0), 0);
  return `${works.length} books · ${extras.toLocaleString()} lectures, letters & talks`;
})();

export default function LibraryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const showTour = useTourStore((s) => s.show);
  const [filter, setFilter] = useState<BookCategory | 'all'>('all');
  const [offlineSlugs, setOfflineSlugs] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      getDownloadedBookSlugs().then((s) => setOfflineSlugs(new Set(s))).catch(() => {});
    }, [])
  );

  const sections = buildSections(filter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {([{ id: 'all', label: 'All Books' }, ...BOOK_CATEGORIES] as any[]).map((cat) => (
            <Pressable
              key={cat.id}
              style={[
                styles.filterChip,
                { backgroundColor: filter === cat.id ? colors.primary : colors.searchBackground, borderColor: filter === cat.id ? colors.primary : colors.border },
              ]}
              onPress={() => setFilter(cat.id)}
            >
              <Text style={[styles.filterText, { color: filter === cat.id ? '#FFF' : colors.textSecondary }]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Global reading-text size — applies to every book's verses */}
        <View style={styles.fontRow}>
          <FontSizeControl />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title.toUpperCase()}</Text>
            <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        renderItem={({ item }) => (
          <BookCard
            book={item}
            offline={offlineSlugs.has(item.slug)}
            onPress={() => router.push({ pathname: '/book/[slug]', params: { slug: item.slug } })}
          />
        )}
        ListHeaderComponent={
          <>
            <View style={[styles.hero, { backgroundColor: colors.primary }]}>
              <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.7)' }]}>SRILA PRABHUPADA</Text>
              <Text style={styles.heroTitle}>Vedabase Library</Text>
              <Text style={styles.heroSubtitle}>{LIBRARY_SUMMARY}</Text>

              {/* Download Manager entry — download all or individual books offline */}
              <Pressable
                style={({ pressed }) => [styles.dlBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={() => router.push('/downloads' as any)}
              >
                <Text style={styles.dlBtnIcon}>📦</Text>
                <View style={styles.dlBtnText}>
                  <Text style={styles.dlBtnTitle}>Download Manager</Text>
                  <Text style={styles.dlBtnSub}>Save all or individual books for offline reading</Text>
                </View>
                <Text style={styles.dlBtnChevron}>›</Text>
              </Pressable>

              {/* Replay the first-launch feature tour */}
              <Pressable onPress={showTour} hitSlop={8} style={styles.tourLink}>
                <Text style={styles.tourLinkText}>✨ New here? Take the feature tour</Text>
              </Pressable>
            </View>
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tourLink: { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  tourLinkText: { color: '#FFF', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  filterBar: {
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  fontRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },
  hero: {
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    marginBottom: 20,
    gap: 4,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 2,
  },
  dlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dlBtnIcon: { fontSize: 22 },
  dlBtnText: { flex: 1, gap: 2 },
  dlBtnTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  dlBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 16 },
  dlBtnChevron: { color: 'rgba(255,255,255,0.9)', fontSize: 22, fontWeight: '700' },
});
