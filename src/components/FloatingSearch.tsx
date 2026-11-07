import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Pressable, Text, StyleSheet, Platform, View, TextInput,
  FlatList, ActivityIndicator, Dimensions, Keyboard,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { parseVerseRef, findMatchingBooks, VerseRef } from '@/utils/parseVerseRef';
import { searchVerses } from '@/database/queries';
import { BOOKS } from '@/constants/books';
import { useSearchStore } from '@/store/searchStore';
import { Verse } from '@/types';
import { queryTerms } from '@/utils/searchMatch';
import { groupSearchResults, HitField, SearchHit } from '@/utils/searchSections';
import { HighlightedText } from '@/components/HighlightedText';
import { isPartialResult } from '@/utils/searchRelevance';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type ResultItem =
  | { kind: 'ref'; data: VerseRef; primary: boolean }
  | { kind: 'book'; data: (typeof BOOKS)[number] }
  | { kind: 'header'; key: HitField; title: string; count: number }
  | { kind: 'hit'; data: SearchHit }
  | { kind: 'more'; key: HitField; remaining: number }
  | { kind: 'notice'; text: string };

// Hits shown per section before its "Show more" row.
const SECTION_PREVIEW = 4;

// Which part of a BG/SB/CC verse a snippet comes from.
const SOURCE_LABEL: Record<SearchHit['source'], string> = {
  transliteration: 'ŚLOKA',
  devanagari: 'ŚLOKA',
  synonyms: 'WORD FOR WORD',
  translation: 'TRANSLATION',
  purport: 'PURPORT',
};

const SECTIONED_BOOKS = new Set(['bg', 'sb', 'cc']);

