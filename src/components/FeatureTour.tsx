import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';

// First-launch walkthrough of the app's features: what each one is, how to use
// it, and what makes it special. Shown once (settings.tourSeen) and can be
// replayed from the Library screen.
interface Slide {
  icon: string;
  title: string;
  tagline: string;
  how: string[];
  special: string[];
}

const SLIDES: Slide[] = [
  {
    icon: '🪷',
    title: 'Welcome to Vedabase Library',
    tagline: "Śrīla Prabhupāda's complete library in your pocket",
    how: [
      'Bhagavad-gītā, Śrīmad-Bhāgavatam, Caitanya-caritāmṛta and 35 more books',
      'Thousands of lectures, letters and conversations',
      'Open the Library tab and tap any cover to start reading',
    ],
    special: ['Same text as vedabase.io, with Sanskrit, word-for-word, translation and purport'],
  },
  {
    icon: '⌕',
    title: 'Smart Search',
    tagline: 'Find any verse or phrase in a moment',
    how: [
      'Use the search bar at the bottom of the screen (or the Search pill on a verse page)',
      'Type a reference like "bg 2.13" or "sb 1.2.6" to jump straight to it',
      'Or type words: "so-called scholars", "soka bhaya", "krsna"',
    ],
    special: [
      'No diacritics needed: "krsna" finds kṛṣṇa',
      'Forgives small typos',
      'Exact phrases come first; results split into Śloka, Translation and Purport',
      'Your words are highlighted in every result',
    ],
  },
  {
    icon: '📦',
    title: 'Read Offline',
    tagline: 'Download books once, read anywhere',
    how: [
      'Library → Download Manager',
      'Tap "Select books" to pick several, or add a whole category at once',
      'Press "Download N books" and close the app if you like',
    ],
    special: [
      'Downloads keep running in the background, with progress in your notifications',
      'Search covers every downloaded book, even with no internet',
    ],
  },
  {
    icon: 'अ',
    title: 'Understand the Sanskrit',
    tagline: 'Word meanings right on the verse',
    how: [
      'On a verse page, tap Meanings in the bottom toolbar',
      "Each Sanskrit word shows Prabhupāda's own word-for-word meaning",
      'With Meanings on, tap any word to open its full meaning',
    ],
    special: ['Meanings come from the book itself, so they match the translation'],
  },
  {
    icon: 'Aa',
    title: 'Comfortable Reading',
    tagline: 'Make the text and colours yours',
    how: [
      'Tap Aa at the top right of any page to make the text bigger or smaller',
      'Tap the lamp ▾ to pick from all four themes: System, Light, Dark, Vedabase',
      'In a chapter, switch to ▤ Advanced to read every verse in one scroll',
    ],
    special: ['Text size changes instantly on the page you are reading and is remembered everywhere'],
  },
  {
    icon: '🖼️',
    title: 'Verse Wallpaper',
    tagline: 'Keep a śloka in front of you all day',
    how: [
      'On a verse page, tap Wallpaper in the toolbar',
      'That verse becomes your lock-screen and home-screen wallpaper',
    ],
    special: [
      'Beautifully set with its reference (e.g. BG 2.13) in one tap',
      'Also becomes your sloka of the day',
    ],
  },
  {
    icon: '🔖',
    title: 'Save, Tag & Note',
    tagline: 'Build your personal study collection',
    how: [
      'Tap Save on any verse; find it later in the Saved tab',
      'Add tags in Saved to group verses by topic',
      'Tap Note to write your own realisations on a verse',
      'Tap 🕘 at the top right to revisit recently read pages',
    ],
    special: ['Everything stays on your device and works offline'],
  },
  {
    icon: '⌕',
    title: 'Find in Page',
    tagline: 'Jump to any word inside a long purport',
    how: [
      'On a verse page, tap Find in the toolbar',
      'Type a word and step through matches with ‹ ›',
    ],
    special: ['Highlights every match and scrolls straight to it'],
  },
];

interface TourState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const useTourStore = create<TourState>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));

export function FeatureTour() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const loaded = useSettingsStore((s) => s.loaded);
  const tourSeen = useSettingsStore((s) => s.settings.tourSeen);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const { visible, show, hide } = useTourStore();
  const [index, setIndex] = useState(0);

  // Show automatically the first time the app is opened.
  useEffect(() => {
    if (loaded && !tourSeen) show();
  }, [loaded, tourSeen, show]);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const finish = () => {
    hide();
    if (!tourSeen) updateSetting('tourSeen', true);
  };

  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={finish} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.topRow}>
          <Text style={[styles.counter, { color: colors.textMuted }]}>{index + 1} / {SLIDES.length}</Text>
          {!last && (
            <Pressable onPress={finish} hitSlop={12}>
              <Text style={[styles.skip, { color: colors.textMuted }]}>Skip</Text>
            </Pressable>
          )}
        </View>

        <ScrollView key={index} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.icon, { color: colors.primary }]}>{slide.icon}</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
          <Text style={[styles.tagline, { color: colors.primary }]}>{slide.tagline}</Text>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textMuted }]}>HOW TO USE</Text>
            {slide.how.map((h, i) => (
              <View key={i} style={styles.line}>
                <Text style={[styles.step, { backgroundColor: colors.primary }]}>{i + 1}</Text>
                <Text style={[styles.lineText, { color: colors.text }]}>{h}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>✨ WHAT MAKES IT SPECIAL</Text>
            {slide.special.map((s, i) => (
              <View key={i} style={styles.line}>
                <Text style={[styles.bullet, { color: colors.primary }]}>✓</Text>
                <Text style={[styles.lineText, { color: colors.text }]}>{s}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => setIndex(i)} hitSlop={6}>
              <View style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 20 : 8 }]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.navRow}>
          <Pressable
            onPress={() => setIndex(index - 1)}
            disabled={index === 0}
            style={[styles.navBtn, { borderColor: colors.border, opacity: index === 0 ? 0 : 1 }]}
          >
            <Text style={[styles.navText, { color: colors.textSecondary }]}>‹ Back</Text>
          </Pressable>
          <Pressable
            onPress={() => (last ? finish() : setIndex(index + 1))}
            style={({ pressed }) => [styles.navBtn, styles.navPrimary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.navText, { color: '#FFF' }]}>{last ? 'Start reading 🙏' : 'Next ›'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  counter: { fontSize: 12, fontWeight: '700' },
  skip: { fontSize: 14, fontWeight: '700' },
  body: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  icon: { fontSize: 38, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  tagline: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  card: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  cardTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  step: {
    color: '#FFF', fontSize: 12, fontWeight: '800', width: 22, height: 22, borderRadius: 11,
    textAlign: 'center', lineHeight: 22, overflow: 'hidden',
  },
  bullet: { fontSize: 15, fontWeight: '800', width: 22, textAlign: 'center' },
  lineText: { flex: 1, fontSize: 15, lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 14 },
  dot: { height: 8, borderRadius: 4 },
  navRow: { flexDirection: 'row', gap: 12 },
  navBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navPrimary: { flex: 2, borderWidth: 0 },
  navText: { fontSize: 16, fontWeight: '800' },
});
