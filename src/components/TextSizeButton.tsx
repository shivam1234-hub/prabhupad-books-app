import React, { useState } from 'react';
import { Text, Pressable, StyleSheet, Platform, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FontSizeControl } from './FontSizeControl';
import { HeaderMenu } from './HeaderMenu';

// Header "Aa" button, on every screen, so the reading-text size can be changed
// while looking at the text it changes (verse, chapter and book pages).
export function TextSizeButton() {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Text size"
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.searchBackground, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.icon, { color: colors.text }]}>
          A<Text style={styles.iconSmall}>a</Text>
        </Text>
      </Pressable>
      <HeaderMenu visible={open} onClose={() => setOpen(false)} width={250}>
        <Text style={[styles.title, { color: colors.textMuted }]}>TEXT SIZE</Text>
        <View style={styles.center}><FontSizeControl compact /></View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>Tap the % to reset to 100%</Text>
      </HeaderMenu>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginRight: Platform.OS === 'ios' ? 4 : 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 16, fontWeight: '800' },
  iconSmall: { fontSize: 12 },
  title: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  center: { alignItems: 'center' },
  hint: { fontSize: 11, marginTop: 8, textAlign: 'center' },
});
