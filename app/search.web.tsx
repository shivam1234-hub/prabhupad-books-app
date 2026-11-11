// Desktop full search-results page. Same engine and ranking as the phone's
// floating search (searchVerses → rankVerses → groupSearchResults), laid out
// as a results page with a book filter, section tabs and highlighted matches.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { searchVerses, getDownloadedBookSlugs } from '@/database/queries';
import { parseVerseRef, findMatchingBooks } from '@/utils/parseVerseRef';
import { queryTerms } from '@/utils/searchMatch';
import { groupSearchResults, HitField, SearchHit } from '@/utils/searchSections';
import { isPartialResult } from '@/utils/searchRelevance';
import { HighlightedText } from '@/components/HighlightedText';
import { BOOKS, getBook } from '@/constants/books';
import { Verse } from '@/types';
import { Page, Btn, Chip, Popover, Empty, Card, HoverRow } from '@/desktop/ui';
import { verseHref, shortRef } from '@/desktop/bookNav';
import { SANS, SERIF, tints, web, alpha } from '@/desktop/theme';

type PState = { pressed: boolean; hovered?: boolean };
const SOURCE_LABEL: Record<string, string> = {
  transliteration: 'Verse text', devanagari: 'Devanāgarī', synonyms: 'Synonyms', translation: 'Translation', purport: 'Purport',
};
const PAGE = 40;

