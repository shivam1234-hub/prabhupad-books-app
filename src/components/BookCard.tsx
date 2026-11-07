import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { BookMeta } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { BookCover } from './BookCover';

interface Props {
  book: BookMeta;
  onPress: () => void;
  compact?: boolean;
  offline?: boolean;
}

// Lectures, letters and conversations are counted in their own units — a
// section of letters showing "6,757 verses" reads as a bug.
const UNIT: Record<string, string> = {
  lecture: 'lectures',
  letter: 'letters',
  conversation: 'conversations',
};
const unitFor = (category: string) => UNIT[category] ?? 'verses';

export function BookCard({ book, onPress, compact = false, offline = false }: Props) {
  const { colors } = useTheme();

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.compact,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={onPress}
      >
        <View style={[styles.compactSpine, { backgroundColor: book.coverColor }]} />
        <View style={styles.compactContent}>
          <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={2}>
            {book.title}
          </Text>
          {book.totalVerses && (
            <Text style={[styles.compactMeta, { color: colors.textMuted }]}>
              {book.totalVerses.toLocaleString()} {unitFor(book.category)}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={onPress}
    >
      <BookCover book={book} width={60} style={styles.cover} />

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.category, { color: colors.primary }]}>
          {book.category.toUpperCase()}
        </Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {book.title}
        </Text>
        {book.subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {book.subtitle}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {book.totalVerses ? (
            <View style={[styles.badge, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                {book.totalVerses.toLocaleString()} {unitFor(book.category)}
              </Text>
            </View>
          ) : null}
          {offline && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.badgeText, { color: '#FFF' }]}>✓ Offline</Text>
            </View>
          )}
        </View>
      </View>

      {/* Chevron */}
      <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 10,
  },
  cover: {
    marginVertical: 10,
    marginLeft: 10,
    elevation: 3,
  },
  info: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 3,
  },
  category: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 22,
    paddingRight: 14,
    fontWeight: '300',
  },
  compact: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 8,
  },
  compactSpine: { width: 4 },
  compactContent: { flex: 1, padding: 10 },
  compactTitle: { fontSize: 13, fontWeight: '600' },
  compactMeta: { fontSize: 11, marginTop: 2 },
});
