import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchVerseDetailed } from '@/services/vedabaseApi';
import type { LibraryRef } from '@/services/purport/citations';
import { Verse } from '@/types';

export interface VersePreviewTarget {
  /** As written in the purport's book ("Bhagavad-gītā 2.13"). */
  label: string;
  ref: LibraryRef;
  /** Where the reference was tapped (window coordinates), to place the card. */
  x: number;
  y: number;
}

interface Props {
  target: VersePreviewTarget | null;
  onClose: () => void;
  onOpenVerse: (ref: LibraryRef) => void;
}

const CARD_MAX_WIDTH = 440;
const GAP = 14;

/** The first paragraph of a purport, cut at a word near `max` characters. */
function excerpt(text: string, max = 420): string {
  const first = text.trim().split(/\n{2,}/)[0] ?? '';
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max)}…`;
}

/**
 * A small card over the verse screen showing a verse referred to in the
 * purport — like a link preview: the verse, its translation and the start of
 * the purport, with a button to open it in full. It sits just below the
 * tapped reference, or above it when the reference is low on the screen.
 */
export function VersePreviewPopup({ target, onClose, onOpenVerse }: Props) {
  const { colors, isDark } = useTheme();
  const settings = useSettingsStore(s => s.settings);
  const sc = settings.fontScale ?? 1;
  const px = (n: number) => Math.round(n * sc);
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const [verse, setVerse] = useState<Verse | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'offline' | 'missing'>('loading');
  const [tick, setTick] = useState(0);

  const key = target ? `${target.ref.bookSlug}/${target.ref.canto ?? ''}/${target.ref.chapter}/${target.ref.verse}` : '';
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setVerse(null);
    setState('loading');
    const { bookSlug, chapter, verse: v, canto } = target.ref;
    fetchVerseDetailed(bookSlug, chapter, v, canto, settings.language)
      .then(r => {
        if (cancelled) return;
        setVerse(r.verse);
        setState(r.verse ? 'ok' : r.networkError ? 'offline' : 'missing');
      })
      .catch(() => { if (!cancelled) setState('offline'); });
    return () => { cancelled = true; };
  }, [key, settings.language, tick]);

  if (!target) return null;

  // Placement: below the tap when it is in the upper half, else above it.
  const cardW = Math.min(CARD_MAX_WIDTH, winW - 24);
  const left = Math.max(12, Math.min(target.x - cardW / 2, winW - cardW - 12));
  const below = target.y < winH * 0.5;
  const top0 = insets.top + 8;
  const bottom0 = insets.bottom + 8;
  const room = below ? winH - (target.y + GAP) - bottom0 : target.y - GAP - top0;
  const maxH = Math.max(220, Math.min(room, winH * 0.6));
  const place = below
    ? { top: Math.min(target.y + GAP, winH - bottom0 - maxH) }
    : { bottom: Math.min(winH - target.y + GAP, winH - top0 - maxH) };
  const arrowLeft = Math.max(16, Math.min(target.x - left - 8, cardW - 32));

  const open = () => { onClose(); onOpenVerse(target.ref); };

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
            <Text style={[styles.label, { color: colors.primary, fontSize: px(15) }]} numberOfLines={2}>
              {verse ? labelFor(target.label, verse) : target.label}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator>
            {state === 'loading' && (
              <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
            )}
            {state === 'offline' && (
              <View style={styles.centered}>
                <Text style={[styles.note, { color: colors.textSecondary, fontSize: px(14) }]}>
                  This verse isn't downloaded, and it couldn't be fetched. Check your connection.
                </Text>
                <Pressable onPress={() => setTick(t => t + 1)} hitSlop={8}>
                  <Text style={[styles.retry, { color: colors.primary }]}>Try again</Text>
                </Pressable>
              </View>
            )}
            {state === 'missing' && (
              <Text style={[styles.note, { color: colors.textSecondary, fontSize: px(14) }]}>
                This verse wasn't found in the library.
              </Text>
            )}
            {state === 'ok' && verse && (
              <>
                {!!verse.transliteration && (
                  <Text style={[styles.translit, { color: colors.textSecondary, fontSize: px(14), lineHeight: px(22) }]}>
                    {verse.transliteration}
                  </Text>
                )}
                {!!verse.translation && (
                  <Text style={[styles.translation, { color: colors.text, fontSize: px(15), lineHeight: px(23) }]}>
                    {verse.translation}
                  </Text>
                )}
                {!!verse.purport && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.primary }]}>PURPORT</Text>
                    <Text style={[styles.purport, { color: colors.textSecondary, fontSize: px(14), lineHeight: px(22) }]}>
                      {excerpt(verse.purport)}
                    </Text>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {state !== 'missing' && (
            <Pressable
              onPress={open}
              style={({ pressed }) => [styles.openBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={styles.openText}>Open full verse ›</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** "Bhagavad-gītā 2.13" — or the combined range when the verse is one ("16-18"). */
function labelFor(label: string, v: Verse): string {
  if (!v.verseRange) return label;
  return label.replace(/(\d+)(?:[–-]\d+)?$/, v.verseRange.replace('-', '–'));
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
  label: { flex: 1, fontWeight: '800' },
  close: { fontSize: 16, fontWeight: '700' },
  body: { flexShrink: 1 },
  bodyContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  centered: { alignItems: 'center', paddingVertical: 18, gap: 10 },
  note: { textAlign: 'center' },
  retry: { fontWeight: '700', fontSize: 14 },
  translit: { fontStyle: 'italic', textAlign: 'center' },
  translation: { fontWeight: '600' },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 },
  purport: {},
  openBtn: {
    margin: 12,
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  openText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
