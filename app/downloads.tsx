import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { BOOKS, BOOK_CATEGORIES } from '@/constants/books';
import { BookCover } from '@/components/BookCover';
import {
  useDownloadStore,
  hydrateDownloads,
  enqueueBook,
  enqueueBooks,
  enqueueAllBooks,
  cancelBook,
  cancelAllDownloads,
  type DownloadEntry,
} from '@/services/downloadManager';
import { BookMeta } from '@/types';

const SPEED_OPTIONS = [1, 2, 4, 8];

function pct(e?: DownloadEntry): number {
  if (!e || !e.total) return 0;
  return Math.min(1, e.done / e.total);
}

export default function DownloadsScreen() {
  const { colors } = useTheme();
  const entries = useDownloadStore((s) => s.entries);
  const queue = useDownloadStore((s) => s.queue);
  const activeSlug = useDownloadStore((s) => s.activeSlug);
  const concurrency = useSettingsStore((s) => s.settings.downloadConcurrency ?? 8);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  // Multi-select: pick several books, then download them in one go.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    hydrateDownloads().catch(() => {});
  }, []);

  const busy = queue.length > 0;
  const remaining = BOOKS.filter((b) => entries[b.slug]?.status !== 'downloaded');
  // Books that can still be picked: not offline yet and not already in the queue.
  const selectable = (slug: string) => entries[slug]?.status !== 'downloaded' && !queue.includes(slug);

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const addCategory = (cat: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of BOOKS) if (b.category === cat && selectable(b.slug)) next.add(b.slug);
      return next;
    });

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const downloadSelected = () => {
    // Keep the on-screen (category) order rather than tap order.
    const slugs = BOOKS.map((b) => b.slug).filter((s) => selected.has(s));
    exitSelect();
    enqueueBooks(slugs);
  };

  const onDownloadAll = () => {
    Alert.alert(
      'Download All Books',
      `Queue all ${remaining.length} remaining book(s) for offline use? This downloads thousands of verses and may take a long time. It keeps going in the background and resumes if you close the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download All', onPress: () => enqueueAllBooks() },
      ]
    );
  };

  const onCancelAll = () => {
    Alert.alert('Stop All Downloads', 'Stop the queue? Verses already saved stay offline.', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Stop All', style: 'destructive', onPress: () => cancelAllDownloads() },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Download Manager' }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, selecting && { paddingBottom: 110 }]}
        data={BOOKS}
        keyExtractor={(b) => b.slug}
        extraData={{ selecting, selected }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Pressable
                style={[styles.allBtn, { flex: 1, backgroundColor: busy ? colors.error : colors.primary }]}
                onPress={busy ? onCancelAll : onDownloadAll}
              >
                <Text style={styles.allBtnText}>
                  {busy ? `⏹ Stop All (${queue.length} in queue)` : '⬇ Download All'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.selectBtn, { borderColor: colors.primary, backgroundColor: selecting ? colors.primaryLight : 'transparent' }]}
                onPress={selecting ? exitSelect : () => setSelecting(true)}
              >
                <Text style={[styles.selectBtnText, { color: colors.primary }]}>
                  {selecting ? 'Cancel' : '☑ Select books'}
                </Text>
              </Pressable>
            </View>
            {selecting ? (
              <View style={styles.chipRow}>
                {BOOK_CATEGORIES.filter((c) => BOOKS.some((b) => b.category === c.id && selectable(b.slug))).map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => addCategory(c.id)}
                    style={[styles.catChip, { borderColor: colors.border, backgroundColor: colors.card }]}
                  >
                    <Text style={[styles.catChipText, { color: colors.textSecondary }]}>+ {c.label}</Text>
                  </Pressable>
                ))}
                {selected.size > 0 ? (
                  <Pressable onPress={() => setSelected(new Set())} style={[styles.catChip, { borderColor: colors.border }]}>
                    <Text style={[styles.catChipText, { color: colors.textMuted }]}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={[styles.speedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.speedLabel, { color: colors.text }]}>Parallel downloads</Text>
              <View style={styles.speedRow}>
                {SPEED_OPTIONS.map((n) => {
                  const on = concurrency === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => updateSetting('downloadConcurrency', n)}
                      style={[styles.speedChip, { borderColor: colors.primary, backgroundColor: on ? colors.primary : 'transparent' }]}
                    >
                      <Text style={[styles.speedChipText, { color: on ? '#FFF' : colors.primary }]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.speedHint, { color: colors.textMuted }]}>
                Pages fetched at the same time. Higher is faster; use 1–2 on a weak connection.
                Applies from the next book in the queue.
              </Text>
            </View>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Downloads keep going when you leave or close the app — a "Downloading…" notification shows progress and has a Stop button.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <BookRow
            book={item}
            entry={entries[item.slug]}
            active={activeSlug === item.slug}
            selecting={selecting}
            canSelect={selectable(item.slug)}
            checked={selected.has(item.slug)}
            onToggle={() => toggle(item.slug)}
          />
        )}
      />
      {selecting ? (
        <View style={[styles.selectBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable
            disabled={selected.size === 0}
            style={[styles.allBtn, { backgroundColor: colors.primary, opacity: selected.size === 0 ? 0.45 : 1 }]}
            onPress={downloadSelected}
          >
            <Text style={styles.allBtnText}>
              {selected.size === 0
                ? 'Tap books to select them'
                : `⬇ Download ${selected.size} book${selected.size === 1 ? '' : 's'}`}
            </Text>
          </Pressable>
        </View>
      ) : null}
      </View>
    </>
  );
}

interface BookRowProps {
  book: BookMeta;
  entry?: DownloadEntry;
  active: boolean;
  selecting: boolean;
  canSelect: boolean;
  checked: boolean;
  onToggle: () => void;
}

function BookRow({ book, entry, active, selecting, canSelect, checked, onToggle }: BookRowProps) {
  const { colors } = useTheme();
  const status = entry?.status ?? 'not_downloaded';
  const progress = pct(entry);

  let label: string;
  let action: (() => void) | null = null;
  let actionLabel = '';
  let actionColor = colors.primary;

  switch (status) {
    case 'downloaded':
      label = `✓ Offline · ${entry?.total ?? 0} verses`;
      actionLabel = '↻';
      action = () => enqueueBook(book.slug);
      break;
    case 'downloading':
      label = active
        ? `Downloading… ${Math.round(progress * 100)}% (${entry?.done}/${entry?.total})`
        : 'Paused · will resume';
      actionLabel = '⏹';
      actionColor = colors.error;
      action = () => cancelBook(book.slug);
      break;
    case 'queued':
      label = 'Queued';
      actionLabel = '⏹';
      actionColor = colors.error;
      action = () => cancelBook(book.slug);
      break;
    case 'partial':
      label = `⚠ Partial · ${entry?.done}/${entry?.total}`;
      actionLabel = 'Resume';
      action = () => enqueueBook(book.slug);
      break;
    default:
      label = `${book.totalVerses?.toLocaleString() ?? ''} verses`;
      actionLabel = 'Download';
      action = () => enqueueBook(book.slug);
  }

  const showBar = status === 'downloading' || status === 'queued' || status === 'partial';

  const content = (
    <>
      {selecting ? (
        <View
          style={[
            styles.check,
            { borderColor: canSelect ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent' },
          ]}
        >
          {checked ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      ) : null}
      <BookCover book={book} width={36} />
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {book.title}
        </Text>
        <Text style={[styles.status, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
        {showBar ? (
          <View style={[styles.barTrack, { backgroundColor: colors.searchBackground }]}>
            <View
              style={[
                styles.barFill,
                { backgroundColor: colors.primary, width: `${Math.max(4, progress * 100)}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
      {!selecting ? (
        <Pressable
          style={[styles.action, { borderColor: actionColor }]}
          onPress={action}
          hitSlop={8}
        >
          <Text style={[styles.actionText, { color: actionColor }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </>
  );

  const rowStyle = [styles.row, { backgroundColor: colors.card, borderColor: checked ? colors.primary : colors.border }];
  if (!selecting) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [rowStyle, { opacity: !canSelect ? 0.45 : pressed ? 0.8 : 1 }]}
      onPress={canSelect ? onToggle : undefined}
      disabled={!canSelect}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !canSelect }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  header: { gap: 10, marginBottom: 6 },
  allBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  allBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  topRow: { flexDirection: 'row', gap: 10 },
  selectBtn: { paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  selectBtnText: { fontSize: 14, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: '700' },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  selectBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 26, borderTopWidth: 1 },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
  speedCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  speedLabel: { fontSize: 14, fontWeight: '700' },
  speedRow: { flexDirection: 'row', gap: 8 },
  speedChip: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  speedChipText: { fontSize: 15, fontWeight: '800' },
  speedHint: { fontSize: 12, lineHeight: 17 },
  row: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1,
    padding: 10, gap: 12,
  },
  info: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '700' },
  status: { fontSize: 12 },
  barTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  barFill: { height: 5, borderRadius: 3 },
  action: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1.5,
    minWidth: 44, alignItems: 'center',
  },
  actionText: { fontSize: 12, fontWeight: '700' },
});
