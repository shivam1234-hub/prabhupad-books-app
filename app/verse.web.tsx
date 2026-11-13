// Desktop verse page, modelled on vedabase.io's verse view: breadcrumbs, a
// centred reading column, ← / → keys for prev / next, and a
// collapsible contents sidebar. Every action of the phone's verse screen is
// here except the phone-only wallpaper: save + tags, note, word meanings, find in page,
// verse-reference previews and personalities.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Href } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useVerse } from '@/hooks/useVerse';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { WordMeaningSheet } from '@/components/WordMeaningSheet';
import { VersePreviewPopup, VersePreviewTarget } from '@/components/VersePreviewPopup';
import { PersonalityPopup, PersonalityTarget } from '@/components/PersonalityPopup';
import type { LibraryRef } from '@/services/purport/citations';
import { preloadDictionary, VerseRef } from '@/services/dictionary';
import { getBook } from '@/constants/books';
import { isFlatBook, isChapterPageBook, isVanisourceBook } from '@/services/vedabaseApi';
import { updateReadingProgress } from '@/database/queries';
import { useTrackedRoute } from '@/hooks/useTrackedRoute';
import { BookToc } from '@/desktop/BookToc';
import { ReaderVerse, Display, LinkedCitation, Anchor } from '@/desktop/ReaderVerse';
import { Breadcrumbs, Btn, IconBtn, Empty } from '@/desktop/ui';
import { FocusBar, FullScreenBtn } from '@/desktop/FocusBar';
import { Presentation, PresentControls } from '@/desktop/Presentation';
import { useAutoHideBar, AutoHideBar, BarSpacer, useRevealAtTop } from '@/desktop/autoHide';
import { TagDialog, NoteDialog } from '@/desktop/VerseDialogs';
import { useDesktopUi, typingInField, uiBusy } from '@/desktop/uiStore';
import { hoverIntent } from '@/desktop/hoverIntent';
import {
  bookCrumbs, flatChapters, chapterHref, verseHref, useVerseIds, idContains, shortRef, chapterMeta, isProseBook,
} from '@/desktop/bookNav';
import { SANS, SERIF, READING_W_WIDE, tints, web } from '@/desktop/theme';

type PState = { pressed: boolean; hovered?: boolean };
const libHref = (r: LibraryRef): Href => verseHref(r.bookSlug, r.chapter, r.verse, r.canto ?? undefined);

