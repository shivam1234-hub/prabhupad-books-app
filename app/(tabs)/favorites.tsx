import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useFavoritesStore } from '@/store/favoritesStore';
import { BOOKS } from '@/constants/books';
import { TagSheet } from '@/components/TagSheet';
import { Favorite, Tag } from '@/types';

function favRef(fav: Favorite) {
  const book = BOOKS.find((b) => b.slug === fav.bookSlug);
  return fav.canto
    ? `${book?.title} ${fav.canto}.${fav.chapter}.${fav.verse}`
    : `${book?.title} ${fav.chapter}.${fav.verse}`;
}

function FavoriteRow({ fav, tags, onPress, onRemove, onEditTags }: {
  fav: Favorite;
  tags: Tag[];
  onPress: () => void;
  onRemove: () => void;
  onEditTags: () => void;
}) {
  const { colors } = useTheme();
  const book = BOOKS.find((b) => b.slug === fav.bookSlug);
  const ref = favRef(fav);

  return (
    <Pressable
      style={[styles.favRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      onLongPress={() => Alert.alert(ref, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit Tags', onPress: onEditTags },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ])}
    >
      <View style={[styles.favAccent, { backgroundColor: book?.coverColor ?? colors.primary }]} />
      <View style={styles.favContent}>
        <Text style={[styles.favRef, { color: colors.primary }]}>{ref}</Text>
        {fav.note ? <Text style={[styles.favNote, { color: colors.textSecondary }]} numberOfLines={2}>{fav.note}</Text> : null}
        {tags.length > 0 && (
          <View style={styles.rowTags}>
            {tags.map((t) => (
              <View key={t.id} style={[styles.rowTag, { backgroundColor: t.color }]}>
                <Text style={styles.rowTagText}>{t.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Pressable onPress={onEditTags} hitSlop={8} style={styles.tagBtn}>
        <Text style={[styles.tagBtnText, { color: colors.textMuted }]}>🏷</Text>
      </Pressable>
      <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
    </Pressable>
  );
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { favorites, removeFavorite, tags, verseTags } = useFavoritesStore();
  // Tag filter: null = show everything.
  const [filter, setFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Favorite | null>(null);

  const tagsOf = (fav: Favorite) => {
    const ids = verseTags[fav.verseId] ?? [];
    return tags.filter((t) => ids.includes(t.id));
  };
  const countFor = (tagId: string) =>
    favorites.filter((f) => (verseTags[f.verseId] ?? []).includes(tagId)).length;
  // Only offer tags that are on at least one saved verse.
  const usedTags = tags.filter((t) => countFor(t.id) > 0);
  // A filter whose last verse was untagged/removed falls back to "All".
  const activeFilter = filter && usedTags.some((t) => t.id === filter) ? filter : null;
  const shown = activeFilter
    ? favorites.filter((f) => (verseTags[f.verseId] ?? []).includes(activeFilter))
    : favorites;

  const navigate = (fav: Favorite) => {
    router.push({
      pathname: '/verse',
      params: {
        book: fav.bookSlug,
        chapter: String(fav.chapter),
        verse: String(fav.verse),
        canto: fav.canto !== undefined ? String(fav.canto) : '',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerText, { color: colors.primary }]}>
          ★ Favourites ({favorites.length})
        </Text>
      </View>

      {usedTags.length > 0 && (
        <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable
              onPress={() => setFilter(null)}
              style={[
                styles.filterChip,
                { borderColor: colors.primary, backgroundColor: activeFilter === null ? colors.primary : 'transparent' },
              ]}
            >
              <Text style={[styles.filterText, { color: activeFilter === null ? '#FFF' : colors.primary }]}>
                All {favorites.length}
              </Text>
            </Pressable>
            {usedTags.map((t) => {
              const on = activeFilter === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setFilter(on ? null : t.id)}
                  style={[styles.filterChip, { borderColor: t.color, backgroundColor: on ? t.color : 'transparent' }]}
                >
                  <Text style={[styles.filterText, { color: on ? '#FFF' : t.color }]}>
                    {t.name} {countFor(t.id)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyIcon, { color: colors.textMuted }]}>☆</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No favourites yet</Text>
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
            Tap Save on any verse to keep it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <FavoriteRow
              fav={item}
              tags={tagsOf(item)}
              onPress={() => navigate(item)}
              onRemove={() => removeFavorite(item.verseId)}
              onEditTags={() => setEditing(item)}
            />
          )}
        />
      )}

      <TagSheet
        visible={editing !== null}
        verseId={editing?.verseId ?? ''}
        title={editing ? favRef(editing) : ''}
        onClose={() => setEditing(null)}
        onRemove={() => { if (editing) removeFavorite(editing.verseId); setEditing(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerText: { fontSize: 16, fontWeight: '700' },
  list: { padding: 12, gap: 8, paddingBottom: 40 },
  favRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    borderWidth: 1, overflow: 'hidden',
  },
  favAccent: { width: 4, alignSelf: 'stretch' },
  favContent: { flex: 1, padding: 12, gap: 4 },
  favRef: { fontSize: 13, fontWeight: '700' },
  favNote: { fontSize: 12, lineHeight: 18 },
  arrow: { fontSize: 20, paddingRight: 12 },
  rowTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  rowTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  rowTagText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  tagBtn: { paddingHorizontal: 8, paddingVertical: 12 },
  tagBtnText: { fontSize: 16 },
  filterBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  filterText: { fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyHint: { fontSize: 14, textAlign: 'center' },
});
