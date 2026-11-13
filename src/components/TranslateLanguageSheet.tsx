import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { TRANSLATE_LANGUAGES, TranslateLang } from '@/services/translate';

interface Props {
  visible: boolean;
  current: TranslateLang | null;
  onSelect: (lang: TranslateLang) => void;
  onClose: () => void;
}

/** Bottom sheet to choose the language a verse is machine-translated into. */
export function TranslateLanguageSheet({ visible, current, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.title, { color: colors.text }]}>Translate into</Text>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            A machine translation made on your phone by Google ML Kit — not the
            Bhaktivedanta Book Trust’s translation. It can be wrong; Śrīla
            Prabhupāda’s original English stays one tap away.
          </Text>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.list}>
            {TRANSLATE_LANGUAGES.map(l => {
              const on = l.code === current;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => onSelect(l.code)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: pressed ? colors.border : 'transparent',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.native, { color: on ? colors.primary : colors.text }]}>{l.native}</Text>
                  <Text style={[styles.english, { color: colors.textMuted }]}>{l.english}</Text>
                  {on ? <Text style={{ color: colors.primary, fontWeight: '800' }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
    maxHeight: '80%',
  },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  note: { fontSize: 12.5, lineHeight: 18, textAlign: 'center', fontStyle: 'italic' },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  native: { fontSize: 18, fontWeight: '700' },
  english: { flex: 1, fontSize: 14 },
});