export default function VerseScreen() {
  const params = useLocalSearchParams<{ book: string; chapter: string; verse: string; canto: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = tints(colors);
  const settings = useSettingsStore((st) => st.settings);
  const tocOpen = useDesktopUi((st) => st.tocOpen);
  const toggleToc = useDesktopUi((st) => st.toggleToc);
  const focus = useDesktopUi((st) => st.focusMode);
  const presentMode = useDesktopUi((st) => st.presentMode);
  useEffect(() => { if (focus) closeFind(); }, [focus]);
  // Entering presentation (or opening another verse in it, e.g. from search):
  // let the audience see only the text after a moment.
  useEffect(() => {
    if (!(focus && presentMode !== 'full')) return;
    // …unless the user is typing in the search box or has a popup open.
    const id = setTimeout(() => { if (!uiBusy()) useDesktopUi.getState().setBarsShown(false); }, 1800);
    return () => clearTimeout(id);
  }, [focus, presentMode, params.book, params.chapter, params.verse, params.canto]);

  const bookSlug = params.book ?? '';
  const chapter = parseInt(params.chapter ?? '1', 10) || 1;
  const verseNum = params.verse ?? '1';
  const canto = params.canto ? parseInt(params.canto, 10) : undefined;
  const book = getBook(bookSlug);
  const { verse, loading, error, refresh } = useVerse(bookSlug, chapter, verseNum, canto);
  const { isFavorite, addFavorite, removeFavorite, updateNote, getNote } = useFavoritesStore();
  // Full screen + "Śloka" / "Translation": only that text, filling the screen.
  const presenting = focus && presentMode !== 'full' && !!verse && !loading;

  const verseId = verse?.id ?? '';
  const fav = isFavorite(verseId);
  const myNote = getNote(verseId);
  // A note written in an earlier session isn't in the store until read.
  useEffect(() => { if (verseId) useFavoritesStore.getState().loadNoteFor(verseId); }, [verseId]);
  const [showNote, setShowNote] = useState(false);
  const [showTags, setShowTags] = useState(false);

  // ─── Titles ───
  const vsTitle = isVanisourceBook(bookSlug) ? book?.chapters?.find((c) => c.pageId === verseNum)?.title : undefined;
  const fmTitle = !vsTitle && /^[a-z]/i.test(verseNum) ? book?.frontMatter?.find((f) => f.id === verseNum)?.title : undefined;
  let proseTitle: string | undefined;
  if (isChapterPageBook(bookSlug)) proseTitle = book?.cantos?.find((c) => c.number === canto)?.chapters.find((ch) => ch.number === chapter)?.title;
  else if (isFlatBook(bookSlug) && (book?.chapters?.length ?? 0) > 1) proseTitle = book?.chapters?.find((c) => c.number === parseInt(verseNum, 10))?.title;
  const pageTitle = vsTitle ?? fmTitle ?? proseTitle;
  const displayNum = verse?.verseRange || verseNum;
  const heading = pageTitle ?? (book ? shortRef(book, chapter, displayNum, canto) : verseNum);
  const reference = pageTitle ?? (canto ? `${book?.title} ${canto}.${chapter}.${verseNum}` : `${book?.title} ${chapter}.${verseNum}`);
  const chMeta = book && !pageTitle ? chapterMeta(book, chapter, canto) : undefined;

  // ─── History + scroll restore (same store as the phone) ───
  const trackedEntry = useCallback(() => ({ kind: 'verse' as const, title: reference, subtitle: book?.title, bookSlug }), [reference, book?.title, bookSlug]);
  const { key: routeKey, savedOffset, onScroll } = useTrackedRoute({
    pathname: '/verse',
    params: { book: bookSlug, chapter: String(chapter), verse: verseNum, canto: canto !== undefined ? String(canto) : '' },
    entry: trackedEntry,
    visitDeps: [bookSlug, chapter, verseNum, canto, reference],
  });
  const scrollRef = useRef<ScrollView>(null);
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (!verse) return;
    if (restored.current === routeKey) return;
    restored.current = routeKey;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: savedOffset && savedOffset > 8 ? savedOffset : 0, animated: false });
    }));
  }, [routeKey, verse, savedOffset]);

  useEffect(() => { if (verse) updateReadingProgress(bookSlug, chapter, verseNum, canto).catch(() => {}); }, [verse]);
  // Warm the English dictionary in the background so the first double-click
  // lookup is instant (the phone does this behind its "Meanings" button).
  useEffect(() => { const id = setTimeout(() => { preloadDictionary().catch(() => {}); }, 2500); return () => clearTimeout(id); }, []);

  // ─── Prev / next ───
  const verseBook = !!book && !isProseBook(book) && !fmTitle;
  const ids = useVerseIds(book, chapter, canto, verseBook);
  const nav = useMemo(() => {
    if (!book) return { prev: undefined, next: undefined } as { prev?: { href: Href; label: string }; next?: { href: Href; label: string } };
    const chs = flatChapters(book);
    if (fmTitle) {
      const fm = book.frontMatter ?? [];
      const i = fm.findIndex((f) => f.id === verseNum);
      const prev = i > 0 ? { href: verseHref(book.slug, 1, fm[i - 1].id), label: fm[i - 1].title } : undefined;
      const next = i < fm.length - 1 ? { href: verseHref(book.slug, 1, fm[i + 1].id), label: fm[i + 1].title }
        : chs[0] ? { href: chapterHref(book, chs[0]), label: chs[0].title } : undefined;
      return { prev, next };
    }
    if (isProseBook(book)) {
      const i = chs.findIndex((c) => (c.pageId ? c.pageId === verseNum : isChapterPageBook(book.slug) ? c.chapter === chapter && c.canto === canto : String(c.chapter) === verseNum));
      return {
        prev: i > 0 ? { href: chapterHref(book, chs[i - 1]), label: chs[i - 1].title } : undefined,
        next: i >= 0 && i < chs.length - 1 ? { href: chapterHref(book, chs[i + 1]), label: chs[i + 1].title } : undefined,
      };
    }
    const cur = verse?.verseRange || verseNum;
    const i = ids.findIndex((id) => id === cur || idContains(id, verseNum));
    // A combined verse ("8-12") that the id list doesn't have as such (the
    // list is still the plain 1…N fallback): its neighbours are the texts
    // just before its first and just after its last number.
    const range = /^(\d+)-(\d+)$/.exec(cur);
    const iPrev = i !== -1 ? i - 1 : range ? ids.findIndex((id) => idContains(id, String(+range[1] - 1))) : -1;
    const iNext = i !== -1 ? i + 1 : range ? ids.findIndex((id) => idContains(id, String(+range[2] + 1))) : parseInt(verseNum, 10);
    const ci = chs.findIndex((c) => c.chapter === chapter && c.canto === canto);
    let prev; let next;
    if (iPrev >= 0) prev = { href: verseHref(book.slug, chapter, ids[iPrev], canto), label: `Text ${ids[iPrev]}` };
    else if (ci === 0 && book.frontMatter?.length) {
      const fm = book.frontMatter[book.frontMatter.length - 1];
      prev = { href: verseHref(book.slug, 1, fm.id), label: fm.title };
    } else if (ci > 0) {
      const pc = chs[ci - 1];
      prev = { href: verseHref(book.slug, pc.chapter, String(pc.verseCount), pc.canto), label: `Chapter ${pc.chapter}, last text` };
    }
    if (iNext > 0 && iNext < ids.length) next = { href: verseHref(book.slug, chapter, ids[iNext], canto), label: `Text ${ids[iNext]}` };
    else if (ci >= 0 && ci < chs.length - 1) {
      const nc = chs[ci + 1];
      next = { href: verseHref(book.slug, nc.chapter, '1', nc.canto), label: `Chapter ${nc.chapter}${nc.canto ? ` (${nc.canto})` : ''}, text 1` };
    }
    return { prev, next };
  }, [book, ids, verseNum, chapter, canto, verse?.verseRange, fmTitle]);

  const go = (h?: { href: Href }) => { if (h) { closeFind(); router.replace(h.href); } };

  // ─── Find in page ───
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState('');
  const [active, setActive] = useState(0);
  const [count, setCount] = useState(0);
  const findInput = useRef<any>(null);
  const bar = useAutoHideBar(findOpen);
  useRevealAtTop(focus, bar.height);
  const closeFind = () => { setFindOpen(false); setFindQ(''); setActive(0); };
  useEffect(() => { setActive(0); }, [findQ]);
  // Another page (TOC, link, search result…): start the find count again.
  useEffect(() => { setActive(0); }, [params.book, params.canto, params.chapter, params.verse]);
  useEffect(() => {
    if (!findOpen || !findQ.trim() || !count) return;
    const el = document.querySelector(`[data-vb-match="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active, count, findOpen, findQ]);
  const step = (d: number) => count && setActive((a) => (a + d + count) % count);

  // ─── Keyboard ───
  const navRef = useRef(nav);
  navRef.current = nav;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const ui = useDesktopUi.getState();
      // A dialog (note, tags) has the keyboard: leave Ctrl+F to it.
      if (mod && e.key.toLowerCase() === 'f' && document.querySelector('[aria-modal="true"]')) return;
      if (mod && e.key.toLowerCase() === 'f' && ui.focusMode) { e.preventDefault(); ui.focusSearch(); return; }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => { findInput.current?.focus(); findInput.current?.select?.(); }, 0);
        return;
      }
      if (typingInField() || mod || e.altKey || e.shiftKey) return;
      if (document.querySelector('[data-vb-pop], [aria-modal="true"]')) return; // a popup has the keyboard
      if (e.key === 'ArrowLeft' && navRef.current.prev) { e.preventDefault(); go(navRef.current.prev); }
      else if (e.key === 'ArrowRight' && navRef.current.next) { e.preventDefault(); go(navRef.current.next); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── Word meanings, references, personalities ───
  const [lookup, setLookup] = useState<{ word: string; sanskrit: boolean } | null>(null);
  const onWordLookup = useCallback((word: string, sanskrit: boolean) => setLookup({ word, sanskrit }), []);
  const [preview, setPreview] = useState<VersePreviewTarget | null>(null);
  const [person, setPerson] = useState<PersonalityTarget | null>(null);
  const onCitationHover = useCallback((c: LinkedCitation, at: Anchor | null) => {
    if (at) hoverIntent.open(() => { setPerson(null); setPreview({ label: c.label, ref: c.ref, x: at.x, y: at.y }); }, 320);
    else { hoverIntent.cancelOpen(); hoverIntent.close(() => setPreview(null)); }
  }, []);
  const onPersonHover = useCallback((p: any, at: Anchor | null) => {
    if (at) hoverIntent.open(() => { setPreview(null); setPerson({ person: p, x: at.x, y: at.y }); }, 320);
    else { hoverIntent.cancelOpen(); hoverIntent.close(() => setPerson(null)); }
  }, []);
  const openRef = useCallback((r: LibraryRef) => { setPreview(null); setPerson(null); router.push(libHref(r)); }, [router]);

  // ─── Actions ───
  const handleSave = () => {
    if (!verse) return;
    if (!fav) addFavorite({ verseId, bookSlug: verse.bookSlug, canto: verse.canto, chapter, verse: verseNum });
    setShowTags(true);
  };

  const display: Display = {
    devanagari: settings.showDevanagari,
    transliteration: settings.showTransliteration,
    synonyms: settings.showSynonyms,
    translation: settings.showTranslation,
    purport: settings.showPurport,
  };

  if (!book) {
    return <Empty icon="📚" title="Book not found" action={<Btn label="Back to Library" kind="primary" onPress={() => router.replace('/library')} />} />;
  }

  const crumbs = [...bookCrumbs(book, canto, pageTitle ? undefined : chapter), { label: pageTitle ?? `Text ${displayNum}` }];

  return (
    <View style={s.row}>
      {tocOpen && !focus ? (
        <BookToc book={book} canto={canto} chapter={chapter} verse={verseNum} pageId={vsTitle ? verseNum : undefined} />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AutoHideBar bar={bar}>
        {focus ? (
          <FocusBar label={book ? shortRef(book, chapter, displayNum, canto) : ''} searchWidth={340}>
            <PresentControls />
          </FocusBar>
        ) : (
        <View style={[s.toolbar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          {!tocOpen ? <IconBtn icon="☰" tip="Show contents  [" onPress={toggleToc} size={32} /> : null}
          <View style={{ flex: 1, minWidth: 0 }}><Breadcrumbs items={crumbs} /></View>
          <Btn size="sm" kind={fav ? 'secondary' : 'ghost'} icon={fav ? '★' : '☆'} label={fav ? 'Saved' : 'Save'} onPress={handleSave} tip={fav ? 'Edit tags or remove from Saved' : 'Save this verse'} />
          <Btn size="sm" kind={myNote ? 'secondary' : 'ghost'} icon="✎" label={myNote ? 'Note ●' : 'Note'} onPress={() => setShowNote(true)} tip="Write a personal note" />
          <Btn size="sm" kind={findOpen ? 'secondary' : 'ghost'} icon="⌕" label="Find" onPress={() => { setFindOpen((o) => !o); setTimeout(() => findInput.current?.focus(), 0); }} tip="Find in this page (Ctrl+F)" />
          <FullScreenBtn />
        </View>
        )}

        {findOpen && !focus ? (
          <View style={[s.findBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[s.findIcon, { color: colors.textMuted }]}>⌕</Text>
            <TextInput
              ref={findInput}
              value={findQ}
              onChangeText={setFindQ}
              placeholder="Find on this page…"
              placeholderTextColor={colors.textMuted}
              autoFocus
              onKeyPress={(e: any) => {
                const k = e.nativeEvent.key;
                if (k === 'Enter') { e.preventDefault?.(); step(e.nativeEvent.shiftKey ? -1 : 1); }
                else if (k === 'Escape') closeFind();
              }}
              style={[s.findInput, { color: colors.text }, web({ outlineStyle: 'none' })]}
            />
            <Text style={[s.findCount, { color: colors.textMuted }]}>{findQ.trim() ? `${count ? active + 1 : 0} / ${count}` : ''}</Text>
            <IconBtn icon="‹" tip="Previous match (Shift+Enter)" onPress={() => step(-1)} disabled={!count} size={30} />
            <IconBtn icon="›" tip="Next match (Enter)" onPress={() => step(1)} disabled={!count} size={30} />
            <IconBtn icon="✕" tip="Close (Esc)" onPress={closeFind} size={30} />
          </View>
        ) : null}
        </AutoHideBar>

        {presenting && verse ? (
          <Presentation verse={verse} mode={presentMode as 'sloka' | 'translation'} label={heading} onTap={bar.onTap} />
        ) : (
        <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }} {...({ onClick: bar.onTap } as any)}>
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.scroll} onScroll={(e) => { onScroll(e); bar.onScrollY(e.nativeEvent.contentOffset.y); }} scrollEventThrottle={32}>
            <BarSpacer bar={bar} />
            <View style={s.column} dataSet={{ vbPage: '1' }}>
              {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={[s.muted, { color: colors.textMuted }]}>Loading…</Text></View>
              ) : error || !verse ? (
                <Empty icon="🌐" title="Couldn't load this page" body={`${error ?? 'Not found.'} Downloaded books open without internet — see Downloads.`} action={<Btn label="↺ Retry" kind="primary" onPress={refresh} />} />
              ) : (
                <>
                  <Text style={[s.title, { color: colors.text }]}>{heading}</Text>
                  {chMeta && !/chapter\s+\d+\s*$/i.test(chMeta.title) ? (
                    <Text style={[s.subtitle, { color: colors.textMuted }]}>{chMeta.title}</Text>
                  ) : null}
                  {myNote && !focus ? (
                    <Pressable onPress={() => setShowNote(true)} style={(st: PState) => [s.note, { backgroundColor: st.hovered ? t.hover : colors.surface, borderColor: colors.border, borderLeftColor: colors.primary }, web({ cursor: 'pointer' })]}>
                      <Text style={[s.noteLabel, { color: colors.primary }]}>MY NOTE</Text>
                      <Text style={[s.noteText, { color: colors.textSecondary }]} numberOfLines={4}>{myNote.content}</Text>
                    </Pressable>
                  ) : null}
                  <ReaderVerse
                    verse={verse}
                    display={display}
                    query={findOpen ? findQ : ''}
                    activeMatch={active}
                    onMatchCount={setCount}
                    onWordLookup={onWordLookup}
                    onCitationHover={onCitationHover}
                    onCitationOpen={(c) => openRef(c.ref)}
                    onPersonHover={onPersonHover}
                  />
                  {focus ? null : <Text style={[s.hint, { color: colors.textMuted }]}>
                    Click a Sanskrit word in the synonyms — or double-click any word — for its meaning. Hover a verse reference to preview it.
                  </Text>}
                  <View style={[s.bottomNav, { borderTopColor: colors.border }]}>
                    {nav.prev && !focus ? <Btn label={`‹  ${nav.prev.label}`} onPress={() => go(nav.prev)} /> : <View />}
                    {nav.next ? <Btn label={`${nav.next.label}  ›`} kind="primary" onPress={() => go(nav.next)} /> : <View />}
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
        )}
      </View>

      <WordMeaningSheet
        word={lookup?.word ?? null}
        sanskritFirst={lookup?.sanskrit}
        verse={verse}
        onClose={() => setLookup(null)}
        onOpenVerse={(r: VerseRef) => { setLookup(null); router.push(verseHref(r.bookSlug, r.chapter, r.verse, r.canto ?? undefined)); }}
      />
      <VersePreviewPopup target={preview} onClose={() => setPreview(null)} onOpenVerse={openRef} />
      <PersonalityPopup target={person} onClose={() => setPerson(null)} onOpenVerse={openRef} />
      <TagDialog open={showTags} verseId={verseId} title={heading} onClose={() => setShowTags(false)} onRemove={() => { setShowTags(false); removeFavorite(verseId); }} />
      <NoteDialog open={showNote} initial={myNote?.content ?? ''} title={heading} onClose={() => setShowNote(false)} onSave={(txt) => { if (verseId) updateNote(verseId, txt); }} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', minHeight: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  findBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 44, borderBottomWidth: StyleSheet.hairlineWidth },
  findIcon: { fontSize: 17 },
  findInput: { flex: 1, fontFamily: SANS, fontSize: 14, height: 34 },
  findCount: { fontFamily: SANS, fontSize: 12.5, fontWeight: '600', minWidth: 48, textAlign: 'right' },
  scroll: { paddingTop: 36, paddingBottom: 80, alignItems: 'center' },
  // Text uses the window's full width (the user found the book column too narrow).
  column: { width: '100%', maxWidth: READING_W_WIDE, paddingHorizontal: 48, gap: 22 },
  center: { alignItems: 'center', paddingVertical: 100, gap: 14 },
  muted: { fontFamily: SANS, fontSize: 14 },
  title: { fontFamily: SERIF, fontSize: 30, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
  subtitle: { fontFamily: SERIF, fontSize: 15, fontStyle: 'italic', textAlign: 'center', marginTop: -14 },
  note: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3, borderRadius: 8, padding: 14, gap: 4 },
  noteLabel: { fontFamily: SANS, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 },
  noteText: { fontFamily: SANS, fontSize: 14, lineHeight: 21 },
  hint: { fontFamily: SANS, fontSize: 12, textAlign: 'center', marginTop: 12 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, marginTop: 4 },
});
