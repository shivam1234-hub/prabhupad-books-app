import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import type { Personality, PersonalityRead } from '@/constants/personalities';
import { SB_CHAPTER_TITLES } from '@/constants/sbChapters';
import type { LibraryRef } from '@/services/purport/citations';
import { AnchoredCard } from './AnchoredCard';

export interface PersonalityTarget {
  person: Personality;
  /** Where the name was tapped (window coordinates), to place the card. */
  x: number;
  y: number;
}

interface Props {
  target: PersonalityTarget | null;
  onClose: () => void;
  onOpenVerse: (ref: LibraryRef) => void;
}

const LILA = ['Ādi', 'Madhya', 'Antya'];

/** "Śrīmad-Bhāgavatam 4.8" and, for SB, the chapter's title. */
function sourceLabel(r: PersonalityRead): { ref: string; title?: string } {
  switch (r.bookSlug) {
    case 'sb':
      return {
        ref: `Śrīmad-Bhāgavatam ${r.canto}.${r.chapter}${r.verse ? `.${r.verse}` : ''}`,
        title: SB_CHAPTER_TITLES[r.canto!]?.[r.chapter - 1],
      };
    case 'cc':
      return { ref: `Caitanya-caritāmṛta, ${LILA[r.canto! - 1]} ${r.chapter}` };
    case 'bg':
      return { ref: `Bhagavad-gītā ${r.chapter}.${r.verse}` };
  }
}

const toLibraryRef = (r: PersonalityRead): LibraryRef => ({
  bookSlug: r.bookSlug,
  ...(r.canto != null ? { canto: r.canto } : {}),
  chapter: r.chapter,
  verse: r.verse ?? '1',
});

/**
 * A short note on a personality named in the text — who they are, and where
 * Śrīla Prabhupāda's books tell their story — anchored at the tapped name.
 */
export function PersonalityPopup({ target, onClose, onOpenVerse }: Props) {
  const { colors } = useTheme();
  const sc = useSettingsStore(s => s.settings.fontScale) ?? 1;
  const px = (n: number) => Math.round(n * sc);
  if (!target) return null;
  const p = target.person;

  return (
    <AnchoredCard at={target} title={p.name} onClose={onClose}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator>
        <Text style={[styles.role, { color: colors.textSecondary, fontSize: px(13.5), lineHeight: px(20) }]}>
          {p.role}
        </Text>
        <Text style={{ color: colors.text, fontSize: px(15), lineHeight: px(23) }}>{p.about}</Text>

        {!!p.read?.length && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>READ IN ŚRĪLA PRABHUPĀDA’S BOOKS</Text>
            {p.read.map((r, i) => {
              const { ref, title } = sourceLabel(r);
              return (
                <Pressable
                  key={i}
                  onPress={() => { onClose(); onOpenVerse(toLibraryRef(r)); }}
                  style={({ pressed }) => [
                    styles.source,
                    { borderColor: colors.border, backgroundColor: pressed ? colors.border : 'transparent' },
                  ]}
                  accessibilityRole="link"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sourceRef, { color: colors.primary, fontSize: px(14) }]}>{ref}</Text>
                    {!!title && (
                      <Text style={{ color: colors.textSecondary, fontSize: px(13), lineHeight: px(18) }} numberOfLines={2}>
                        {title}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.chevron, { color: colors.primary }]}>›</Text>
                </Pressable>
              );
            })}
          </>
        )}
        <Text style={[styles.note, { color: colors.textMuted, fontSize: px(12) }]}>
          A short summary — open a source for Śrīla Prabhupāda’s own words.
        </Text>
      </ScrollView>
    </AnchoredCard>
  );
}

const styles = StyleSheet.create({
  body: { flexShrink: 1 },
  bodyContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  role: { fontStyle: 'italic' },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 6 },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sourceRef: { fontWeight: '700' },
  chevron: { fontSize: 20, fontWeight: '700' },
  note: { fontStyle: 'italic', marginTop: 2 },
});
