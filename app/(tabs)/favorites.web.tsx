// Desktop Saved: tag filters in a sidebar, saved verses as cards with their
// tags and notes; hover a card to edit its tags or remove it.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import { useFavoritesStore } from '@/store/favoritesStore';
import { getBook } from '@/constants/books';
import { Favorite, Tag } from '@/types';
import { Btn, Empty, IconBtn, ConfirmDialog } from '@/desktop/ui';
import { TagDialog } from '@/desktop/VerseDialogs';
import { verseHref, shortRef } from '@/desktop/bookNav';
import { SANS, SERIF, tints, web, alpha } from '@/desktop/theme';

type PState = { pressed: boolean; hovered?: boolean };

function refOf(f: Favorite) {
  const book = getBook(f.bookSlug);
  return book ? shortRef(book, f.chapter, String(f.verse), f.canto) : `${f.bookSlug} ${f.chapter}.${f.verse}`;
}

function SavedCard({ fav, tags, note, onOpen, onTags, onRemove }: {
  fav: Favorite; tags: Tag[]; note?: string; onOpen: () => void; onTags: () => void; onRemove: () => void;
}) {
  const { colors } = useTheme();
  const book = getBook(fav.bookSlug);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="link"
      style={(st: PState) => [
        s.card,
        { backgroundColor: colors.card, borderColor: st.hovered ? alpha(colors.primary, 0.5) : colors.border },
        web({ cursor: 'pointer', transition: 'border-color 120ms, box-shadow 160ms', boxShadow: st.hovered ? '0 6px 20px rgba(0,0,0,0.10)' : 'none' }),
      ]}
    >
      {(st: PState) => (
        <>
          <View style={[s.stripe, { backgroundColor: book?.coverColor ?? colors.primary }]} />
          <View style={s.cardBody}>
            <View style={s.cardHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.ref, { color: colors.text }]} numberOfLines={1}>{refOf(fav)}</Text>
                <Text style={[s.book, { color: colors.textMuted }]} numberOfLines={1}>{book?.title} · saved {format(new Date(fav.addedAt), 'd MMM yyyy')}</Text>
              </View>
              <View style={[s.actions, { opacity: st.hovered ? 1 : 0 }]}>
                <IconBtn icon="🏷" tip="Edit tags" onPress={onTags} size={30} />
                <IconBtn icon="🗑" tip="Remove from Saved" onPress={onRemove} size={30} />
              </View>
            </View>
            {note ? <Text style={[s.note, { color: colors.textSecondary, borderLeftColor: colors.primary }]} numberOfLines={3}>{note}</Text> : null}
            {tags.length ? (
              <View style={s.tags}>
                {tags.map((t) => <Text key={t.id} style={[s.tag, { backgroundColor: t.color }]}>{t.name}</Text>)}
              </View>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = tints(colors);
  const { favorites, removeFavorite, tags, verseTags, notes } = useFavoritesStore();
  const [filter, setFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Favorite | null>(null);
  const [removing, setRemoving] = useState<Favorite | null>(null);

  const tagsOf = (f: Favorite) => tags.filter((tg) => (verseTags[f.verseId] ?? []).includes(tg.id));
  const countFor = (id: string) => favorites.filter((f) => (verseTags[f.verseId] ?? []).includes(id)).length;
  const used = tags.filter((tg) => countFor(tg.id) > 0);
  const active = filter && used.some((tg) => tg.id === filter) ? filter : null;
  const shown = active ? favorites.filter((f) => (verseTags[f.verseId] ?? []).includes(active)) : favorites;

  const filterRow = (id: string | null, label: string, count: number, color?: string) => {
    const on = active === id;
    return (
      <Pressable
        key={id ?? 'all'}
        onPress={() => setFilter(id)}
        style={(st: PState) => [s.fRow, { backgroundColor: on ? t.selected : st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}
      >
        <View style={[s.fDot, { backgroundColor: color ?? colors.primary }]} />
        <Text style={[s.fLabel, { color: on ? colors.primary : colors.text }]} numberOfLines={1}>{label}</Text>
        <Text style={[s.fCount, { color: colors.textMuted }]}>{count}</Text>
      </Pressable>
    );
  };

  return (
    <View style={s.row}>
      <View style={[s.side, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
        <Text style={[s.h1, { color: colors.text }]}>Saved</Text>
        <Text style={[s.sub, { color: colors.textMuted }]}>{favorites.length} verse{favorites.length === 1 ? '' : 's'}</Text>
        <Text style={[s.sideLabel, { color: colors.textMuted }]}>TAGS</Text>
        {filterRow(null, 'All saved', favorites.length)}
        {used.map((tg) => filterRow(tg.id, tg.name, countFor(tg.id), tg.color))}
        {used.length === 0 && favorites.length > 0 ? (
          <Text style={[s.sideHint, { color: colors.textMuted }]}>Hover a card and click 🏷 to tag it — tags group verses by topic.</Text>
        ) : null}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.main}>
        <View style={{ width: '100%', maxWidth: 1100 }} dataSet={{ vbPage: '1' }}>
          {favorites.length === 0 ? (
            <Empty icon="☆" title="Nothing saved yet" body="Click ☆ Save on any verse to keep it here. Add tags to group verses by topic, and notes for your own realisations." action={<Btn label="Open the Library" kind="primary" onPress={() => router.push('/library')} />} />
          ) : (
            <>
              <Text style={[s.mainTitle, { color: colors.text }]}>{active ? tags.find((x) => x.id === active)?.name : 'All saved verses'}</Text>
              <View style={s.grid}>
                {shown.map((f) => (
                  <SavedCard
                    key={f.id}
                    fav={f}
                    tags={tagsOf(f)}
                    note={notes[f.verseId]?.content ?? f.note}
                    onOpen={() => router.push(verseHref(f.bookSlug, f.chapter, String(f.verse), f.canto))}
                    onTags={() => setEditing(f)}
                    onRemove={() => setRemoving(f)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <TagDialog
        open={!!editing}
        verseId={editing?.verseId ?? ''}
        title={editing ? refOf(editing) : ''}
        onClose={() => setEditing(null)}
        onRemove={() => { if (editing) removeFavorite(editing.verseId); setEditing(null); }}
      />
      <ConfirmDialog
        open={!!removing}
        title="Remove from Saved?"
        message={removing ? `${refOf(removing)} will be removed from your saved verses. Its note stays on the verse.` : ''}
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (removing) removeFavorite(removing.verseId); }}
        onClose={() => setRemoving(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', minHeight: 0 },
  side: { width: 260, borderRightWidth: StyleSheet.hairlineWidth, padding: 16, gap: 2 },
  h1: { fontFamily: SERIF, fontSize: 24, fontWeight: '700' },
  sub: { fontFamily: SANS, fontSize: 13, marginBottom: 18 },
  sideLabel: { fontFamily: SANS, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6, marginLeft: 8 },
  sideHint: { fontFamily: SANS, fontSize: 12, lineHeight: 18, padding: 8 },
  fRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 7 },
  fDot: { width: 10, height: 10, borderRadius: 5 },
  fLabel: { flex: 1, fontFamily: SANS, fontSize: 13.5, fontWeight: '600' },
  fCount: { fontFamily: SANS, fontSize: 12 },
  main: { padding: 32, alignItems: 'center' },
  mainTitle: { fontFamily: SERIF, fontSize: 24, fontWeight: '700', marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { width: 340, flexGrow: 1, maxWidth: 520, flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  stripe: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ref: { fontFamily: SERIF, fontSize: 19, fontWeight: '700' },
  book: { fontFamily: SANS, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 2 },
  note: { fontFamily: SANS, fontSize: 13, lineHeight: 19, borderLeftWidth: 2, paddingLeft: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { color: '#FFF', fontFamily: SANS, fontSize: 11, fontWeight: '700', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
});
