import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  checked: boolean;
  /** Some (not all) verses of a prayer are ticked. */
  partial?: boolean;
  onPress: () => void;
  size?: number;
  label?: string;
}

/** The "memorized" tick box used on the Ślokas tab and the śloka screen. */
export function MemorizedCheck({ checked, partial, onPress, size = 26, label = 'Memorized' }: Props) {
  const { colors } = useTheme();
  const on = checked || partial;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: partial && !checked ? 'mixed' : checked }}
      accessibilityLabel={label}
      style={[
        styles.box,
        {
          width: size, height: size, borderRadius: size * 0.28,
          borderColor: on ? colors.primary : colors.textMuted,
          backgroundColor: checked ? colors.primary : 'transparent',
        },
      ]}
    >
      {checked && <Text style={[styles.tick, { fontSize: size * 0.62 }]}>✓</Text>}
      {partial && !checked && <Text style={[styles.dash, { color: colors.primary, fontSize: size * 0.6 }]}>–</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#FFF', fontWeight: '900', lineHeight: undefined },
  dash: { fontWeight: '900' },
});
