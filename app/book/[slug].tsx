import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SectionList, Pressable, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { getBook } from '@/constants/books';
import { BookCover } from '@/components/BookCover';
import { isFlatBook, isChapterPageBook } from '@/services/vedabaseApi';
import { useBookDownload, enqueueBook, hydrateDownloads } from '@/services/downloadManager';
import { CantoPart } from '@/types';
import { useTrackedRoute } from '@/hooks/useTrackedRoute';
import { useSettingsStore } from '@/store/settingsStore';

export default function BookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const sc = useSettingsStore((s) => s.settings.fontScale ?? 1);
  const book = getBook(slug ?? '');

  // Live download state from the global manager — survives navigation and reflects
  // background/resumed progress automatically.
  const dl = useBookDownload(slug ?? '');
  const [selectedCanto, setSelectedCanto] = useState<number | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);

  // Seed the manager from SQLite on focus so a previously-downloaded book shows
  // its status even on first navigation to this screen.
  useFocusEffect(useCallback(() => { hydrateDownloads().catch(() => {}); }, []));

  // Recent-pages tracking — a book landing usually doesn't need scroll restore,
  // but persisting it lets the reader resume a specific canto scroll too.
  const trackedEntry = useCallback(
    () => (book
      ? { kind: 'book' as const, title: book.title, subtitle: book.subtitle, bookSlug: book.slug }
      : null),
    [book?.slug, book?.title, book?.subtitle],
  );
  const { key: routeKey, savedOffset, onScroll: onScrollTrack } = useTrackedRoute({
    pathname: '/book/[slug]',
    params: { slug: slug ?? '' },
    entry: trackedEntry,
    visitDeps: [slug, book?.title],
  });

  const listRef = useRef<SectionList<any>>(null);
  const restoredForKey = useRef<string | null>(null);
  useEffect(() => {
    if (!book || savedOffset === undefined || savedOffset < 8) return;
    if (restoredForKey.current === routeKey) return;
    restoredForKey.current = routeKey;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // getScrollResponder + scrollTo works across FlatList/SectionList
        // whereas scrollToLocation needs sectionIndex which we don't track.
        // @ts-ignore — SectionList exposes this on the underlying VirtualizedList.
        listRef.current?.getScrollResponder?.()?.scrollTo({ y: savedOffset, animated: false });
      });
    });
  }, [routeKey, book?.slug, savedOffset]);

  const downloading = dl?.status === 'downloading' || dl?.status === 'queued';
  const downloadProgress = dl && dl.total ? dl.done / dl.total : 0;

  if (!book) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.text }]}>Book not found</Text>
      </View>
    );
  }

  // Prose books where each chapter is one page — open it directly instead of a
  // chapter→verse list. Flat prose (e.g. Kṛṣṇa Book): /slug/N/. Chapter-page
  // with volumes (Līlāmṛta): /slug/{volume}/{chapter}/.
  const isFlatProse = isFlatBook(book.slug) && (book.chapters?.length ?? 0) > 1;
  const isProseBook = isFlatProse || isChapterPageBook(book.slug);

  const goToChapter = (chapter: number, cantoPart?: number) => {
    if (isChapterPageBook(book.slug)) {
      router.push({
        pathname: '/verse',
        params: { book: book.slug, chapter: String(chapter), verse: '', canto: cantoPart !== undefined ? String(cantoPart) : '' },
      });
      return;
    }
    if (isFlatProse) {
      router.push({
        pathname: '/verse',
        params: { book: book.slug, chapter: '1', verse: String(chapter), canto: '' },
      });
      return;
    }
    router.push({
      pathname: '/chapter',
      params: {
        book: book.slug,
        chapter: String(chapter),
        canto: cantoPart !== undefined ? String(cantoPart) : '',
      },
    });
  };

  // Hand the book off to the global download manager. It keeps running when we
  // leave this screen, and resumes after the app is closed. Tapping while it's
  // already downloading jumps to the Download Manager to watch/cancel.
  const handleDownload = () => {
    if (!book) return;
    if (downloading) {
      router.push('/downloads' as any);
      return;
    }
    enqueueBook(book.slug);
  };

  type Row = { chapter: number; title: string; verseCount: number; cantoPart?: number; pageId?: string };
  type SectionData = { title: string; data: Row[] };
  let sections: SectionData[];

  if (book.hasCantos && book.cantos) {
    sections = book.cantos.map((c: CantoPart) => ({
      title: `Canto ${c.number}: ${c.title}`,
      data: c.chapters.map((ch) => ({ chapter: ch.number, title: ch.title, verseCount: ch.verseCount, cantoPart: c.number })),
    }));
  } else {
    sections = [{ title: 'Chapters', data: (book.chapters ?? []).map((ch) => ({ chapter: ch.number, title: ch.title, verseCount: ch.verseCount, pageId: ch.pageId })) }];
  }

  // Apply canto/chapter filter
  let filteredSections: SectionData[] = book.hasCantos && selectedCanto !== null
    ? sections.filter((s) => s.data[0]?.cantoPart === selectedCanto)
    : !book.hasCantos && selectedChapter !== null
      ? [{ title: sections[0]?.title ?? 'Chapters', data: sections[0]?.data.filter((d) => d.chapter === selectedChapter) ?? [] }]
      : sections;

  // Front matter (introduction, preface, foreword…) — always shown on top.
  if (book.frontMatter?.length && selectedCanto === null && selectedChapter === null) {
    filteredSections = [
      { title: 'Front Matter', data: book.frontMatter.map((fm, i) => ({ chapter: -1 - i, title: fm.title, verseCount: 0, pageId: fm.id })) },
      ...filteredSections,
    ];
  }

  const goToPage = (pageId: string) => {
    router.push({ pathname: '/verse', params: { book: book.slug, chapter: '1', verse: pageId, canto: '' } });
  };

  return (
    <>
      <Stack.Screen options={{ headerTitle: book.title }} />
      <SectionList
        ref={listRef}
        style={[styles.list, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        sections={filteredSections}
        stickySectionHeadersEnabled={false}
        onScroll={onScrollTrack}
        scrollEventThrottle={64}
        keyExtractor={(item) => `${item.cantoPart ?? 0}-${item.chapter}`}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
              {section.title.toUpperCase()}
            </Text>
            <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chapterRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => (item.pageId ? goToPage(item.pageId) : goToChapter(item.chapter, item.cantoPart))}
          >
            <View style={[styles.chapterNum, { backgroundColor: book.coverColor }]}>
              <Text style={styles.chapterNumText}>{item.chapter < 0 ? '§' : item.chapter}</Text>
            </View>
            <View style={styles.chapterInfo}>
              <Text style={[styles.chapterTitle, { color: colors.text, fontSize: 14 * sc, lineHeight: 20 * sc }]} numberOfLines={2}>
                {item.title}
              </Text>
              {!isProseBook && !item.pageId && (
                <Text style={[styles.chapterVerses, { color: colors.textMuted, fontSize: 12 * sc }]}>
                  {item.verseCount} verses
                </Text>
              )}
            </View>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </Pressable>
        )}
        ListHeaderComponent={
          <>
            <View style={[styles.hero, { backgroundColor: book.coverColor }]}>
              <BookCover book={book} width={110} style={styles.heroCover} />
              <Text style={styles.heroTitle}>{book.title}</Text>
              {book.subtitle ? <Text style={styles.heroSubtitle}>{book.subtitle}</Text> : null}
              <Text style={styles.heroAuthor}>by {book.author}</Text>
              <View style={styles.heroMeta}>
                {book.totalVerses ? (
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>📜 {book.totalVerses.toLocaleString()} verses</Text>
                  </View>
                ) : null}
                <View style={styles.metaBadge}>
                  <Text style={styles.metaBadgeText}>🌐 {book.languages.length} languages</Text>
                </View>
              </View>
              {dl?.status === 'downloaded' ? (
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineBadgeText}>
                    ✓ Available offline · {dl.total} verses
                  </Text>
                </View>
              ) : null}
              <Pressable style={styles.downloadBtn} onPress={handleDownload}>
                <Text style={styles.downloadBtnText}>
                  {dl?.status === 'queued'
                    ? 'Queued · tap to manage'
                    : dl?.status === 'downloading'
                      ? `Downloading… ${Math.round(downloadProgress * 100)}% · tap to manage`
                      : dl?.status === 'downloaded'
                        ? '↻ Re-download'
                        : dl?.status === 'partial'
                          ? `⚠ Resume download (${dl.done}/${dl.total})`
                          : '📥 Download for Offline'}
                </Text>
              </Pressable>
            </View>

            {/* Canto filter — books with multiple cantos (e.g. Srimad-Bhagavatam) */}
            {book.hasCantos && book.cantos && book.cantos.length > 1 ? (
              <View style={[styles.filterSection, { borderBottomColor: colors.border }]}>
                <Text style={[styles.filterLabel, { color: colors.textMuted }]}>CANTO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                  <Pressable
                    style={[styles.filterChip, { backgroundColor: selectedCanto === null ? colors.primary : colors.searchBackground, borderColor: selectedCanto === null ? colors.primary : colors.border }]}
                    onPress={() => setSelectedCanto(null)}
                  >
                    <Text style={[styles.filterChipText, { color: selectedCanto === null ? '#FFF' : colors.textSecondary }]}>All</Text>
                  </Pressable>
                  {book.cantos.map((c) => (
                    <Pressable
                      key={c.number}
                      style={[styles.filterChip, { backgroundColor: selectedCanto === c.number ? colors.primary : colors.searchBackground, borderColor: selectedCanto === c.number ? colors.primary : colors.border }]}
                      onPress={() => setSelectedCanto(selectedCanto === c.number ? null : c.number)}
                    >
                      <Text style={[styles.filterChipText, { color: selectedCanto === c.number ? '#FFF' : colors.textSecondary }]}>
                        Canto {c.number}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Chapter filter — books without cantos with many chapters */}
            {!book.hasCantos && book.chapters && book.chapters.length > 5 ? (
              <View style={[styles.filterSection, { borderBottomColor: colors.border }]}>
                <Text style={[styles.filterLabel, { color: colors.textMuted }]}>CHAPTER</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                  <Pressable
                    style={[styles.filterChip, { backgroundColor: selectedChapter === null ? colors.primary : colors.searchBackground, borderColor: selectedChapter === null ? colors.primary : colors.border }]}
                    onPress={() => setSelectedChapter(null)}
                  >
                    <Text style={[styles.filterChipText, { color: selectedChapter === null ? '#FFF' : colors.textSecondary }]}>All</Text>
                  </Pressable>
                  {book.chapters.map((ch) => (
                    <Pressable
                      key={ch.number}
                      style={[styles.filterChip, { backgroundColor: selectedChapter === ch.number ? colors.primary : colors.searchBackground, borderColor: selectedChapter === ch.number ? colors.primary : colors.border }]}
                      onPress={() => setSelectedChapter(selectedChapter === ch.number ? null : ch.number)}
                    >
                      <Text style={[styles.filterChipText, { color: selectedChapter === ch.number ? '#FFF' : colors.textSecondary }]}>
                        {ch.number}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 18 },
  hero: {
    padding: 24, alignItems: 'center', gap: 8, paddingBottom: 32,
  },
  heroCover: { marginBottom: 6, borderRadius: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  heroTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  heroAuthor: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' },
  metaBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  metaBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  downloadBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  downloadBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  offlineBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12, marginTop: 6,
  },
  offlineBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, marginTop: 20, marginBottom: 8,
  },
  sectionHeaderText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  sectionLine: { flex: 1, height: 1 },
  chapterRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 12,
    marginBottom: 6, borderRadius: 12, borderWidth: 1, overflow: 'hidden', gap: 0,
  },
  chapterNum: {
    width: 50, height: 50, alignItems: 'center', justifyContent: 'center',
  },
  chapterNumText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  chapterInfo: { flex: 1, padding: 12, gap: 3 },
  chapterTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  chapterVerses: { fontSize: 12 },
  chevron: { fontSize: 20, paddingRight: 12 },
});
