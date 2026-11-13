// Desktop Download Manager: the offline library at a glance (books offline,
// size on disk, folder), the queue controls, parallelism, and every book as a
// row with its status — or pick several and download them together.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { BOOKS, BOOK_CATEGORIES } from '@/constants/books';
import { BookCover } from '@/components/BookCover';
import {
  useDownloadStore, hydrateDownloads, enqueueBook, enqueueBooks, enqueueAllBooks, cancelBook, cancelAllDownloads, redownloadBook, DownloadEntry,
} from '@/services/downloadManager';
import { BookMeta } from '@/types';
import { Page, PageTitle, Btn, Chip, Segmented, SectionHeader, Card, ConfirmDialog } from '@/desktop/ui';
import { SANS, SERIF, tints, web } from '@/desktop/theme';

type PState = { pressed: boolean; hovered?: boolean };

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function Row({ book, entry, active, selecting, canSelect, checked, onToggle }: {
  book: BookMeta; entry?: DownloadEntry; active: boolean; selecting: boolean; canSelect: boolean; checked: boolean; onToggle: () => void;
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  const status = entry?.status ?? 'not_downloaded';
  const pct = entry?.total ? Math.min(1, entry.done / entry.total) : 0;
  let label: string; let btn: { label: string; kind: 'primary' | 'secondary' | 'dangerGhost'; on: () => void };
  switch (status) {
    case 'downloaded': label = `✓ Offline · ${(entry?.total ?? 0).toLocaleString()} texts`; btn = { label: '↻ Re-download', kind: 'secondary', on: () => { redownloadBook(book.slug); } }; break;
    case 'downloading': label = active ? `Downloading… ${Math.round(pct * 100)}%  (${entry?.done}/${entry?.total})` : 'Paused · will resume'; btn = { label: 'Stop', kind: 'dangerGhost', on: () => cancelBook(book.slug) }; break;
    case 'queued': label = 'Queued'; btn = { label: 'Stop', kind: 'dangerGhost', on: () => cancelBook(book.slug) }; break;
    case 'partial': label = `⚠ Partial · ${entry?.done}/${entry?.total}`; btn = { label: 'Resume', kind: 'primary', on: () => enqueueBook(book.slug) }; break;
    default: label = book.totalVerses ? `${book.totalVerses.toLocaleString()} texts` : 'Not downloaded'; btn = { label: '⬇ Download', kind: 'secondary', on: () => enqueueBook(book.slug) };
  }
  const bar = status === 'downloading' || status === 'queued' || status === 'partial';
  return (
    <Pressable
      onPress={selecting && canSelect ? onToggle : undefined}
      disabled={selecting && !canSelect}
      style={(st: PState) => [
        s.row,
        { borderBottomColor: colors.borderLight, backgroundColor: checked ? t.selected : st.hovered ? t.hover : 'transparent', opacity: selecting && !canSelect ? 0.45 : 1 },
        web({ cursor: selecting && canSelect ? 'pointer' : 'default' }),
      ]}
    >
      {selecting ? (
        <View style={[s.check, { borderColor: canSelect ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent' }]}>
          {checked ? <Text style={s.checkMark}>✓</Text> : null}
        </View>
      ) : null}
      <BookCover book={book} width={30} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{book.title}</Text>
        <Text style={[s.status, { color: status === 'downloaded' ? colors.success : colors.textMuted }]} numberOfLines={1}>{label}</Text>
      </View>
      {bar ? (
        <View style={[s.track, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[s.fill, { backgroundColor: colors.primary, width: `${Math.max(3, pct * 100)}%` }, web({ transition: 'width 300ms' })]} />
        </View>
      ) : null}
      {!selecting ? <Btn size="sm" label={btn.label} kind={btn.kind} onPress={btn.on} style={{ minWidth: 110 }} /> : null}
    </Pressable>
  );
}

export default function DownloadsScreen() {
  const { colors } = useTheme();
  const entries = useDownloadStore((st) => st.entries);
  const queue = useDownloadStore((st) => st.queue);
  const activeSlug = useDownloadStore((st) => st.activeSlug);
  const concurrency = useSettingsStore((st) => st.settings.downloadConcurrency ?? 8);
  const update = useSettingsStore((st) => st.updateSetting);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | 'all' | 'stop'>(null);
  const [info, setInfo] = useState<{ path: string; bytes: number; verses: number; books: number } | null>(null);
  const bridge = typeof window !== 'undefined' ? window.vedabaseDesktop : undefined;

  useEffect(() => { hydrateDownloads().catch(() => {}); }, []);
  const refreshInfo = useCallback(() => { bridge?.storageInfo().then(setInfo).catch(() => {}); }, [bridge]);
  useFocusEffect(refreshInfo);
  const doneCount = BOOKS.filter((b) => entries[b.slug]?.status === 'downloaded').length;
  useEffect(() => { refreshInfo(); }, [doneCount]);

  const busy = queue.length > 0;
  const remaining = BOOKS.filter((b) => entries[b.slug]?.status !== 'downloaded');
  const selectable = (slug: string) => entries[slug]?.status !== 'downloaded' && !queue.includes(slug);
  const toggle = (slug: string) => setSelected((p) => { const n = new Set(p); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });
  const addCat = (cat: string) => setSelected((p) => { const n = new Set(p); for (const b of BOOKS) if (b.category === cat && selectable(b.slug)) n.add(b.slug); return n; });
  const exit = () => { setSelecting(false); setSelected(new Set()); };
  const downloadSelected = () => { const slugs = BOOKS.map((b) => b.slug).filter((x) => selected.has(x)); exit(); enqueueBooks(slugs); };

  return (
    <View style={{ flex: 1 }}>
      <Page maxWidth={1000} contentContainerStyle={selecting ? { paddingBottom: 120 } : undefined}>
        <PageTitle
          eyebrow="Offline library"
          title="Download Manager"
          subtitle="Save books to this computer to read and search them with no internet. Downloads keep going while you read, and resume after the app is closed."
          right={
            <>
              <Btn label={selecting ? 'Cancel selection' : '☑ Select books'} onPress={selecting ? exit : () => setSelecting(true)} />
              {busy
                ? <Btn kind="danger" label={`⏹ Stop all (${queue.length})`} onPress={() => setConfirm('stop')} />
                : <Btn kind="primary" label="⬇ Download all" onPress={() => setConfirm('all')} disabled={remaining.length === 0} />}
            </>
          }
        />

        <View style={s.stats}>
          <Card style={s.stat}>
            <Text style={[s.statNum, { color: colors.text }]}>{doneCount}<Text style={[s.statOf, { color: colors.textMuted }]}> / {BOOKS.length}</Text></Text>
            <Text style={[s.statLabel, { color: colors.textMuted }]}>books available offline</Text>
          </Card>
          <Card style={s.stat}>
            <Text style={[s.statNum, { color: colors.text }]}>{info ? fmtBytes(info.bytes) : '—'}</Text>
            <Text style={[s.statLabel, { color: colors.textMuted }]}>{info ? `${info.verses.toLocaleString()} texts on disk` : 'on disk'}</Text>
            {bridge ? (
              <Pressable onPress={() => bridge.revealStorage()} style={web({ cursor: 'pointer' })}>
                {(st: PState) => <Text style={[s.link, { color: colors.primary }, st.hovered && { textDecorationLine: 'underline' }]}>Open library folder</Text>}
              </Pressable>
            ) : null}
          </Card>
          <Card style={[s.stat, { flex: 1.4 }]}>
            <Text style={[s.statTitle, { color: colors.text }]}>Parallel downloads</Text>
            <Segmented<string> value={String(concurrency)} onChange={(v) => update('downloadConcurrency', Number(v))} options={['1', '2', '4', '8'].map((n) => ({ key: n, label: n }))} />
            <Text style={[s.statLabel, { color: colors.textMuted }]}>Higher is faster; use 1–2 on a weak connection. Applies from the next book.</Text>
          </Card>
        </View>

        {selecting ? (
          <View style={s.catRow}>
            <Text style={[s.catHint, { color: colors.textMuted }]}>Click books to select them, or add a whole category:</Text>
            {BOOK_CATEGORIES.filter((c) => BOOKS.some((b) => b.category === c.id && selectable(b.slug))).map((c) => (
              <Chip key={c.id} small label={`+ ${c.label}`} onPress={() => addCat(c.id)} />
            ))}
            {selected.size ? <Chip small label="Clear" onPress={() => setSelected(new Set())} /> : null}
          </View>
        ) : null}

        {BOOK_CATEGORIES.map((c) => {
          const books = BOOKS.filter((b) => b.category === c.id);
          if (!books.length) return null;
          const off = books.filter((b) => entries[b.slug]?.status === 'downloaded').length;
          return (
            <View key={c.id}>
              <SectionHeader title={c.label} right={<Text style={[s.catCount, { color: colors.textMuted }]}>{off} / {books.length} offline</Text>} />
              <Card style={{ overflow: 'hidden' }}>
                {books.map((b) => (
                  <Row key={b.slug} book={b} entry={entries[b.slug]} active={activeSlug === b.slug} selecting={selecting} canSelect={selectable(b.slug)} checked={selected.has(b.slug)} onToggle={() => toggle(b.slug)} />
                ))}
              </Card>
            </View>
          );
        })}
      </Page>

      {selecting ? (
        <View style={[s.selectBar, { backgroundColor: colors.surface, borderTopColor: colors.border }, web({ boxShadow: '0 -6px 20px rgba(0,0,0,0.08)' })]}>
          <Text style={[s.selCount, { color: colors.text }]}>{selected.size} book{selected.size === 1 ? '' : 's'} selected</Text>
          <Btn label="Cancel" onPress={exit} />
          <Btn kind="primary" size="lg" label={`⬇ Download ${selected.size || ''} book${selected.size === 1 ? '' : 's'}`} disabled={!selected.size} onPress={downloadSelected} />
        </View>
      ) : null}

      <ConfirmDialog
        open={confirm === 'all'}
        title="Download all books?"
        message={`Queue all ${remaining.length} remaining book(s) for offline use? This downloads thousands of texts and may take a long time. It keeps going in the background and resumes if you close the app.`}
        confirmLabel="Download all"
        onConfirm={() => enqueueAllBooks()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'stop'}
        title="Stop all downloads?"
        message="Texts already saved stay offline."
        confirmLabel="Stop all"
        destructive
        onConfirm={() => cancelAllDownloads()}
        onClose={() => setConfirm(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 14, marginBottom: 6 },
  stat: { flex: 1, padding: 16, gap: 6 },
  statNum: { fontFamily: SERIF, fontSize: 28, fontWeight: '700' },
  statOf: { fontSize: 18, fontWeight: '400' },
  statTitle: { fontFamily: SANS, fontSize: 14, fontWeight: '700' },
  statLabel: { fontFamily: SANS, fontSize: 12.5, lineHeight: 18 },
  link: { fontFamily: SANS, fontSize: 13, fontWeight: '600', marginTop: 2 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 18 },
  catHint: { fontFamily: SANS, fontSize: 13, marginRight: 4 },
  catCount: { fontFamily: SANS, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  title: { fontFamily: SANS, fontSize: 14, fontWeight: '600' },
  status: { fontFamily: SANS, fontSize: 12.5 },
  track: { width: 180, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  selectBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 32, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  selCount: { fontFamily: SANS, fontSize: 14, fontWeight: '600', flex: 1 },
});
