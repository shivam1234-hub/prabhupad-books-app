// Desktop book page: cover and details beside each other, the offline
// download control, and a clean table of contents — cantos on the left and
// their chapters on the right for multi-volume works.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { getBook } from '@/constants/books';
import { BookCover } from '@/components/BookCover';
import { useBookDownload, enqueueBook, hydrateDownloads } from '@/services/downloadManager';
import { useTrackedRoute } from '@/hooks/useTrackedRoute';
import { useHistoryStore } from '@/store/historyStore';
import { Page, Breadcrumbs, Btn, SectionHeader, Card } from '@/desktop/ui';
import { flatChapters, chapterHref, isProseBook, verseHref, FlatChapter } from '@/desktop/bookNav';
import { SANS, SERIF, tints, web, alpha } from '@/desktop/theme';

type PState = { pressed: boolean; hovered?: boolean };
const PAGE_SIZE = 200;

function ChapterRow({ ch, onPress, prose, fm }: { ch: FlatChapter; onPress: () => void; prose: boolean; fm?: boolean }) {
  const { colors } = useTheme();
  const t = tints(colors);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={(st: PState) => [s.chRow, { backgroundColor: st.hovered ? t.hover : 'transparent', borderBottomColor: colors.borderLight }, web({ cursor: 'pointer', transition: 'background-color 100ms' })]}
    >
      {(st: PState) => (
        <>
          <Text style={[s.chNum, { color: colors.textMuted }]}>{fm ? '§' : ch.pageId ? '' : ch.chapter}</Text>
          <Text style={[s.chTitle, { color: st.hovered ? colors.primary : colors.text }]} numberOfLines={2}>{ch.title}</Text>
          {!prose && !fm && !ch.pageId ? <Text style={[s.chCount, { color: colors.textMuted }]}>{ch.verseCount} texts</Text> : null}
          <Text style={[s.chev, { color: st.hovered ? colors.primary : colors.textMuted }]}>›</Text>
        </>
      )}
    </Pressable>
  );
}

