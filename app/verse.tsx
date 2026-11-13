import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
  TextInput, Modal, ActivityIndicator, Platform, KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';

const SCREEN_W = Dimensions.get('window').width;
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useVerse } from '@/hooks/useVerse';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useSearchStore } from '@/store/searchStore';
import { VerseContent, FindLocator } from '@/components/VerseContent';
import { WordMeaningSheet } from '@/components/WordMeaningSheet';
import { VersePreviewPopup, VersePreviewTarget } from '@/components/VersePreviewPopup';
import { PersonalityPopup, PersonalityTarget } from '@/components/PersonalityPopup';
import type { CitationPress, PersonalityPress } from '@/components/VerseContent';
import type { LibraryRef } from '@/services/purport/citations';
import { TagSheet } from '@/components/TagSheet';
import { preloadDictionary, VerseRef } from '@/services/dictionary';
import { getBook } from '@/constants/books';
import { isFlatBook, isChapterPageBook, isVanisourceBook } from '@/services/vedabaseApi';
import { updateReadingProgress } from '@/database/queries';
import { setVerseAsWallpaperAndToday } from '@/utils/setVerseWallpaper';
import { useTrackedRoute } from '@/hooks/useTrackedRoute';

function NoteModal({ visible, initial, onClose, onSave }: {
  visible: boolean; initial: string; onClose: () => void; onSave: (t: string) => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(initial);
  useEffect(() => { if (visible) setText(initial); }, [visible, initial]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Tap the dim area to dismiss */}
        <Pressable style={styles.noteBackdrop} onPress={onClose} />
        <View style={[styles.noteSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.noteTitle, { color: colors.text }]}>My Note</Text>
          <TextInput
            style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.searchBackground }]}
            multiline
            value={text}
            onChangeText={setText}
            placeholder="Write your reflection here…"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <View style={styles.noteActions}>
            <Pressable style={[styles.noteBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.noteBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.noteBtn, { backgroundColor: colors.primary }]} onPress={() => { onSave(text); onClose(); }}>
              <Text style={[styles.noteBtnText, { color: '#FFF' }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type WpStatus = 'idle' | 'busy' | 'done' | 'error';

export default function VerseScreen() {
  const params = useLocalSearchParams<{ book: string; chapter: string; verse: string; canto: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const openSearch = useSearchStore((s) => s.open);

  const bookSlug = params.book ?? '';
  const chapter = parseInt(params.chapter ?? '1', 10);
  const verseNum = params.verse ?? '1';
  const canto = params.canto ? parseInt(params.canto, 10) : undefined;

  const book = getBook(bookSlug);
  const { verse, loading, error, refresh } = useVerse(bookSlug, chapter, verseNum, canto);

  const {
    isFavorite, addFavorite, removeFavorite,
    updateNote, getNote,
  } = useFavoritesStore();

  const [showNote, setShowNote] = useState(false);
  const [showTags, setShowTags] = useState(false);

  // Word meanings are off until the reader turns them on for this page, so a
  // verse opens as plain text. Turning them on loads the English dictionary
  // (once per app run) and makes every word long-pressable; the button shows a
  // spinner until both are done.
  const [meanings, setMeanings] = useState<'off' | 'loading' | 'on'>('off');
  const [dictReady, setDictReady] = useState(false);
  const [wordsReady, setWordsReady] = useState(false);
  const toggleMeanings = () => {
    if (meanings !== 'off') {
      setMeanings('off'); setLookup(null); setWordsReady(false);
      return;
    }
    setMeanings('loading');
    preloadDictionary()
      .catch(() => {}) // Sanskrit meanings don't need it; English retries on lookup
      .finally(() => setDictReady(true));
  };
  useEffect(() => {
    if (meanings === 'loading' && dictReady && wordsReady) setMeanings('on');
  }, [meanings, dictReady, wordsReady]);
  const onLookupReady = useCallback(() => setWordsReady(true), []);

  // Word long-pressed / double-clicked in the verse, shown in the meaning sheet.
  const [lookup, setLookup] = useState<{ word: string; sanskrit: boolean } | null>(null);
  const onWordLookup = useCallback((word: string, sanskrit: boolean) => setLookup({ word, sanskrit }), []);
  // A scripture reference tapped in the purport, previewed in a small card.
  const [preview, setPreview] = useState<VersePreviewTarget | null>(null);
  const onCitationPress = useCallback<CitationPress>(
    (c, at) => setPreview({ label: c.label, ref: c.ref, x: at.x, y: at.y }),
    [],
  );
  // A less familiar personality named in the text, explained in a small card.
  const [person, setPerson] = useState<PersonalityTarget | null>(null);
  const onPersonalityPress = useCallback<PersonalityPress>(
    (p, at) => setPerson({ person: p, x: at.x, y: at.y }),
    [],
  );
  const openLibraryRef = useCallback((r: LibraryRef) => router.push({
    pathname: '/verse',
    params: {
      book: r.bookSlug, chapter: String(r.chapter), verse: r.verse,
      ...(r.canto != null ? { canto: String(r.canto) } : {}),
    },
  }), [router]);
  const [wpStatus, setWpStatus] = useState<WpStatus>('idle');

  // ─── In-page find state ───
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [matchSections, setMatchSections] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const locateMatch = useRef<FindLocator | null>(null);
  const scrollViewH = useRef(0);

  // ─── Swipe slide-in animation ───
  const tx = useSharedValue(0);
  const pendingDir = useRef<-1 | 0 | 1>(0);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  // Slide the new sloka in once it actually renders (not on the route change,
  // which would only animate the loading spinner). Swipe right → enters from the
  // right; swipe left → enters from the left.
  useEffect(() => {
    const dir = pendingDir.current;
    if (dir === 0 || !verse) return;
    pendingDir.current = 0;
    tx.value = -dir * SCREEN_W;            // start off-screen on the entry side
    tx.value = withTiming(0, { duration: 280 });
  }, [verse?.id]);

  const verseId = verse?.id ?? '';
  const fav = isFavorite(verseId);
  const myNote = getNote(verseId);
  // A note written in an earlier session isn't in the store until read.
  useEffect(() => { if (verseId) useFavoritesStore.getState().loadNoteFor(verseId); }, [verseId]);

  useEffect(() => {
    if (verse) {
      updateReadingProgress(bookSlug, chapter, verseNum, canto).catch(() => {});
    }
  }, [verse]);

  // Vanisource books: verseNum is the page id; show its chapter title.
  const vsTitle = isVanisourceBook(bookSlug)
    ? book?.chapters?.find((c) => c.pageId === verseNum)?.title
    : undefined;
  const fmTitle = !vsTitle && /^[a-z]/i.test(verseNum)
    ? book?.frontMatter?.find((f) => f.id === verseNum)?.title
    : undefined;
  let proseTitle: string | undefined;
  if (isChapterPageBook(bookSlug)) {
    const vol = book?.cantos?.find((c) => c.number === canto);
    proseTitle = vol?.chapters.find((ch) => ch.number === chapter)?.title;
  } else if (isFlatBook(bookSlug) && (book?.chapters?.length ?? 0) > 1) {
    proseTitle = book?.chapters?.find((c) => c.number === parseInt(verseNum, 10))?.title;
  }

  const reference = vsTitle
    ? vsTitle
    : fmTitle
      ? fmTitle
      : proseTitle
        ? proseTitle
        : canto
          ? `${book?.title} ${canto}.${chapter}.${verseNum}`
          : `${book?.title} ${chapter}.${verseNum}`;

  // Record this verse in the recent-pages history and remember scroll position
  // so returning here (via the ⏱ menu or Expo Router back) lands where the
  // reader left off.
  const trackedEntry = React.useCallback(
    () => ({
      kind: 'verse' as const,
      title: reference,
      subtitle: book?.title,
      bookSlug,
    }),
    [reference, book?.title, bookSlug],
  );
  const { key: routeKey, savedOffset, onScroll: onScrollTrack } = useTrackedRoute({
    pathname: '/verse',
    params: { book: bookSlug, chapter: String(chapter), verse: verseNum, canto: canto !== undefined ? String(canto) : '' },
    entry: trackedEntry,
    visitDeps: [bookSlug, chapter, verseNum, canto, reference],
  });

  // Restore scroll offset once the verse content is available and laid out.
  const restoredForKey = useRef<string | null>(null);
  useEffect(() => {
    if (!verse || savedOffset === undefined) return;
    if (restoredForKey.current === routeKey) return;
    restoredForKey.current = routeKey;
    // Two rAFs — one to let the ScrollView mount, one to let the VerseContent
    // finish measuring its heavy purport paragraphs before we jump.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: savedOffset, animated: false });
      });
    });
  }, [routeKey, verse, savedOffset]);

  // Save → save and open the tag sheet. Tapping "Saved" reopens the sheet to
  // edit tags; unsaving is the sheet's "Remove from Saved" button.
  const handleFavorite = () => {
    if (!verse) return;
    if (!fav) {
      addFavorite({ verseId, bookSlug: verse.bookSlug, canto: verse.canto, chapter, verse: verseNum });
    }
    setShowTags(true);
  };

  // One-tap: pin as today's sloka AND set it as the home & lock-screen wallpaper.
  const handleWallpaper = async () => {
    if (!verse || wpStatus === 'busy') return;
    setWpStatus('busy');
    try {
      await setVerseAsWallpaperAndToday(verse, isDark, colors.saffron);
      setWpStatus('done');
      Alert.alert(
        Platform.OS === 'web' ? 'Wallpaper downloaded' : 'Wallpaper set',
        Platform.OS === 'web'
          ? `${reference} was downloaded and pinned as today's sloka.`
          : `${reference} is now your home & lock screen wallpaper — and today's sloka.`,
      );
      setTimeout(() => setWpStatus('idle'), 2500);
    } catch {
      setWpStatus('error');
      Alert.alert('Could not set wallpaper', 'Something went wrong. Please try again.');
      setTimeout(() => setWpStatus('idle'), 2500);
    }
  };

  const navigateVerse = (dir: -1 | 1) => {
    const cur = parseInt(verseNum, 10);
    if (isNaN(cur)) return; // front-matter page — no prev/next sequence
    const next = cur + dir;
    if (next < 1) return;
    // Reset find state when moving to a new verse.
    setFindQuery(''); setActiveMatch(0); setMatchSections([]);
    pendingDir.current = dir;              // drives the slide-in direction
    router.replace({
      pathname: '/verse',
      params: { book: bookSlug, chapter: String(chapter), verse: String(next), canto: canto !== undefined ? String(canto) : '' },
    });
  };

  // Horizontal swipe → prev/next. Vertical scroll still works because the pan
  // only activates after a clearly horizontal drag and fails on vertical intent.
  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX < -60) runOnJS(navigateVerse)(1);
      else if (e.translationX > 60) runOnJS(navigateVerse)(-1);
    });

  // ─── Find helpers ───
  const matchCount = matchSections.length;

  const scrollToMatch = (index: number) => {
    if (!matchSections[index]) return;
    locateMatch.current?.(index, contentRef.current, (y) => {
      // Land the match around the upper third of the visible area (not jammed
      // under the toolbar) so it's clearly readable with context above it.
      const offset = scrollViewH.current > 0 ? scrollViewH.current * 0.3 : 140;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - offset), animated: true });
    });
  };

  // Scroll to the current match once it has rendered (highlight moved, the
  // sections forced open, lines laid out) — on every step and as the query
  // changes, like a browser's find.
  const findActive = findOpen && !!findQuery.trim() && matchCount > 0;
  useEffect(() => {
    if (!findActive) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => scrollToMatch(activeMatch));
    });
    return () => cancelAnimationFrame(raf);
  }, [findActive, activeMatch, matchSections]);

  const onFindChange = (text: string) => {
    setFindQuery(text);
    setActiveMatch(0);
  };

  const goMatch = (dir: -1 | 1) => {
    if (matchCount === 0) return;
    setActiveMatch((activeMatch + dir + matchCount) % matchCount);
  };

  const closeFind = () => {
    setFindOpen(false);
    setFindQuery('');
    setActiveMatch(0);
    setMatchSections([]);
  };

  const toolbar = [
    { key: 'save', label: fav ? 'Saved' : 'Save', icon: fav ? '★' : '☆', color: colors.saffron, onPress: handleFavorite },
    { key: 'note', label: myNote ? 'Note ●' : 'Note', icon: '✎', color: colors.textSecondary, onPress: () => setShowNote(true) },
    {
      key: 'meanings',
      label: meanings === 'loading' ? 'Loading…' : meanings === 'on' ? 'Meanings ✓' : 'Meanings',
      icon: 'अ',
      color: meanings === 'on' ? colors.primary : colors.textSecondary,
      onPress: toggleMeanings,
    },
    { key: 'find', label: 'Find', icon: '⌕', color: findOpen ? colors.primary : colors.textSecondary, onPress: () => setFindOpen(o => !o) },
    {
      key: 'wallpaper',
      label: wpStatus === 'done' ? 'Set ✓' : wpStatus === 'busy' ? 'Setting…' : 'Wallpaper',
      icon: '🪷',
      color: wpStatus === 'done' ? colors.success : colors.textSecondary,
      onPress: handleWallpaper,
    },
  ];

  return (
    <>
      <Stack.Screen options={{ headerTitle: reference }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.toolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {toolbar.map(({ key, label, icon, color, onPress }) => (
            <Pressable key={key} onPress={onPress} hitSlop={8} style={styles.toolBtn}>
              {key === 'meanings' && meanings === 'loading'
                ? <ActivityIndicator size="small" color={colors.primary} style={styles.toolSpinner} />
                : <Text style={[styles.toolIcon, { color }]}>{icon}</Text>}
              <Text style={[styles.toolLabel, { color: colors.textMuted }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ─── In-page find bar ─── */}
        {findOpen && (
          <View style={[styles.findBar, { backgroundColor: colors.searchBackground, borderBottomColor: colors.border }]}>
            <Text style={[styles.findIcon, { color: colors.textMuted }]}>⌕</Text>
            <TextInput
              style={[styles.findInput, { color: colors.text }]}
              placeholder="Find on this page…"
              placeholderTextColor={colors.textMuted}
              value={findQuery}
              onChangeText={onFindChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => goMatch(1)}
              autoFocus
            />
            <Text style={[styles.findCount, { color: colors.textMuted }]}>
              {findQuery.trim() ? `${matchCount ? activeMatch + 1 : 0}/${matchCount}` : ''}
            </Text>
            <Pressable onPress={() => goMatch(-1)} hitSlop={8} disabled={matchCount === 0} style={styles.findNav}>
              <Text style={[styles.findNavTxt, { color: matchCount ? colors.text : colors.textMuted }]}>‹</Text>
            </Pressable>
            <Pressable onPress={() => goMatch(1)} hitSlop={8} disabled={matchCount === 0} style={styles.findNav}>
              <Text style={[styles.findNavTxt, { color: matchCount ? colors.text : colors.textMuted }]}>›</Text>
            </Pressable>
            <Pressable onPress={closeFind} hitSlop={8} style={styles.findNav}>
              <Text style={[styles.findNavTxt, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>
        )}

        <Animated.View style={[styles.animArea, slideStyle]}>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading verse…</Text>
          </View>
        ) : error ? (
          <View style={styles.loaderWrap}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={refresh}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : verse ? (
          <GestureDetector gesture={swipe}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.scroll}
              onLayout={(e) => { scrollViewH.current = e.nativeEvent.layout.height; }}
              onScroll={onScrollTrack}
              scrollEventThrottle={64}
              // Android: the first tap on a selectable paragraph focuses it,
              // and the ScrollView would then jump to show that paragraph
              // (seen when tapping a verse reference in a long purport).
              scrollsChildToFocus={false}
            >
              <View ref={contentRef} collapsable={false}>
              {myNote && (
                <Pressable
                  style={[styles.notePreview, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  onPress={() => setShowNote(true)}
                >
                  <Text style={[styles.notePreviewLabel, { color: colors.primary }]}>📝 MY NOTE</Text>
                  <Text style={[styles.notePreviewText, { color: colors.textSecondary }]} numberOfLines={3}>
                    {myNote.content}
                  </Text>
                </Pressable>
              )}

              <VerseContent
                verse={verse}
                query={findOpen ? findQuery : ''}
                activeMatch={activeMatch}
                onMatchSectionsChange={setMatchSections}
                onFindLocator={(fn) => { locateMatch.current = fn; }}
                // A section resized (forced open for the find): re-aim.
                onSectionLayout={() => { if (findActive) scrollToMatch(activeMatch); }}
                onWordLookup={meanings === 'off' ? undefined : onWordLookup}
                onLookupReady={onLookupReady}
                onCitationPress={onCitationPress}
                onPersonalityPress={onPersonalityPress}
              />
              </View>
            </ScrollView>
          </GestureDetector>
        ) : null}
        </Animated.View>

        <View style={[styles.navBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.navBtn, { backgroundColor: colors.searchBackground }]}
            onPress={() => navigateVerse(-1)}
          >
            <Text style={[styles.navBtnText, { color: colors.text }]}>‹ Prev</Text>
          </Pressable>
          {/* Global search within thumb reach — the header icon is a long stretch. */}
          <Pressable
            style={({ pressed }) => [styles.navSearch, { borderColor: colors.primary, backgroundColor: colors.primaryLight, opacity: pressed ? 0.75 : 1 }]}
            onPress={openSearch}
            accessibilityRole="button"
            accessibilityLabel="Search all books"
          >
            <Text style={[styles.navSearchText, { color: colors.primary }]}>⌕  Search</Text>
          </Pressable>
          <Pressable
            style={[styles.navBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigateVerse(1)}
          >
            <Text style={[styles.navBtnText, { color: '#FFF' }]}>Next ›</Text>
          </Pressable>
        </View>
      </View>

      <WordMeaningSheet
        word={lookup?.word ?? null}
        sanskritFirst={lookup?.sanskrit}
        verse={verse}
        onClose={() => setLookup(null)}
        onOpenVerse={(r: VerseRef) => router.push({
          pathname: '/verse',
          params: {
            book: r.bookSlug, chapter: String(r.chapter), verse: r.verse,
            ...(r.canto != null ? { canto: String(r.canto) } : {}),
          },
        })}
      />

      <VersePreviewPopup
        target={preview}
        onClose={() => setPreview(null)}
        onOpenVerse={openLibraryRef}
      />

      <PersonalityPopup
        target={person}
        onClose={() => setPerson(null)}
        onOpenVerse={openLibraryRef}
      />

      <TagSheet
        visible={showTags}
        verseId={verseId}
        title={reference}
        onClose={() => setShowTags(false)}
        onRemove={() => { setShowTags(false); removeFavorite(verseId); }}
      />

      <NoteModal
        visible={showNote}
        initial={myNote?.content ?? ''}
        onClose={() => setShowNote(false)}
        onSave={(text) => { if (verseId) updateNote(verseId, text); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  animArea: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 3 },
  toolIcon: { fontSize: 20, fontWeight: '600', height: 27, lineHeight: 27, textAlign: 'center', includeFontPadding: false },
  toolSpinner: { height: 27 },
  toolLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },

  findBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1,
  },
  findIcon: { fontSize: 18 },
  findInput: { flex: 1, fontSize: 15, paddingVertical: Platform.OS === 'ios' ? 4 : 0 },
  findCount: { fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' },
  findNav: { paddingHorizontal: 6, paddingVertical: 2 },
  findNavTxt: { fontSize: 20, fontWeight: '700' },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#FFF', fontWeight: '700' },
  scroll: { padding: 16, gap: 16, paddingBottom: 16 },
  notePreview: {
    borderRadius: 12, borderWidth: 1, padding: 12, gap: 4,
  },
  notePreviewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  notePreviewText: { fontSize: 13, lineHeight: 20 },
  navBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 10, borderTopWidth: 1, gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  navBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
  },
  navBtnText: { fontSize: 14, fontWeight: '700' },
  navSearch: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 22, borderWidth: 1.5,
  },
  navSearchText: { fontSize: 15, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  noteBackdrop: { flex: 1 },
  noteSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14,
  },
  noteTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  noteInput: {
    minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 15, textAlignVertical: 'top',
  },
  noteActions: { flexDirection: 'row', gap: 10 },
  noteBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', borderColor: 'transparent',
  },
  noteBtnText: { fontSize: 15, fontWeight: '700' },
});
