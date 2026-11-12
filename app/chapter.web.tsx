// Desktop chapter page, like vedabase.io's chapter view: every text with its
// translation in one list, or the whole chapter to read continuously (the
// phone's "Advanced" view) with per-section toggles. Contents sidebar and
// ← / → move between chapters.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useChapterVerses, useChapterTitle } from '@/hooks/useVerse';
import { getBook } from '@/constants/books';
import { Verse } from '@/types';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useSettingsStore, fontSizeMap } from '@/store/settingsStore';
import { useTrackedRoute } from '@/hooks/useTrackedRoute';
import { BookToc } from '@/desktop/BookToc';
import { ReaderVerse, Display, SectionKey } from '@/desktop/ReaderVerse';
import { Breadcrumbs, Btn, IconBtn, Segmented, Chip, Empty } from '@/desktop/ui';
import { useDesktopUi, typingInField } from '@/desktop/uiStore';
import { FocusBar, FullScreenBtn } from '@/desktop/FocusBar';
import { useAutoHideBar, AutoHideBar, BarSpacer } from '@/desktop/autoHide';
import { bookCrumbs, flatChapters, chapterHref, verseHref, shortRef } from '@/desktop/bookNav';
import { SANS, SERIF, READING_W_WIDE, tints, web } from '@/desktop/theme';

type PState = { pressed: boolean; hovered?: boolean };

const SECTION_OPTIONS: { key: SectionKey; label: string }[] = [
  { key: 'devanagari', label: 'Devanāgarī' },
  { key: 'transliteration', label: 'Verse text' },
  { key: 'synonyms', label: 'Synonyms' },
  { key: 'translation', label: 'Translation' },
  { key: 'purport', label: 'Purport' },
];

function realTitle(title?: string) {
  return title && !/chapter\s+\d+\s*$/i.test(title) ? title : undefined;
}

