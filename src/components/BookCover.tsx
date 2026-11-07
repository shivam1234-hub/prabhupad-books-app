import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BookMeta } from '@/types';
import { BOOK_COVERS } from '@/constants/bookCovers';

interface Props {
  book: BookMeta;
  width: number;
  style?: StyleProp<ViewStyle>;
}

// Real covers are 320x508; keep that ratio everywhere so photos never crop.
const RATIO = 508 / 320;

const CATEGORY_ICON: Record<string, string> = {
  lecture: '🎙️',
  letter: '✉️',
  conversation: '💬',
};

// A book's cover photo, or — when we have none — a drawn cover in the book's
// colour with its title, so no book is left as a bare initial.
export function BookCover({ book, width, style }: Props) {
  const height = Math.round(width * RATIO);
  const src = BOOK_COVERS[book.slug];
  const box = [styles.box, { width, height }, style];

  if (src) {
    return (
      <View style={box}>
        <Image source={src} style={styles.img} resizeMode="cover" accessibilityLabel={book.title} />
      </View>
    );
  }

  const icon = CATEGORY_ICON[book.category];
  const small = width < 56;
  return (
    <View style={[box, { backgroundColor: book.coverColor }]}>
      <View style={styles.spine} />
      {icon ? (
        <Text style={{ fontSize: width * 0.42 }}>{icon}</Text>
      ) : (
        <Text
          style={[styles.title, { fontSize: small ? 7 : Math.max(8, width / 9) }]}
          numberOfLines={small ? 4 : 6}
        >
          {book.title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  img: { width: '100%', height: '100%' },
  spine: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  title: {
    color: '#FFF',
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 6,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
