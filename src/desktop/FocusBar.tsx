// The only chrome left in full-screen reading: where you are, the search box,
// optional page controls, and the way out.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { SearchBox } from './DesktopHeader';
import { Btn, IconBtn } from './ui';
import { useDesktopUi } from './uiStore';
import { SERIF, web } from './theme';

/** Pages that offer full-screen reading. */
export const FOCUS_PATHS = ['/verse', '/chapter', '/slokas'];

export function FocusBar({ label, children, searchWidth = 520 }: { label?: string; children?: React.ReactNode; searchWidth?: number }) {
  const { colors } = useTheme();
  const setFocusMode = useDesktopUi((st) => st.setFocusMode);
  return (
    // Three columns in one flex row, so they can never overlap: the two side
    // columns share the free space equally (which keeps the search centred),
    // the right one never shrinks below its controls, and the label on the
    // left gives way (truncates) first, then the search box narrows.
    <View style={[s.bar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={s.left}>
        <Text style={[s.ref, { color: colors.textMuted }]} numberOfLines={1}>{label ?? ''}</Text>
      </View>
      <SearchBox width={searchWidth} />
      <View style={[s.right, web({ minWidth: 'max-content' })]}>
        {children}
        <Btn size="sm" kind="ghost" icon="✕" label="Exit" onPress={() => setFocusMode(false)} tip="Exit full screen — back to the normal view  (Esc or F)" />
      </View>
    </View>
  );
}

export function FullScreenBtn({ onBefore }: { onBefore?: () => void }) {
  const setFocusMode = useDesktopUi((st) => st.setFocusMode);
  return <IconBtn icon="⛶" tip="Full-screen reading — only the text, Next and search  (F)" onPress={() => { onBefore?.(); setFocusMode(true); }} size={32} />;
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 16, height: 60, borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 50 },
  left: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  ref: { fontFamily: SERIF, fontSize: 15, fontWeight: '600' },
  right: { flexGrow: 1, flexShrink: 0, flexBasis: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
});
