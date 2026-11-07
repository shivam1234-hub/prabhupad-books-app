import React, { useRef } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChangeText, onClear, placeholder = 'Search verses, purports…', autoFocus }: Props) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.searchBackground, borderColor: colors.border }]}>
      <Text style={[styles.icon, { color: colors.textMuted }]}>🔍</Text>
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="never"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onClear?.();
            inputRef.current?.focus();
          }}
          style={styles.clearBtn}
          hitSlop={8}
        >
          <Text style={[styles.clearIcon, { color: colors.textMuted }]}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  clearBtn: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
});
