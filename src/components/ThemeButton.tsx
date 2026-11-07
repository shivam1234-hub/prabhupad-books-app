import React, { useState } from 'react';
import { Text, Pressable, StyleSheet, Platform, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { Colors } from '@/constants/colors';
import { ThemeMode } from '@/types';
import { HeaderMenu } from './HeaderMenu';

// Header control that opens a dropdown of every theme, each with a swatch of
// its colours, so the choice is visible instead of cycling blind.
const THEMES: { mode: ThemeMode; icon: string; label: string; desc: string }[] = [
  { mode: 'system', icon: '🔄', label: 'System', desc: 'Follows your phone' },
  { mode: 'light', icon: '☀️', label: 'Light', desc: 'Cream parchment, saffron accents' },
  { mode: 'dark', icon: '🌙', label: 'Dark', desc: 'Warm brown-black, easy at night' },
  { mode: 'vedabase', icon: '🪔', label: 'Vedabase', desc: 'Classic vedabase.io look' },
];

function swatch(mode: ThemeMode) {
  const c = mode === 'system' ? null : Colors[mode];
  return c ? [c.background, c.primary] : [Colors.light.background, Colors.dark.background];
}

export function ThemeButton() {
  const { colors } = useTheme();
  const themeMode = useSettingsStore((s) => s.settings.themeMode);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [open, setOpen] = useState(false);

  const current = THEMES.find((t) => t.mode === themeMode) ?? THEMES[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`${current.label} theme. Choose theme.`}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.searchBackground, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={styles.icon}>{current.icon}</Text>
        <Text style={[styles.caret, { color: colors.textMuted }]}>▾</Text>
      </Pressable>
      <HeaderMenu visible={open} onClose={() => setOpen(false)}>
        <Text style={[styles.title, { color: colors.textMuted }]}>THEME</Text>
        {THEMES.map((t) => {
          const active = t.mode === themeMode;
          const [bg, accent] = swatch(t.mode);
          return (
            <Pressable
              key={t.mode}
              onPress={() => { updateSetting('themeMode', t.mode); setOpen(false); }}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: active ? colors.primaryLight : pressed ? colors.searchBackground : 'transparent' },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: bg, borderColor: colors.border }]}>
                <View style={[styles.swatchDot, { backgroundColor: accent }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t.icon}  {t.label}</Text>
                <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{t.desc}</Text>
              </View>
              {active && <Text style={[styles.check, { color: colors.primary }]}>✓</Text>}
            </Pressable>
          );
        })}
      </HeaderMenu>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginRight: Platform.OS === 'ios' ? 4 : 8,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  icon: { fontSize: 15 },
  caret: { fontSize: 10 },
  title: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6, marginLeft: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10 },
  swatch: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatchDot: { width: 12, height: 12, borderRadius: 6 },
  rowLabel: { fontSize: 14, fontWeight: '700' },
  rowDesc: { fontSize: 11, marginTop: 1 },
  check: { fontSize: 16, fontWeight: '800' },
});