function VerseListItem({ v, onPress, fav }: { v: Verse; onPress: () => void; fav: boolean }) {
  const { colors } = useTheme();
  const t = tints(colors);
  const settings = useSettingsStore((st) => st.settings);
  const base = fontSizeMap[settings.fontSize] + 1;
  const sc = settings.fontScale ?? 1;
  const text = v.translation || v.synonyms || v.purport?.slice(0, 400) || '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={(st: PState) => [s.item, { backgroundColor: st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer', transition: 'background-color 120ms' })]}
    >
      {(st: PState) => (
        <>
          <Text style={[s.itemRef, { color: colors.primary }, st.hovered && { textDecorationLine: 'underline' }]}>
            TEXT {v.verseRange || v.verse}{fav ? <Text style={{ color: colors.saffron }}>{'  ★'}</Text> : null}
          </Text>
          <Text style={[s.itemText, { color: colors.text, fontSize: Math.round(base * sc), lineHeight: Math.round(base * sc * 1.6) }]}>{text}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function ChapterScreen() {
  const params = useLocalSearchParams<{ book: string; chapter: string; canto: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isFavorite } = useFavoritesStore();
  const settings = useSettingsStore((st) => st.settings);
  const tocOpen = useDesktopUi((st) => st.tocOpen);
  const toggleToc = useDesktopUi((st) => st.toggleToc);
  const focus = useDesktopUi((st) => st.focusMode);

  const bookSlug = params.book ?? '';
  const chapter = parseInt(params.chapter ?? '1', 10) || 1;
  const canto = params.canto ? parseInt(params.canto, 10) : undefined;
  const book = getBook(bookSlug);
  const [mode, setMode] = useState<'list' | 'read'>('list');
  // Full screen is for reading: switch the chapter to continuous text.
  useEffect(() => { if (focus) setMode('read'); }, [focus]);
  const [display, setDisplay] = useState<Display>({
    devanagari: settings.showDevanagari,
    transliteration: settings.showTransliteration,
    synonyms: settings.showSynonyms,
    translation: settings.showTranslation,
    purport: settings.showPurport,
  });

  const chapters = useMemo(() => (book ? flatChapters(book) : []), [book]);
  const ci = chapters.findIndex((c) => c.chapter === chapter && c.canto === canto);
  const meta = chapters[ci];
  const chapterName = useChapterTitle(bookSlug, chapter, canto, realTitle(meta?.title));
  const { verses, loading, loadedCount, total, error } = useChapterVerses(bookSlug, chapter, meta?.verseCount ?? 10, canto);

  const reference = canto !== undefined ? `Canto ${canto}, Chapter ${chapter}` : `Chapter ${chapter}`;
  const trackedEntry = React.useCallback(() => ({
    kind: 'chapter' as const, title: `${book?.title ?? bookSlug} · ${reference}`, subtitle: chapterName ?? undefined, bookSlug,
  }), [book?.title, bookSlug, reference, chapterName]);
  const { key: routeKey, savedOffset, onScroll } = useTrackedRoute({
    pathname: '/chapter',
    params: { book: bookSlug, chapter: String(chapter), canto: canto !== undefined ? String(canto) : '' },
    entry: trackedEntry,
    visitDeps: [bookSlug, chapter, canto, book?.title, chapterName],
  });
  const scrollRef = useRef<ScrollView>(null);
  const bar = useAutoHideBar();
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (!verses.length || restored.current === routeKey) return;
    restored.current = routeKey;
    requestAnimationFrame(() => requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: savedOffset ?? 0, animated: false })));
  }, [routeKey, verses.length, savedOffset]);

  const prev = ci > 0 ? chapters[ci - 1] : undefined;
  const next = ci >= 0 && ci < chapters.length - 1 ? chapters[ci + 1] : undefined;
  const goCh = (c?: typeof prev) => { if (book && c) router.replace(chapterHref(book, c)); };
  const navRef = useRef({ prev, next });
  navRef.current = { prev, next };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingInField() || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (document.querySelector('[data-vb-pop], [aria-modal="true"]')) return;
      if (e.key === 'ArrowLeft' && navRef.current.prev) { e.preventDefault(); goCh(navRef.current.prev); }
      if (e.key === 'ArrowRight' && navRef.current.next) { e.preventDefault(); goCh(navRef.current.next); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book]);

  if (!book) return <Empty icon="📚" title="Book not found" />;

  const open = (v: Verse) => router.push(verseHref(v.bookSlug, v.chapter, String(v.verse), v.canto));
  const chLabel = (c: NonNullable<typeof prev>) => (c.canto !== undefined && c.canto !== canto ? `Canto ${c.canto} · Ch. ${c.chapter}` : `Chapter ${c.chapter}`);

  return (
    <View style={s.row}>
      {tocOpen && !focus ? <BookToc book={book} canto={canto} chapter={chapter} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AutoHideBar bar={bar}>
        {focus ? (
          <FocusBar label={`${book.title} · ${reference}`}>
            <Segmented<'list' | 'read'>
              value={mode}
              onChange={setMode}
              options={[{ key: 'list', label: '☰  Verses' }, { key: 'read', label: '▤  Read continuously' }]}
            />
          </FocusBar>
        ) : (
        <View style={[s.toolbar, { borderBottomColor: colors.border }]}>
          {!tocOpen ? <IconBtn icon="☰" tip="Show contents  [" onPress={toggleToc} size={32} /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Breadcrumbs items={[...bookCrumbs(book, canto), { label: `Chapter ${chapter}` }]} />
          </View>
          <Segmented<'list' | 'read'>
            value={mode}
            onChange={setMode}
            options={[{ key: 'list', label: '☰  Verses' }, { key: 'read', label: '▤  Read continuously' }]}
          />
          <FullScreenBtn onBefore={() => setMode('read')} />
        </View>
        )}
        </AutoHideBar>

        <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }} {...({ onClick: bar.onTap } as any)}>
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.scroll} onScroll={(e) => { onScroll(e); bar.onScrollY(e.nativeEvent.contentOffset.y); }} scrollEventThrottle={32}>
            <BarSpacer bar={bar} />
            <View style={s.column} dataSet={{ vbPage: '1' }}>
              <Text style={[s.eyebrow, { color: colors.primary }]}>{book.title.toUpperCase()} · {reference.toUpperCase()}</Text>
              <Text style={[s.title, { color: colors.text }]}>{chapterName ?? reference}</Text>

              {mode === 'read' ? (
                <View style={s.options}>
                  {SECTION_OPTIONS.map(({ key, label }) => (
                    <Chip key={key} small label={(display[key] ? '✓ ' : '') + label} on={display[key]} onPress={() => setDisplay((d) => ({ ...d, [key]: !d[key] }))} />
                  ))}
                </View>
              ) : null}

              {loading ? (
                <View style={s.progress}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[s.progressText, { color: colors.textMuted }]}>Loading {loadedCount} / {total} texts…</Text>
                </View>
              ) : null}
              {error === 'network' && verses.length === 0 ? (
                <Empty icon="🌐" title="Cannot reach vedabase.io" body="Could not load this chapter. Download the book for offline reading, or try again." action={<Btn label="↺ Retry" kind="primary" onPress={() => router.replace({ pathname: '/chapter', params })} />} />
              ) : error === 'network' ? (
                <Text style={[s.warn, { color: colors.warning }]}>⚠ Some texts failed to load — check your connection.</Text>
              ) : null}

              {mode === 'list' ? (
                <View style={{ gap: 2, marginTop: 8 }}>
                  {verses.map((v) => <VerseListItem key={v.id} v={v} fav={isFavorite(v.id)} onPress={() => open(v)} />)}
                </View>
              ) : (
                <View style={{ gap: 44, marginTop: 12 }}>
                  {verses.map((v) => (
                    <View key={v.id} style={[s.readBlock, { borderTopColor: colors.border }]}>
                      <Pressable onPress={() => open(v)} style={[s.readHead, web({ cursor: 'pointer' })]} accessibilityRole="link">
                        {(st: PState) => (
                          <Text style={[s.readRef, { color: st.hovered ? colors.primary : colors.text }]}>
                            {shortRef(book, chapter, String(v.verseRange || v.verse), canto)}
                            {isFavorite(v.id) ? <Text style={{ color: colors.saffron }}>{'  ★'}</Text> : null}
                            <Text style={[s.readOpen, { color: colors.primary, opacity: st.hovered ? 1 : 0.6 }]}>{'   Open ›'}</Text>
                          </Text>
                        )}
                      </Pressable>
                      <ReaderVerse verse={v} display={display} compact />
                    </View>
                  ))}
                </View>
              )}
              {!loading && verses.length === 0 && !error ? <Empty icon="📜" title="No texts loaded" /> : null}

              <View style={[s.bottomNav, { borderTopColor: colors.border }]}>
                {prev && !focus ? <Btn label={`‹  ${chLabel(prev)}`} onPress={() => goCh(prev)} /> : <View />}
                {next ? <Btn label={`${chLabel(next)}  ›`} kind="primary" onPress={() => goCh(next)} /> : <View />}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', minHeight: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  scroll: { paddingTop: 36, paddingBottom: 80, alignItems: 'center' },
  column: { width: '100%', maxWidth: READING_W_WIDE, paddingHorizontal: 48 },
  eyebrow: { fontFamily: SANS, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.4, textAlign: 'center' },
  title: { fontFamily: SERIF, fontSize: 30, fontWeight: '700', textAlign: 'center', marginTop: 10, marginBottom: 18, lineHeight: 40 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 8 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 10 },
  progressText: { fontFamily: SANS, fontSize: 13 },
  warn: { fontFamily: SANS, fontSize: 13, textAlign: 'center', marginVertical: 8 },
  item: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10, gap: 5 },
  itemRef: { fontFamily: SANS, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.8 },
  itemText: { fontFamily: SERIF },
  readBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 28, gap: 18 },
  readHead: { alignSelf: 'center' },
  readRef: { fontFamily: SERIF, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  readOpen: { fontFamily: SANS, fontSize: 13, fontWeight: '600' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, marginTop: 36 },
});
