import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import {
  useSettingsStore, clampFontScale, FONT_SCALE_STEP, FONT_SCALE_MIN, FONT_SCALE_MAX,
} from '@/store/settingsStore';

// A− / percentage / A+ stepper that adjusts the global reading-text scale.
// Lives inside the library reading screens; the change is persisted app-wide
// and proportionally resizes all scripture text (see VerseContent).
export function FontSizeControl({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const scale = useSettingsStore((s) => s.settings.fontScale);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const setScale = (next: number) => updateSetting('fontScale', clampFontScale(next));

  const atMin = scale <= FONT_SCALE_MIN + 1e-6;
  const atMax = scale >= FONT_SCALE_MAX - 1e-6;

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.searchBackground }]}>
      {!compact && (
        <Text style={[styles.caption, { color: colors.textMuted }]}>TEXT SIZE</Text>
      )}
      <Pressable
        onPress={() => setScale(scale - FONT_SCALE_STEP)}
        disabled={atMin}
        hitSlop={6}
        style={[styles.btn, { backgroundColor: colors.card, opacity: atMin ? 0.4 : 1 }]}
      >
        <Text style={[styles.btnA, styles.btnASmall, { color: colors.text }]}>A</Text>
      </Pressable>
      <Pressable onPress={() => setScale(1)} hitSlop={6} style={styles.valueBtn}>
        <Text style={[styles.value, { color: colors.primary }]}>{Math.round(scale * 100)}%</Text>
      </Pressable>
      <Pressable
        onPress={() => setScale(scale + FONT_SCALE_STEP)}
        disabled={atMax}
        hitSlop={6}
        style={[styles.btn, { backgroundColor: colors.card, opacity: atMax ? 0.4 : 1 }]}
      >
        <Text style={[styles.btnA, styles.btnALarge, { color: colors.text }]}>A</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  caption: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginRight: 2 },
  btn: {
    width: 34, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  btnA: { fontWeight: '800' },
  btnASmall: { fontSize: 13 },
  btnALarge: { fontSize: 19 },
  valueBtn: { minWidth: 48, alignItems: 'center', paddingVertical: 4 },
  value: { fontSize: 13, fontWeight: '800' },
});
