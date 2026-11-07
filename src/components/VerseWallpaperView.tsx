import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  StatusBar, Platform, ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Verse } from '@/types';
import { generateAndDownloadWallpaper, shortVerseRef } from '@/utils/generateWallpaper';
import { generateAndSetWallpaper, type WallpaperFlag } from 'wallpaper-setter';
import { parseSynonyms } from '@/utils/parseSynonyms';

interface Props {
  verse: Verse;
  visible: boolean;
  onClose: () => void;
}

type Status = 'idle' | 'busy' | 'done' | 'error';

const { width: SW, height: SH } = Dimensions.get('screen');

const TARGETS: { value: WallpaperFlag; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'lock', label: 'Lock' },
  { value: 'both', label: 'Both' },
];

export function VerseWallpaperView({ verse, visible, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const [status, setStatus] = useState<Status>('idle');
  // Which screen(s) to apply the wallpaper to. Defaults to Both so the lock
  // screen is covered too — the native module maps this to FLAG_SYSTEM|FLAG_LOCK.
  const [target, setTarget] = useState<WallpaperFlag>('both');

  // Reset the button to its actionable state whenever the modal is reopened or
  // the target changes — otherwise it stays stuck on "✓ Wallpaper Set!" and the
  // user can't apply a new wallpaper.
  useEffect(() => {
    if (visible) setStatus('idle');
  }, [visible, target]);

  const ref = shortVerseRef(verse);

  const bg = isDark ? '#0E0B07' : '#F5F0E8';
  const devaColor = isDark ? '#D4882A' : '#A0540C';
  const translitColor = isDark ? '#C4A870' : '#6B4F28';
  const textColor = isDark ? '#EEE4D0' : '#1E140A';
  const mutedColor = isDark ? '#6A5A44' : '#8A7A64';
  const cardBg = isDark ? 'rgba(20,16,8,0.85)' : 'rgba(255,252,245,0.88)';
  const cardBorder = isDark ? 'rgba(80,60,30,0.6)' : 'rgba(180,150,90,0.4)';

  const handleSetWallpaper = async () => {
    if (status === 'busy') return;
    setStatus('busy');

    try {
      if (Platform.OS === 'web') {
        await generateAndDownloadWallpaper({ verse, isDark, accent: devaColor });
        setStatus('done');
        return;
      }

      // Android: generate bitmap + set wallpaper entirely in native Kotlin
      await generateAndSetWallpaper(
        {
          transliteration: verse.transliteration ?? '',
          wordForWord: verse.synonyms ?? '',
          translation: verse.translation ?? '',
          reference: ref,
          isDark,
        },
        target,
      );
      setStatus('done');
    } catch (e) {
      console.warn('Wallpaper error:', e);
      setStatus('error');
    }
  };

  const btnLabel = () => {
    if (status === 'busy') return '';
    if (status === 'done') return '✓ Wallpaper Set!';
    if (status === 'error') return 'Failed — tap to retry';
    if (Platform.OS === 'web') return 'Download PNG';
    return target === 'home'
      ? 'Set on Home Screen'
      : target === 'lock'
        ? 'Set on Lock Screen'
        : 'Set on Home & Lock';
  };

  const btnBg = () => {
    if (status === 'done') return '#3E7A3E';
    if (status === 'error') return '#8A3A3A';
    return devaColor;
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.container, { backgroundColor: bg }]}>
        {/* Subtle vignette */}
        <View style={styles.vignetteOuter} pointerEvents="none">
          <View style={[styles.vignetteInner, { backgroundColor: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.04)' }]} />
        </View>

        {/* Preview of what the wallpaper will look like */}
        <View style={[styles.captureTarget, { backgroundColor: bg }]}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {verse.transliteration ? (
              <View style={styles.previewBlock}>
                <Text style={[styles.blockLabel, styles.refLabel, { color: devaColor }]}>{ref}</Text>
                <Text style={[styles.translit, { color: translitColor }]}>
                  {verse.transliteration}
                </Text>
              </View>
            ) : null}

            {verse.synonyms ? (
              <View style={styles.previewBlock}>
                <Text style={[styles.blockLabel, { color: devaColor }]}>WORD FOR WORD</Text>
                <Text style={styles.wordForWord}>
                  {parseSynonyms(verse.synonyms).map((t, i, arr) => (
                    <Text key={i}>
                      <Text style={{ color: devaColor, fontWeight: '800' }}>{t.word}</Text>
                      {t.meaning ? <Text style={{ color: textColor, fontStyle: 'italic' }}>{` — ${t.meaning}`}</Text> : null}
                      {i < arr.length - 1 ? <Text style={{ color: mutedColor }}>{';  '}</Text> : null}
                    </Text>
                  ))}
                </Text>
              </View>
            ) : null}

            {verse.translation ? (
              <View style={styles.previewBlock}>
                <Text style={[styles.blockLabel, { color: devaColor }]}>TRANSLATION</Text>
                <Text style={[styles.cardText, { color: textColor }]}>
                  {verse.translation}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

        {/* Floating action bar */}
        <View style={[styles.actionBar, { backgroundColor: isDark ? 'rgba(14,11,7,0.92)' : 'rgba(245,240,232,0.92)', borderColor: cardBorder }]}>
          {/* Target selector — which screen(s) to apply to (Android only) */}
          {Platform.OS !== 'web' ? (
            <View style={[styles.segment, { borderColor: cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
              {TARGETS.map((t) => {
                const active = target === t.value;
                return (
                  <Pressable
                    key={t.value}
                    style={[styles.segmentItem, active && { backgroundColor: devaColor }]}
                    onPress={() => setTarget(t.value)}
                  >
                    <Text style={[styles.segmentText, { color: active ? '#FFF' : mutedColor }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.setBtn,
              { backgroundColor: btnBg(), opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={handleSetWallpaper}
            disabled={status === 'busy'}
          >
            {status === 'busy' ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.setBtnTxt}>{btnLabel()}</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.closeBtn,
              { borderColor: cardBorder, opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.closeTxt, { color: mutedColor }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SW,
    minHeight: SH,
  },
  vignetteOuter: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  } as any,
  vignetteInner: {
    width: SW * 1.5,
    height: SH * 1.5,
    borderRadius: SW * 1.5,
  },
  captureTarget: {
    flex: 1,
    marginBottom: 120,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
    gap: 28,
  },
  previewBlock: { gap: 8 },
  blockLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2.5,
  },
  refLabel: { textAlign: 'center' },
  translit: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  wordForWord: {
    fontSize: 15,
    lineHeight: 26,
  },
  badge: {
    borderWidth: 1.2,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 14, fontWeight: '700', letterSpacing: 0.3,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
  },
  cardLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 2.5,
  },
  cardText: {
    fontSize: 18, lineHeight: 32, fontWeight: '400',
  },
  attr: {
    fontSize: 14, fontStyle: 'italic', marginTop: 4,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 22,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    gap: 10,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  setBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  setBtnTxt: {
    color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2,
  },
  closeBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeTxt: {
    fontSize: 14, fontWeight: '600',
  },
});
