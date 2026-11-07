import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useChapterVerses, useChapterTitle } from '@/hooks/useVerse';
import { getBook } from '@/constants/books';
import { Verse } from '@/types';
import { useFavoritesStore } from '@/store/favoritesStore';
import { VerseContent, VerseDisplay } from '@/components/VerseContent';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrackedRoute } from '@/hooks/useTrackedRoute';

const SECTION_OPTIONS: { key: keyof VerseDisplay; label: string }[] = [
  { key: 'devanagari', label: 'Sanskrit' },
  { key: 'transliteration', label: 'Roman' },
  { key: 'synonyms', label: 'Word-for-word' },
  { key: 'translation', label: 'Translation' },
  { key: 'purport', label: 'Purport' },
];

// A bundled title is a real chapter name unless it's a generated placeholder
// like "Chapter 5" (SB cantos 3–12) or "Madhya-līlā Chapter 5" (CC).
function realTitleFromData(title?: string): string | undefined {
  if (!title) return undefined;
  return /chapter\s+\d+\s*$/i.test(title) ? undefined : title;
}

function VerseRow({ verse, onPress, isFav }: {
  verse: Verse; onPress: () => void; isFav: boolean;
}) {
  const { colors } = useTheme();
  const sc = useSettingsStore((s) => s.settings.fontScale ?? 1);
  const preview = verse.translation?.slice(0, 100) ?? verse.synonyms?.slice(0, 100) ?? '';
  return (
    <Pressable
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={[styles.verseNumBox, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.verseNum, { color: colors.primaryDark }]}>{verse.verse}</Text>
      </View>
      <View style={styles.rowContent}>
        {verse.devanagari ? (
          <Text style={[styles.deva, { color: colors.devanagari, fontSize: 15 * sc }]} numberOfLines={1}>
            {verse.devanagari}
          </Text>
        ) : null}
        {preview ? (
          <Text style={[styles.preview, { color: colors.textSecondary, fontSize: 13 * sc, lineHeight: 19 * sc }]} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {isFav && <Text style={[styles.favIcon, { color: colors.saffron }]}>★</Text>}
        <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
      </View>
    </Pressable>
  );
}

// Advanced ("reading") view: the whole verse rendered inline — sloka,
// transliteration, word-for-word, translation and purport — with a header that
// links to the standalone sloka page. Mirrors vedabase's advanced-view.
function AdvancedVerse({ verse, onOpen, isFav, display }: {
  verse: Verse; onOpen: () => void; isFav: boolean; display: VerseDisplay;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.advCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
      <Pressable style={styles.advHeader} onPress={onOpen} hitSlop={6}>
        <View style={[styles.advNumBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.advNumText, { color: colors.primaryDark }]}>
            TEXT {verse.verse}
          </Text>
        </View>
        <View style={styles.advHeaderRight}>
          {isFav && <Text style={[styles.favIcon, { color: colors.saffron }]}>★</Text>}
          <Text style={[styles.advOpenLink, { color: colors.primary }]}>Open sloka ›</Text>
        </View>
      </Pressable>
      <View style={styles.advBody}>
        <VerseContent verse={verse} display={display} />
      </View>
    </View>
  );
}

function NetworkError({ onRetry, colors }: { onRetry: () => void; colors: any }) {
  return (
    <View style={styles.errorWrap}>
      <Text style={styles.errorIcon}>🌐</Text>
      <Text style={[styles.errorTitle, { color: colors.text }]}>Cannot reach Vedabase</Text>
      <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
        Could not load verses from vedabase.io.{'\n\n'}
        The site may be blocking app requests (Cloudflare protection). Try again, or use the offline cache after downloading a book from Settings.
      </Text>
      <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={onRetry}>
        <Text style={styles.retryText}>↺  Retry</Text>
      </Pressable>
    </View>
  );
}

export default function ChapterScreen() {
  const params = useLocalSearchParams<{ book: string; chapter: string; canto: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isFavorite } = useFavoritesStore();

  const bookSlug = params.book ?? '';
  const chapter = parseInt(params.chapter ?? '1', 10);
  const canto = params.canto ? parseInt(params.canto, 10) : undefined;

  const book = getBook(bookSlug);
  const [advanced, setAdvanced] = useState(false);

  // Advanced-view section toggles — seeded from the reader's global preferences,
  // but adjustable per chapter here (mirrors vedabase's advanced-view settings).
  const settings = useSettingsStore((s) => s.settings);
  const [display, setDisplay] = useState<VerseDisplay>({
    devanagari: settings.showDevanagari,
    transliteration: settings.showTransliteration,
    synonyms: settings.showSynonyms,
    translation: settings.showTranslation,
    purport: settings.showPurport,
  });
  const toggleSection = (key: keyof VerseDisplay) =>
    setDisplay((d) => ({ ...d, [key]: !d[key] }));

  // Real chapter name from bundled data (BG, SB cantos 1–2); undefined when it's
  // a placeholder, in which case useChapterTitle fetches the page <h1>.
  const dataTitle = useMemo(() => {
    if (!book) return undefined;
    if (book.hasCantos && book.cantos && canto !== undefined) {
      return realTitleFromData(
        book.cantos.find((c) => c.number === canto)?.chapters.find((ch) => ch.number === chapter)?.title
      );
    }
    return realTitleFromData(book.chapters?.find((ch) => ch.number === chapter)?.title);
  }, [book, chapter, canto]);

  const chapterName = useChapterTitle(bookSlug, chapter, canto, dataTitle);

  // Flat ordered list of all chapters in the book for prev/next navigation
  const allChapters = useMemo(() => {
    if (!book) return [];
    if (book.hasCantos && book.cantos) {
      return book.cantos.flatMap(c =>
        c.chapters.map(ch => ({ chapter: ch.number, canto: c.number as number | undefined }))
      );
    }
    return (book.chapters ?? []).map(ch => ({ chapter: ch.number, canto: undefined as number | undefined }));
  }, [book]);

  const currentChapterIndex = useMemo(
    () => allChapters.findIndex(c => c.chapter === chapter && c.canto === canto),
    [allChapters, chapter, canto]
  );

  const navigateToChapter = (dir: -1 | 1) => {
    const next = currentChapterIndex + dir;
    if (next < 0 || next >= allChapters.length) return;
    const target = allChapters[next];
    router.replace({
      pathname: '/chapter',
      params: {
        book: bookSlug,
        chapter: String(target.chapter),
        canto: target.canto !== undefined ? String(target.canto) : '',
      },
    });
  };

  let verseCount = 10;
  if (book) {
    if (book.hasCantos && book.cantos && canto !== undefined) {
      const c = book.cantos.find((c2) => c2.number === canto);
      const ch = c?.chapters.find((ch2) => ch2.number === chapter);
      verseCount = ch?.verseCount ?? 10;
    } else if (book.chapters) {
      const ch = book.chapters.find((ch2) => ch2.number === chapter);
      verseCount = ch?.verseCount ?? 10;
    }
  }

  const { verses, loading, loadedCount, total, error } = useChapterVerses(bookSlug, chapter, verseCount, canto);

  const reference = canto !== undefined ? `Canto ${canto}, Chapter ${chapter}` : `Chapter ${chapter}`;
  const headerTitle = chapterName ?? reference;

  // Record this chapter in recent-pages history and remember scroll offset so
  // the reader can hop back to the exact verse they were browsing.
  const trackedEntry = React.useCallback(
    () => ({
      kind: 'chapter' as const,
      title: `${book?.title ?? bookSlug} · ${reference}`,
      subtitle: chapterName ?? undefined,
      bookSlug,
    }),
    [book?.title, bookSlug, reference, chapterName],
  );
  const { key: routeKey, savedOffset, onScroll: onScrollTrack } = useTrackedRoute({
    pathname: '/chapter',
    params: { book: bookSlug, chapter: String(chapter), canto: canto !== undefined ? String(canto) : '' },
    entry: trackedEntry,
    visitDeps: [bookSlug, chapter, canto, book?.title, chapterName],
  });

  const listRef = useRef<FlatList<Verse>>(null);
  const restoredForKey = useRef<string | null>(null);
  useEffect(() => {
    if (verses.length === 0 || savedOffset === undefined) return;
    if (restoredForKey.current === routeKey) return;
    restoredForKey.current = routeKey;
    // rAF twice — first for mount, second for FlatList to size its cells.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: savedOffset, animated: false });
      });
    });
  }, [routeKey, verses.length, savedOffset]);

  const navigate = (v: Verse) => {
    router.push({
      pathname: '/verse',
      params: {
        book: v.bookSlug,
        chapter: String(v.chapter),
        verse: String(v.verse),
        canto: v.canto !== undefined ? String(v.canto) : '',
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerTitle }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Initial spinner — only while no verses at all yet */}
        {loading && verses.length === 0 && !error ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading {loadedCount}/{total} verses…
            </Text>
          </View>
        ) : error === 'network' && verses.length === 0 ? (
          <NetworkError colors={colors} onRetry={() => router.replace({ pathname: '/chapter', params })} />
        ) : (
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={verses}
            keyExtractor={(v) => v.id}
            contentContainerStyle={styles.list}
            onScroll={onScrollTrack}
            scrollEventThrottle={64}
            ListHeaderComponent={
              <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.headerEyebrow, { color: colors.textMuted }]}>
                  {book?.title} · {reference}
                </Text>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {chapterName ?? reference}
                </Text>

                {/* List ⇆ Advanced (reading) view toggle */}
                <View style={[styles.viewToggle, { borderColor: colors.border, backgroundColor: colors.searchBackground }]}>
                  <Pressable
                    style={[styles.viewToggleBtn, !advanced && { backgroundColor: colors.primary }]}
                    onPress={() => setAdvanced(false)}
                  >
                    <Text style={[styles.viewToggleText, { color: !advanced ? '#FFF' : colors.textSecondary }]}>☰  List</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.viewToggleBtn, advanced && { backgroundColor: colors.primary }]}
                    onPress={() => setAdvanced(true)}
                  >
                    <Text style={[styles.viewToggleText, { color: advanced ? '#FFF' : colors.textSecondary }]}>▤  Advanced</Text>
                  </Pressable>
                </View>

                {/* Advanced-view section options — tap to show/hide across all verses */}
                {advanced && (
                  <View style={styles.optionsRow}>
                    {SECTION_OPTIONS.map(({ key, label }) => {
                      const on = display[key];
                      return (
                        <Pressable
                          key={key}
                          onPress={() => toggleSection(key)}
                          style={[styles.optionChip, {
                            backgroundColor: on ? colors.primaryLight : 'transparent',
                            borderColor: on ? colors.primary : colors.border,
                          }]}
                        >
                          <Text style={[styles.optionChipText, { color: on ? colors.primaryDark : colors.textMuted }]}>
                            {on ? '✓ ' : ''}{label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {loading && (
                  <View style={styles.progressRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.progressText, { color: colors.textMuted }]}>
                      Loading {loadedCount}/{total}…
                    </Text>
                  </View>
                )}
                {error === 'network' && (
                  <Text style={[styles.partialWarn, { color: colors.warning }]}>
                    ⚠️  Some verses failed to load — check your connection
                  </Text>
                )}
              </View>
            }
            renderItem={({ item }) => (
              advanced ? (
                <AdvancedVerse
                  verse={item}
                  onOpen={() => navigate(item)}
                  isFav={isFavorite(item.id)}
                  display={display}
                />
              ) : (
                <VerseRow
                  verse={item}
                  onPress={() => navigate(item)}
                  isFav={isFavorite(item.id)}
                />
              )
            )}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No verses loaded.</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Prev / Next chapter nav bar */}
        <View style={[styles.chapterNavBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.chapterNavBtn, { backgroundColor: colors.searchBackground, opacity: currentChapterIndex <= 0 ? 0.4 : 1 }]}
            onPress={() => navigateToChapter(-1)}
            disabled={currentChapterIndex <= 0}
          >
            <Text style={[styles.chapterNavBtnText, { color: colors.text }]}>‹ Prev Ch.</Text>
          </Pressable>
          <Text style={[styles.chapterNavLabel, { color: colors.textMuted }]} numberOfLines={1}>
            {canto !== undefined ? `Canto ${canto} · ` : ''}Ch. {chapter}
          </Text>
          <Pressable
            style={[styles.chapterNavBtn, { backgroundColor: colors.primary, opacity: currentChapterIndex >= allChapters.length - 1 ? 0.4 : 1 }]}
            onPress={() => navigateToChapter(1)}
            disabled={currentChapterIndex >= allChapters.length - 1}
          >
            <Text style={[styles.chapterNavBtnText, { color: '#FFF' }]}>Next Ch. ›</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14 },
  list: { padding: 12, gap: 8, paddingBottom: 40 },
  header: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8, gap: 8 },
  headerEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  headerTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  viewToggle: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 3, gap: 3, marginTop: 2 },
  viewToggleBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  viewToggleText: { fontSize: 13, fontWeight: '700' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  optionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  optionChipText: { fontSize: 12, fontWeight: '700' },
  advCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  advHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  advNumBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  advNumText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  advHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  advOpenLink: { fontSize: 13, fontWeight: '700' },
  advBody: { paddingHorizontal: 10, paddingBottom: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { fontSize: 12 },
  partialWarn: { fontSize: 12, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    borderWidth: 1, overflow: 'hidden', minHeight: 64,
  },
  verseNumBox: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  verseNum: { fontSize: 14, fontWeight: '800' },
  rowContent: { flex: 1, padding: 12, gap: 4 },
  deva: { fontSize: 15, fontFamily: 'serif' },
  preview: { fontSize: 13, lineHeight: 19 },
  rowRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 10, gap: 4 },
  favIcon: { fontSize: 14 },
  arrow: { fontSize: 20 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  errorWrap: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorIcon: { fontSize: 52 },
  errorTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorBody: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  codeBox: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  code: { fontFamily: 'monospace', fontSize: 15, fontWeight: '700' },
  retryBtn: { borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12, marginTop: 4 },
  retryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  chapterNavBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 10, borderTopWidth: 1, gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  chapterNavBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  chapterNavBtnText: { fontSize: 13, fontWeight: '700' },
  chapterNavLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
});
