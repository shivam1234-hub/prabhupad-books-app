import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Tag } from '@/types';

interface Props {
  tag: Tag;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: 'sm' | 'md';
}

export function TagChip({ tag, selected, onPress, onLongPress, size = 'md' }: Props) {
  const isSmall = size === 'sm';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        isSmall && styles.chipSmall,
        { backgroundColor: selected ? tag.color : `${tag.color}22`, borderColor: tag.color, opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={[styles.dot, { backgroundColor: tag.color }]} />
      <Text
        style={[
          styles.label,
          isSmall && styles.labelSmall,
          { color: selected ? '#FFF' : tag.color },
        ]}
      >
        {tag.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipSmall: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: 11,
  },
});
