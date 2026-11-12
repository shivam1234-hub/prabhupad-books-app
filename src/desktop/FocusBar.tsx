// The only chrome left in full-screen reading: where you are, the search box,
// optional page controls, and the way out.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { SearchBox } from './DesktopHeader';
import { Btn, IconBtn } from './ui';
import { useDesktopUi } from './uiStore';
import { SERIF } from './theme';

/** Pages that offer full-screen reading. */
export const FOCUS_PATHS = ['/verse', '/chapter', '/slokas'];

export function FocusBar({ label, children, searchWidth = 520 }: { label?: string; children?: React.ReactNode; searchWidth?: number }) {
  const { colors } = useTheme();
  const setFocusMode = useDesktopUi((st) => st.setFocusMode);
  return (
    <View style={[s.bar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <Text style={[s.ref, { color: colors.textMuted }]} numberOfLines={1}>{label ?? ''}</Text>
      <SearchBox width={searchWidth} />
      <View style={s.right}>
        {children}
        <WidthBtn />
        <Btn size="sm" kind="ghost" icon="✕" label="Exit full screen" onPress={() => setFocusMode(false)} tip="Back to the normal view  (Esc or F)" />
      </View>
    </View>
  );
}

export function FullScreenBtn({ onBefore }: { onBefore?: () => void }) {
  const setFocusMode = useDesktopUi((st) => st.setFocusMode);
  return <IconBtn icon="⛶" tip="Full-screen reading — only the text, Next and search  (F)" onPress={() => { onBefore?.(); setFocusMode(true); }} size={32} />;
}

/** Reading text across the whole window, or in a narrow book column (W). */
export function WidthBtn() {
  const wide = useDesktopUi((st) => st.wideText);
  const toggle = useDesktopUi((st) => st.toggleWideText);
  return (
    <IconBtn
      icon="↔"
      active={wide}
      tip={wide ? 'Narrow text column  (W)' : 'Text across the full width  (W)'}
      onPress={toggle}
      size={32}
    />
  );
}

/** Max width of the reading column. */
export const readingWidth = (wide: boolean, base: number) => (wide ? 1600 : base);

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, height: 60, borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 50 },
  ref: { position: 'absolute', left: 20, fontFamily: SERIF, fontSize: 15, fontWeight: '600', maxWidth: 300 },
  right: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
