import React from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';

const CARD_MAX_WIDTH = 440;
const GAP = 14;

interface Props {
  /** Where the link was tapped (window coordinates). */
  at: { x: number; y: number };
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A small card over the screen, anchored at a tapped link like a link
 * preview: just below the tap when it is in the upper half of the screen,
 * otherwise above it, with an arrow pointing at the link.
 */
export function AnchoredCard({ at, title, onClose, children }: Props) {
  const { colors, isDark } = useTheme();
  const sc = useSettingsStore(s => s.settings.fontScale) ?? 1;
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const cardW = Math.min(CARD_MAX_WIDTH, winW - 24);
  const left = Math.max(12, Math.min(at.x - cardW / 2, winW - cardW - 12));
  const below = at.y < winH * 0.5;
  const top0 = insets.top + 8;
  const bottom0 = insets.bottom + 8;
  const room = below ? winH - (at.y + GAP) - bottom0 : at.y - GAP - top0;
  const maxH = Math.max(220, Math.min(room, winH * 0.6));
  const place = below
    ? { top: Math.min(at.y + GAP, winH - bottom0 - maxH) }
    : { bottom: Math.min(winH - at.y + GAP, winH - top0 - maxH) };
  const arrowLeft = Math.max(16, Math.min(at.x - left - 8, cardW - 32));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop as a sibling layer, not a parent of the card: a touchable
          parent steals slow drags from the ScrollView on Android. */}
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)' }]}
          onPress={onClose}
          accessibilityLabel="Close preview"
        />
        <View
          style={[
            styles.card,
            { left, width: cardW, maxHeight: maxH, backgroundColor: colors.card, borderColor: colors.border },
            place,
          ]}
        >
          <View
            style={[
              styles.arrow,
              { left: arrowLeft, backgroundColor: colors.card, borderColor: colors.border },
              below ? styles.arrowTop : styles.arrowBottom,
            ]}
          />
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.primary, fontSize: Math.round(15 * sc) }]} numberOfLines={2}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  arrow: {
    position: 'absolute',
    width: 16,
    height: 16,
    transform: [{ rotate: '45deg' }],
    borderWidth: StyleSheet.hairlineWidth,
  },
  arrowTop: { top: -8, borderRightWidth: 0, borderBottomWidth: 0 },
  arrowBottom: { bottom: -8, borderLeftWidth: 0, borderTopWidth: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontWeight: '800' },
  close: { fontSize: 16, fontWeight: '700' },
});