export default function BookScreen() {
  const { slug, canto: cantoParam } = useLocalSearchParams<{ slug: string; canto?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const book = getBook(slug ?? '');
  const dl = useBookDownload(slug ?? '');
  const history = useHistoryStore((st) => st.entries);
  const [canto, setCanto] = useState<number>(cantoParam ? parseInt(cantoParam, 10) : book?.cantos?.[0]?.number ?? 1);
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  useFocusEffect(useCallback(() => { hydrateDownloads().catch(() => {}); }, []));
  const trackedEntry = useCallback(() => (book ? { kind: 'book' as const, title: book.title, subtitle: book.subtitle, bookSlug: book.slug } : null), [book?.slug]);
  const { onScroll } = useTrackedRoute({ pathname: '/book/[slug]', params: { slug: slug ?? '' }, entry: trackedEntry, visitDeps: [slug, book?.title] });

  const chapters = useMemo(() => (book ? flatChapters(book) : []), [book]);

  if (!book) {
    return <Page><Text style={{ color: colors.text }}>Book not found</Text></Page>;
  }

  const prose = isProseBook(book);
  const lastRead = history.find((h) => h.bookSlug === book.slug && h.kind !== 'book');
  const downloading = dl?.status === 'downloading' || dl?.status === 'queued';
  const pct = dl?.total ? dl.done / dl.total : 0;
  const q = filter.trim().toLowerCase();
  const shown = (book.hasCantos ? chapters.filter((c) => c.canto === canto) : chapters)
    .filter((c) => !q || c.title.toLowerCase().includes(q) || String(c.chapter) === q);
  const first = chapters[0];

  const dlLabel = dl?.status === 'queued' ? 'Queued — manage'
    : dl?.status === 'downloading' ? `Downloading ${Math.round(pct * 100)}% — manage`
      : dl?.status === 'downloaded' ? '↻ Re-download'
        : dl?.status === 'partial' ? `Resume download (${dl.done}/${dl.total})`
          : 'Download for offline';

  return (
    <Page maxWidth={1080} onScroll={onScroll} padTop={20}>
      <Breadcrumbs items={[{ label: 'Library', href: '/library' }, { label: book.title }]} />

      <View style={s.hero}>
        <View style={[s.cover, web({ boxShadow: '0 2px 6px rgba(0,0,0,0.16), 0 20px 40px rgba(0,0,0,0.22)' })]}>
          <BookCover book={book} width={190} />
        </View>
        <View style={s.info}>
          <Text style={[s.title, { color: colors.text }]}>{book.title}</Text>
          {book.subtitle ? <Text style={[s.subtitle, { color: colors.textSecondary }]}>{book.subtitle}</Text> : null}
          <Text style={[s.author, { color: colors.textMuted }]}>by {book.author}</Text>
          <Text style={[s.desc, { color: colors.textSecondary }]}>{book.description}</Text>
          <View style={s.meta}>
            {book.totalVerses ? <Text style={[s.metaPill, { color: colors.textSecondary, borderColor: colors.border }]}>📜 {book.totalVerses.toLocaleString()} {prose ? 'pages' : 'texts'}</Text> : null}
            {book.hasCantos && book.cantos ? <Text style={[s.metaPill, { color: colors.textSecondary, borderColor: colors.border }]}>{book.cantos.length} {book.slug === 'cc' ? 'līlās' : book.slug === 'sb' ? 'cantos' : 'parts'}</Text> : null}
            <Text style={[s.metaPill, { color: colors.textSecondary, borderColor: colors.border }]}>🌐 {book.languages.length} language{book.languages.length === 1 ? '' : 's'}</Text>
            {dl?.status === 'downloaded' ? <Text style={[s.metaPill, { color: '#FFF', backgroundColor: colors.success, borderColor: colors.success }]}>✓ Available offline · {dl.total} texts</Text> : null}
          </View>
          <View style={s.actions}>
            {lastRead ? (
              <Btn kind="primary" size="lg" label={`Continue: ${lastRead.title}`} onPress={() => router.push({ pathname: lastRead.pathname as any, params: lastRead.params })} style={{ maxWidth: 380 }} />
            ) : first ? (
              <Btn kind="primary" size="lg" label="Start reading" onPress={() => router.push(book.frontMatter?.length ? verseHref(book.slug, 1, book.frontMatter[0].id) : chapterHref(book, first))} />
            ) : null}
            <Btn
              size="lg"
              icon={dl?.status === 'downloaded' ? undefined : '⬇'}
              label={dlLabel}
              onPress={() => (downloading ? router.push('/downloads') : enqueueBook(book.slug))}
              tip="Keeps going in the background; Downloads shows every book's progress"
            />
          </View>
          {downloading || dl?.status === 'partial' ? (
            <View style={[s.bar, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[s.barFill, { width: `${Math.max(3, pct * 100)}%`, backgroundColor: colors.primary }, web({ transition: 'width 300ms' })]} />
            </View>
          ) : null}
        </View>
      </View>

      <SectionHeader
        title="Contents"
        right={chapters.length > 12 ? (
          <TextInput
            value={filter}
            onChangeText={(v) => { setFilter(v); setLimit(PAGE_SIZE); }}
            placeholder={prose ? 'Filter pages…' : 'Filter chapters…'}
            placeholderTextColor={colors.textMuted}
            style={[s.filter, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }, web({ outlineColor: colors.primary })]}
          />
        ) : undefined}
      />

      <View style={s.toc}>
        {book.hasCantos && book.cantos && book.cantos.length > 1 ? (
          <View style={s.cantoCol}>
            {book.cantos.map((c) => {
              const on = c.number === canto;
              return (
                <Pressable
                  key={c.number}
                  onPress={() => { setCanto(c.number); setLimit(PAGE_SIZE); }}
                  style={(st: PState) => [s.cantoRow, { backgroundColor: on ? alpha(colors.primary, 0.14) : st.hovered ? alpha(colors.primary, 0.07) : 'transparent', borderLeftColor: on ? colors.primary : 'transparent' }, web({ cursor: 'pointer' })]}
                >
                  <Text style={[s.cantoNum, { color: on ? colors.primary : colors.textMuted }]}>
                    {book.slug === 'sb' ? `CANTO ${c.number}` : book.slug === 'cc' ? `LĪLĀ ${c.number}` : `PART ${c.number}`}
                  </Text>
                  <Text style={[s.cantoTitle, { color: on ? colors.text : colors.textSecondary }]} numberOfLines={2}>{c.title}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Card style={s.chCard}>
          {book.frontMatter?.length && !q ? book.frontMatter.map((fm) => (
            <ChapterRow key={fm.id} fm prose={prose} ch={{ chapter: 0, title: fm.title, verseCount: 0 }} onPress={() => router.push(verseHref(book.slug, 1, fm.id))} />
          )) : null}
          {shown.slice(0, limit).map((ch) => (
            <ChapterRow key={`${ch.canto ?? 0}-${ch.chapter}`} ch={ch} prose={prose} onPress={() => router.push(chapterHref(book, ch))} />
          ))}
          {shown.length === 0 ? <Text style={[s.none, { color: colors.textMuted }]}>Nothing matches “{filter}”.</Text> : null}
          {shown.length > limit ? (
            <View style={{ padding: 12, alignItems: 'center' }}>
              <Btn label={`Show ${Math.min(PAGE_SIZE, shown.length - limit)} more of ${shown.length - limit}`} onPress={() => setLimit((l) => l + PAGE_SIZE)} />
            </View>
          ) : null}
        </Card>
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 40, marginTop: 22, alignItems: 'flex-start' },
  cover: { borderRadius: 4 },
  info: { flex: 1, minWidth: 0, gap: 8, paddingTop: 6 },
  title: { fontFamily: SERIF, fontSize: 36, fontWeight: '700', lineHeight: 44, letterSpacing: -0.3 },
  subtitle: { fontFamily: SERIF, fontSize: 18, fontStyle: 'italic' },
  author: { fontFamily: SANS, fontSize: 14 },
  desc: { fontFamily: SERIF, fontSize: 16, lineHeight: 26, marginTop: 6, maxWidth: 680 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  metaPill: { fontFamily: SANS, fontSize: 12.5, fontWeight: '600', borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden', maxWidth: 520, marginTop: 6 },
  barFill: { height: 5, borderRadius: 3 },
  filter: { width: 240, height: 32, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontFamily: SANS, fontSize: 13 },
  toc: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  cantoCol: { width: 250, gap: 2, ...web({ position: 'sticky', top: 0 }) },
  cantoRow: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderLeftWidth: 3 },
  cantoNum: { fontFamily: SANS, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  cantoTitle: { fontFamily: SERIF, fontSize: 14, marginTop: 2 },
  chCard: { flex: 1, overflow: 'hidden' },
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  chNum: { fontFamily: SANS, fontSize: 13, fontWeight: '700', width: 30, textAlign: 'right' },
  chTitle: { flex: 1, fontFamily: SERIF, fontSize: 16, lineHeight: 22 },
  chCount: { fontFamily: SANS, fontSize: 12.5 },
  chev: { fontSize: 18, width: 12 },
  none: { fontFamily: SANS, fontSize: 13, padding: 20, textAlign: 'center' },
});