export function FloatingSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [verseRef, setVerseRef] = useState<VerseRef | null>(null);
  const [bookMatches, setBookMatches] = useState<(typeof BOOKS)>([]);
  const [results, setResults] = useState<Verse[]>([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<HitField>>(new Set());
  const [loading, setLoading] = useState(false);
  const [kb, setKb] = useState(0); // current keyboard height (0 when hidden)

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped per search so a slow, older search can't overwrite newer results.
  const searchId = useRef(0);
  const inputRef = useRef<TextInput>(null);

  // Edge-to-edge (Expo SDK 56) does not resize the screen for the keyboard on
  // either platform, so we track its height and lift the bar above it manually.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Search pill on the verse page — open the panel and focus the input.
  // On the verse screen the input isn't mounted until the panel opens, so it
  // relies on autoFocus there instead.
  const openRequest = useSearchStore((s) => s.openRequest);
  useEffect(() => {
    if (openRequest === 0) return;
    setFocused(true);
    inputRef.current?.focus();
  }, [openRequest]);

  const reset = () => {
    setQuery('');
    setVerseRef(null);
    setBookMatches([]);
    setResults([]);
    setOpenSections(new Set());
    searchId.current++;
    setLoading(false);
    if (debounce.current) clearTimeout(debounce.current);
  };

  const collapse = () => {
    reset();
    setFocused(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  const go = (path: string, params: Record<string, string>) => {
    collapse();
    router.push({ pathname: path as any, params });
  };

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    searchId.current++; // whatever is in flight is now stale

    const trimmed = text.trim();
    // Show the spinner from the first keystroke, not only once the debounced
    // query starts, so it's clear the results are being re-evaluated.
    setLoading(trimmed.length >= 2);
    if (trimmed.length < 1) {
      setVerseRef(null); setBookMatches([]); setResults([]);
      return;
    }

    setVerseRef(parseVerseRef(trimmed));
    setBookMatches(trimmed.length >= 2 ? findMatchingBooks(trimmed).slice(0, 3) : []);

    if (trimmed.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      const id = ++searchId.current;
      try {
        const found = await searchVerses(trimmed, undefined, 120);
        if (id !== searchId.current) return;
        setResults(found);
        setSearchedQuery(trimmed);
        setOpenSections(new Set());
      }
      catch { if (id === searchId.current) setResults([]); }
      finally { if (id === searchId.current) setLoading(false); }
    }, 350);
  }, []);

  // Terms of the query the current results came from, so highlights never run
  // ahead of the (debounced) results while the user is still typing.
  const terms = useMemo(() => queryTerms(searchedQuery), [searchedQuery]);
  const sections = useMemo(() => groupSearchResults(results, terms), [results, terms]);
  const partial = useMemo(() => isPartialResult(results, terms), [results, terms]);

  // The verse screen (in-page Find bar + bottom nav) and the Download Manager
  // (its "Download N books" bar) have their own bottom bars, so the
  // always-visible bar stays off those routes to avoid stacking two; it only
  // appears there as an overlay when opened from the header icon.
  const onVerse = pathname === '/verse';
  const hideIdleBar = onVerse || pathname === '/downloads';
  const expanded = focused || query.length > 0;
  if (hideIdleBar && !expanded) return null;

  const items: ResultItem[] = [
    ...(verseRef ? [{ kind: 'ref' as const, data: verseRef, primary: true }] : []),
    ...(verseRef?.alternates ?? []).map(alt => ({ kind: 'ref' as const, data: alt, primary: false })),
    ...bookMatches.map(b => ({ kind: 'book' as const, data: b })),
    ...(partial ? [{ kind: 'notice' as const, text: `No downloaded verse has all of "${searchedQuery}" — closest matches:` }] : []),
    ...sections.flatMap((sec): ResultItem[] => {
      const open = openSections.has(sec.key);
      const shown = open ? sec.hits : sec.hits.slice(0, SECTION_PREVIEW);
      return [
        { kind: 'header', key: sec.key, title: sec.title, count: sec.hits.length },
        ...shown.map((h): ResultItem => ({ kind: 'hit', data: h })),
        ...(sec.hits.length > shown.length
          ? [{ kind: 'more' as const, key: sec.key, remaining: sec.hits.length - shown.length }]
          : []),
      ];
    }),
  ];

  const expandSection = (key: HitField) =>
    setOpenSections((prev) => new Set(prev).add(key));

  // When the keyboard is open, sit just above it; otherwise float above the tab bar.
  const barBottom = kb > 0 ? kb + 8 : (Platform.OS === 'ios' ? insets.bottom + 58 : 64);
  // Use the room between the status bar and the search bar (≈56px tall).
  const panelMax = Math.max(220, Math.min(SCREEN_HEIGHT * 0.7, SCREEN_HEIGHT - barBottom - insets.top - 56 - 24));

  return (
    <>
      {/* Dim backdrop while searching — tap to dismiss */}
      {expanded && <Pressable style={styles.backdrop} onPress={collapse} />}

      <View style={[styles.wrap, { bottom: barBottom }]} pointerEvents="box-none">
        {/* Results panel floats ABOVE the bar */}
        {expanded && (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FlatList
              data={items}
              keyExtractor={(item, i) => `${item.kind}-${i}`}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                query.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                      Type a verse reference or search by topic
                    </Text>
                    <View style={styles.chipRow}>
                      {['bg 1.1', 'sb 1.1.1', 'bg 2.47', 'cc 1.1.1'].map((ex) => (
                        <Pressable
                          key={ex}
                          style={[styles.chip, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                          onPress={() => handleSearch(ex)}
                        >
                          <Text style={[styles.chipText, { color: colors.primary }]}>{ex}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : !loading ? (
                  <Text style={[styles.emptyHint, { color: colors.textMuted, padding: 20 }]}>
                    No results — try a reference like "bg 1.1"
                  </Text>
                ) : null
              }
              style={{ maxHeight: panelMax, opacity: loading && items.length > 0 ? 0.55 : 1 }}
              ListHeaderComponent={
                loading && items.length > 0 ? (
                  <View style={styles.searchingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.searchingText, { color: colors.primary }]}>Updating results…</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                loading && items.length === 0 ? <ActivityIndicator color={colors.primary} style={{ padding: 14 }} /> : null
              }
              renderItem={({ item }) => {
                if (item.kind === 'ref') {
                  const ref = item.data;
                  const book = BOOKS.find(b => b.slug === ref.bookSlug);
                  const bg = item.primary ? colors.primary : colors.surfaceElevated;
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        styles.row,
                        { backgroundColor: bg, opacity: pressed ? 0.88 : 1 },
                        !item.primary && { borderColor: colors.border, borderWidth: 1 },
                      ]}
                      onPress={() => go('/verse', {
                        book: ref.bookSlug,
                        chapter: String(ref.chapter),
                        verse: ref.verse,
                        canto: ref.canto !== undefined ? String(ref.canto) : '',
                      })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowEyebrow, !item.primary && { color: colors.textMuted }]}>
                          {item.primary ? 'JUMP TO VERSE' : 'ALSO COULD MEAN'}
                        </Text>
                        <Text style={[styles.rowTitle, !item.primary && { color: colors.text }]}>{ref.label}</Text>
                        {book && (
                          <Text style={[styles.rowSub, !item.primary && { color: colors.textMuted }]}>{book.title}</Text>
                        )}
                      </View>
                      <Text style={[styles.arrow, { color: item.primary ? '#FFF' : colors.textMuted }]}>→</Text>
                    </Pressable>
                  );
                }

                if (item.kind === 'book') {
                  const b = item.data;
                  return (
                    <Pressable
                      style={({ pressed }) => [styles.row, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.8 : 1 }]}
                      onPress={() => go('/book/[slug]', { slug: b.slug })}
                    >
                      <View style={[styles.spine, { backgroundColor: b.coverColor }]} />
                      <View style={{ flex: 1, paddingHorizontal: 12 }}>
                        <Text style={[styles.rowTitle, { color: colors.text, fontSize: 14 }]} numberOfLines={1}>{b.title}</Text>
                        {b.subtitle ? <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>{b.subtitle}</Text> : null}
                      </View>
                      <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
                    </Pressable>
                  );
                }

                if (item.kind === 'header') {
                  return (
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{item.title.toUpperCase()}</Text>
                      <View style={[styles.sectionCount, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.sectionCountText, { color: colors.primary }]}>{item.count}</Text>
                      </View>
                      <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
                    </View>
                  );
                }

                if (item.kind === 'notice') {
                  return <Text style={[styles.notice, { color: colors.textMuted }]}>{item.text}</Text>;
                }

                if (item.kind === 'more') {
                  return (
                    <Pressable
                      style={({ pressed }) => [styles.moreRow, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => expandSection(item.key)}
                    >
                      <Text style={[styles.moreText, { color: colors.primary }]}>Show {item.remaining} more</Text>
                    </Pressable>
                  );
                }

                const { verse: v, field, source, runs } = item.data;
                const book = BOOKS.find(b => b.slug === v.bookSlug);
                const num = v.canto ? `${v.canto}.${v.chapter}.${v.verse}` : `${v.chapter}.${v.verse}`;
                const ref = SECTIONED_BOOKS.has(v.bookSlug)
                  ? `${v.bookSlug.toUpperCase()} ${num}  ·  ${SOURCE_LABEL[source]}`
                  : `${book?.title ?? v.bookSlug}  ${num}`;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.8 : 1 }]}
                    onPress={() => go('/verse', {
                      book: v.bookSlug,
                      chapter: String(v.chapter),
                      verse: String(v.verse),
                      canto: v.canto !== undefined ? String(v.canto) : '',
                    })}
                  >
                    <View style={[styles.spine, { backgroundColor: book?.coverColor ?? colors.primary }]} />
                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                      <Text style={[styles.rowEyebrow, { color: colors.primary }]} numberOfLines={1}>{ref}</Text>
                      <HighlightedText
                        runs={runs}
                        numberOfLines={source === 'transliteration' || source === 'devanagari' ? 4 : 3}
                        style={[styles.snippet, { color: colors.textSecondary }, (source === 'transliteration' || source === 'devanagari') && styles.snippetShloka]}
                        highlightStyle={{ color: colors.primary, backgroundColor: colors.primaryLight, fontWeight: '800', fontStyle: 'normal' }}
                      />
                    </View>
                    <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* Always-visible floating search bar */}
        <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: expanded ? colors.primary : colors.border }]}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.barSpinner} />
          ) : (
            <Text style={[styles.barIcon, { color: colors.primary }]}>⌕</Text>
          )}
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text }]}
            placeholder='Search — "bg 1.1", "yoga"…'
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleSearch}
            onFocus={() => setFocused(true)}
            autoFocus={hideIdleBar}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => handleSearch('')} hitSlop={10}>
              <Text style={[styles.clearBtn, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 998,
  },
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  panel: {
    width: '92%',
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  listContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '92%',
    maxWidth: 560,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    borderRadius: 28,
    borderWidth: 1.5,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  barIcon: { fontSize: 20 },
  input: { flex: 1, fontSize: 15 },
  clearBtn: { fontSize: 15, paddingHorizontal: 4 },
  barSpinner: { width: 22 },
  searchingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  searchingText: { fontSize: 12, fontWeight: '700' },

  emptyState: { paddingHorizontal: 16, paddingVertical: 20, gap: 14, alignItems: 'center' },
  emptyHint: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  chipText: {
    fontSize: 13, fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, overflow: 'hidden',
  },
  spine: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 0 },
  rowEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  rowTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  rowSub: { fontSize: 11, color: 'rgba(255,255,255,0.72)', fontStyle: 'italic', marginTop: 1 },
  arrow: { fontSize: 20, paddingLeft: 8 },
  snippet: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  snippetShloka: { fontStyle: 'italic' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 2, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  sectionCount: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8 },
  sectionCountText: { fontSize: 10, fontWeight: '800' },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  moreRow: { alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
  moreText: { fontSize: 13, fontWeight: '700' },
  notice: { fontSize: 12, fontStyle: 'italic', lineHeight: 18, paddingHorizontal: 4, paddingTop: 4 },
});
