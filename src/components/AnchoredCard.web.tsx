import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { hoverIntent } from '@/desktop/hoverIntent';

const CARD_MAX_WIDTH = 460;
const GAP = 10;

interface Props {
  /** Where the link is (window coordinates). */
  at: { x: number; y: number };
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Desktop version of the link-preview card (see AnchoredCard.tsx). On a phone
 * it is a modal opened by a tap; with a mouse it is a hover card: no backdrop,
 * it stays open while the pointer is on it, and closes when the pointer leaves,
 * on Esc, or on a click elsewhere.
 */
export function AnchoredCard({ at, title, onClose, children }: Props) {
  const { colors, isDark } = useTheme();
  const sc = useSettingsStore((s) => s.settings.fontScale) ?? 1;
  const { width: winW, height: winH } = useWindowDimensions();
  const card = useRef<any>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    const onDown = (e: MouseEvent) => { if (!card.current?.contains?.(e.target as Node)) close.current(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, []);

  const cardW = Math.min(CARD_MAX_WIDTH, winW - 24);
  const left = Math.max(12, Math.min(at.x - cardW / 2, winW - cardW - 12));
  const below = at.y < winH * 0.5;
  const room = below ? winH - (at.y + GAP) - 12 : at.y - GAP - 12;
  const maxH = Math.max(200, Math.min(room, winH * 0.62));
  const place = below ? { top: at.y + GAP } : { bottom: winH - at.y + GAP };
  const arrowLeft = Math.max(16, Math.min(at.x - left - 8, cardW - 32));

  if (typeof document === 'undefined') return null;
  return createPortal(
    <View
      ref={card}
      dataSet={{ vbPop: '1' }}
      onMouseEnter={() => hoverIntent.cancelClose()}
      onMouseLeave={() => hoverIntent.close(() => close.current())}
      style={[
        styles.card,
        { left, width: cardW, maxHeight: maxH, backgroundColor: colors.card, borderColor: colors.border },
        place,
        {
          position: 'fixed',
          zIndex: 900,
          boxShadow: isDark ? '0 18px 48px rgba(0,0,0,0.55)' : '0 4px 10px rgba(0,0,0,0.08), 0 18px 44px rgba(0,0,0,0.18)',
        } as any,
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
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close" style={{ cursor: 'pointer' } as any}>
          <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
        </Pressable>
      </View>
      {children}
    </View>,
    document.body,
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  arrow: { position: 'absolute', width: 14, height: 14, transform: [{ rotate: '45deg' }], borderWidth: StyleSheet.hairlineWidth },
  arrowTop: { top: -7, borderRightWidth: 0, borderBottomWidth: 0 },
  arrowBottom: { bottom: -7, borderLeftWidth: 0, borderTopWidth: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontWeight: '800' },
  close: { fontSize: 15, fontWeight: '700' },
});