function Hit({ hit, onPress }: { hit: SearchHit; onPress: () => void }) {
  const { colors } = useTheme();
  const v = hit.verse;
  const book = getBook(v.bookSlug);
  const ref = book ? shortRef(book, v.chapter, String(v.verseRange || v.verse), v.canto) : `${v.bookSlug} ${v.chapter}.${v.verse}`;
  const shloka = hit.source === 'transliteration' || hit.source === 'devanagari';
  return (
    <HoverRow onPress={onPress} style={[s.hit, { borderBottomColor: colors.borderLight }]}>
      {(hovered) => (
        <>
          <View style={[s.spine, { backgroundColor: book?.coverColor ?? colors.primary }]} />
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <View style={s.hitHead}>
              <Text style={[s.hitRef, { color: colors.primary }, hovered && { textDecorationLine: 'underline' }]}>{ref}</Text>
              <Text style={[s.hitBook, { color: colors.textMuted }]} numberOfLines={1}>{book?.title}</Text>
              <Text style={[s.hitSource, { color: colors.textMuted, borderColor: colors.border }]}>{SOURCE_LABEL[hit.source] ?? hit.source}</Text>
            </View>
            <HighlightedText
              runs={hit.runs}
              numberOfLines={shloka ? 4 : 3}
              style={[s.snippet, { color: colors.textSecondary }, shloka && { fontStyle: 'italic' }]}
              highlightStyle={{ color: colors.text, backgroundColor: alpha(colors.primary, 0.2), fontWeight: '700', fontStyle: 'normal' }}
            />
          </View>
        </>
      )}
    </HoverRow>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; book?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = tints(colors);
  const [q, setQ] = useState(params.q ?? '');
  const [bookFilter, setBookFilter] = useState<string | undefined>(params.book || undefined);
  const [results, setResults] = useState<Verse[]>([]);
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<HitField | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);
  const [offline, setOffline] = useState<string[]>([]);
  const [bookMenu, setBookMenu] = useState(false);
  const bookBtn = useRef<any>(null);
  const runId = useRef(0);
  const input = useRef<any>(null);

  useFocusEffect(useCallback(() => { getDownloadedBookSlugs().then(setOffline).catch(() => {}); }, []));
  useEffect(() => { if (params.q !== undefined && params.q !== q) setQ(params.q); }, [params.q]);
  useEffect(() => { setTimeout(() => input.current?.focus(), 50); }, []);

  useEffect(() => {
    const text = q.trim();
    const id = ++runId.current;
    if (text.length < 2) { setResults([]); setSearched(''); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchVerses(text, bookFilter, 300);
        if (id !== runId.current) return;
        setResults(found); setSearched(text); setSection('all'); setLimit(PAGE);
      } catch { if (id === runId.current) setResults([]); }
      finally { if (id === runId.current) setLoading(false); }
    }, 280);
    return () => clearTimeout(timer);
  }, [q, bookFilter]);

  // Keep the URL in step so Back returns to the same results.
  useEffect(() => {
    const h = setTimeout(() => router.setParams({ q: q.trim() || undefined, book: bookFilter }), 500);
    return () => clearTimeout(h);
  }, [q, bookFilter]);

  const terms = useMemo(() => queryTerms(searched), [searched]);
  const sections = useMemo(() => groupSearchResults(results, terms), [results, terms]);
  const partial = useMemo(() => isPartialResult(results, terms), [results, terms]);
  const ref = q.trim() ? parseVerseRef(q.trim()) : null;
  const books = q.trim().length >= 2 ? findMatchingBooks(q.trim()).slice(0, 4) : [];
  const hits = section === 'all' ? sections.flatMap((x) => x.hits) : sections.find((x) => x.key === section)?.hits ?? [];
  const offlineBooks = BOOKS.filter((b) => offline.includes(b.slug));
  const filterBook = bookFilter ? getBook(bookFilter) : undefined;

  const open = (v: Verse) => router.push(verseHref(v.bookSlug, v.chapter, String(v.verse), v.canto));

  return (
    <Page maxWidth={980} padTop={32}>
      <Text style={[s.h1, { color: colors.text }]}>Search</Text>
      <View style={s.searchRow}>
        <View style={[s.bigSearch, { backgroundColor: colors.surface, borderColor: colors.border }, web({ boxShadow: t.shadow })]}>
          <Text style={[s.bigIcon, { color: colors.textMuted }]}>⌕</Text>
          <TextInput
            ref={input}
            value={q}
            onChangeText={setQ}
            placeholder='Words, a phrase, or a reference like “bg 2.13”'
            placeholderTextColor={colors.textMuted}
            style={[s.bigInput, { color: colors.text }, web({ outlineStyle: 'none' })]}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
        <View ref={bookBtn}>
          <Btn size="lg" label={`${filterBook ? filterBook.title : 'All downloaded books'}  ▾`} onPress={() => setBookMenu((o) => !o)} style={{ maxWidth: 300 }} />
        </View>
      </View>
      <Text style={[s.help, { color: colors.textMuted }]}>
        No diacritics needed (“krsna” finds kṛṣṇa) · small typos forgiven · exact phrases first. Full-text search covers the books you have downloaded.
      </Text>

      <Popover anchor={bookBtn.current} open={bookMenu} onClose={() => setBookMenu(false)} width={320}>
        <Pressable onPress={() => { setBookFilter(undefined); setBookMenu(false); }} style={(st: PState) => [s.menuRow, { backgroundColor: !bookFilter ? t.selected : st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}>
          <Text style={[s.menuText, { color: colors.text }]}>All downloaded books</Text>
        </Pressable>
        {offlineBooks.map((b) => (
          <Pressable key={b.slug} onPress={() => { setBookFilter(b.slug); setBookMenu(false); }} style={(st: PState) => [s.menuRow, { backgroundColor: bookFilter === b.slug ? t.selected : st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}>
            <View style={[s.dot, { backgroundColor: b.coverColor }]} />
            <Text style={[s.menuText, { color: colors.text }]} numberOfLines={1}>{b.title}</Text>
          </Pressable>
        ))}
        {offlineBooks.length === 0 ? <Text style={[s.menuNote, { color: colors.textMuted }]}>No books downloaded yet.</Text> : null}
      </Popover>

      {ref || books.length ? (
        <View style={s.jumps}>
          {ref ? [ref, ...(ref.alternates ?? [])].map((r, i) => (
            <HoverRow key={`r${i}`} onPress={() => router.push(verseHref(r.bookSlug, r.chapter, r.verse, r.canto))} style={(h) => [s.jump, { borderColor: i === 0 ? colors.primary : colors.border, backgroundColor: i === 0 ? alpha(colors.primary, h ? 0.16 : 0.1) : colors.surface }]}>
              <Text style={[s.jumpEyebrow, { color: colors.primary }]}>{i === 0 ? 'GO TO VERSE' : 'OR'}</Text>
              <Text style={[s.jumpTitle, { color: colors.text }]}>{r.label}</Text>
            </HoverRow>
          )) : null}
          {books.map((b) => (
            <HoverRow key={b.slug} onPress={() => router.push({ pathname: '/book/[slug]', params: { slug: b.slug } })} style={[s.jump, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[s.jumpEyebrow, { color: colors.textMuted }]}>BOOK</Text>
              <Text style={[s.jumpTitle, { color: colors.text }]} numberOfLines={1}>{b.title}</Text>
            </HoverRow>
          ))}
        </View>
      ) : null}

      {searched && sections.length ? (
        <View style={s.tabs}>
          <Chip label="All results" count={sections.reduce((n, x) => n + x.hits.length, 0)} on={section === 'all'} onPress={() => { setSection('all'); setLimit(PAGE); }} />
          {sections.map((x) => (
            <Chip key={x.key} label={x.title} count={x.hits.length} on={section === x.key} onPress={() => { setSection(x.key); setLimit(PAGE); }} />
          ))}
        </View>
      ) : null}

      {partial ? <Text style={[s.notice, { color: colors.textMuted }]}>No downloaded text has all of “{searched}” — closest matches:</Text> : null}

      {hits.length ? (
        <Card style={{ overflow: 'hidden', marginTop: 8 }}>
          {hits.slice(0, limit).map((h, i) => <Hit key={`${h.verse.id}-${h.field}-${i}`} hit={h} onPress={() => open(h.verse)} />)}
          {hits.length > limit ? (
            <View style={{ padding: 14, alignItems: 'center' }}>
              <Btn label={`Show more (${hits.length - limit} left)`} onPress={() => setLimit((l) => l + PAGE)} />
            </View>
          ) : null}
        </Card>
      ) : searched && !loading ? (
        <Empty
          icon="🔍"
          title={`No results for “${searched}”`}
          body={offline.length ? 'Try fewer words, or a different spelling.' : 'Search looks inside downloaded books. Download a book to search its full text offline.'}
          action={offline.length ? undefined : <Btn label="Open Downloads" kind="primary" onPress={() => router.push('/downloads')} />}
        />
      ) : !searched && !loading ? (
        <View style={s.examples}>
          <Text style={[s.exTitle, { color: colors.textMuted }]}>TRY</Text>
          <View style={s.tabs}>
            {['bg 2.13', 'sb 1.2.6', 'cc adi 1.1', 'so-called scholars', 'soka bhaya', 'krsna'].map((ex) => (
              <Chip key={ex} label={ex} onPress={() => setQ(ex)} />
            ))}
          </View>
        </View>
      ) : null}
    </Page>
  );
}

const s = StyleSheet.create({
  h1: { fontFamily: SERIF, fontSize: 32, fontWeight: '700', marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  bigSearch: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, gap: 10 },
  bigIcon: { fontSize: 22, marginTop: -3 },
  bigInput: { flex: 1, fontFamily: SANS, fontSize: 17, height: 46 },
  help: { fontFamily: SANS, fontSize: 12.5, marginTop: 10 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7 },
  menuText: { fontFamily: SANS, fontSize: 13.5, flex: 1 },
  menuNote: { fontFamily: SANS, fontSize: 12.5, padding: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  jumps: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  jump: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minWidth: 200, maxWidth: 320 },
  jumpEyebrow: { fontFamily: SANS, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  jumpTitle: { fontFamily: SERIF, fontSize: 17, fontWeight: '600', marginTop: 2 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 },
  notice: { fontFamily: SANS, fontSize: 13, fontStyle: 'italic', marginTop: 14 },
  hit: { flexDirection: 'row', gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  spine: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  hitHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hitRef: { fontFamily: SERIF, fontSize: 16, fontWeight: '700' },
  hitBook: { fontFamily: SANS, fontSize: 12.5, flexShrink: 1 },
  hitSource: { fontFamily: SANS, fontSize: 10.5, fontWeight: '700', borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden', letterSpacing: 0.5 },
  snippet: { fontFamily: SERIF, fontSize: 15, lineHeight: 23 },
  examples: { marginTop: 40, alignItems: 'center' },
  exTitle: { fontFamily: SANS, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
});
