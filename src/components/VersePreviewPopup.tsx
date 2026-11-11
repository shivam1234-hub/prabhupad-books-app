import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchVerseDetailed } from '@/services/vedabaseApi';
import type { LibraryRef } from '@/services/purport/citations';
import { Verse } from '@/types';
import { AnchoredCard } from './AnchoredCard';

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
  const { colors } = useTheme();
  const settings = useSettingsStore(s => s.settings);
  const sc = settings.fontScale ?? 1;
  const px = (n: number) => Math.round(n * sc);

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

  const open = () => { onClose(); onOpenVerse(target.ref); };

  return (
    <AnchoredCard
      at={target}
      title={verse ? labelFor(target.label, verse) : target.label}
      onClose={onClose}
    >
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
    </AnchoredCard>
  );
}

/** "Bhagavad-gītā 2.13" — or the combined range when the verse is one ("16-18"). */
function labelFor(label: string, v: Verse): string {
  if (!v.verseRange) return label;
  return label.replace(/(\d+)(?:[–-]\d+)?$/, v.verseRange.replace('-', '–'));
}

const styles = StyleSheet.create({
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
