import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useFavoritesStore } from '@/store/favoritesStore';

// New tags take the next colour in this list, so the Saved tab's filter chips
// stay distinguishable without asking the reader to pick one.
const TAG_COLORS = ['#C2410C', '#15803D', '#1D4ED8', '#9333EA', '#BE185D', '#0E7490', '#A16207', '#4D7C0F'];

// Bottom sheet for tagging a saved verse: toggle existing tags or create a new
// one (which is applied straight away). Opened from the verse screen's Save
// button right after saving, and again from "Saved" to edit tags or unsave.
export function TagSheet({ visible, verseId, title, onClose, onRemove }: {
  visible: boolean;
  verseId: string;
  title: string;
  onClose: () => void;
  onRemove?: () => void;
}) {
  const { colors } = useTheme();
  const tags = useFavoritesStore((s) => s.tags);
  const selected = useFavoritesStore((s) => s.verseTags[verseId]) ?? [];
  const { createTag, addVerseTag, removeVerseTag, loadVerseTagsFor } = useFavoritesStore();
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible && verseId) loadVerseTagsFor(verseId);
    if (!visible) setName('');
  }, [visible, verseId]);

  const toggle = (tagId: string) => {
    if (selected.includes(tagId)) removeVerseTag(verseId, tagId);
    else addVerseTag(verseId, tagId);
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Reuse an existing tag with the same name instead of making a duplicate.
    const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    const tag = existing ?? await createTag(trimmed, TAG_COLORS[tags.length % TAG_COLORS.length]);
    if (!selected.includes(tag.id)) await addVerseTag(verseId, tag.id);
    setName('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Sibling backdrop (not a wrapping Pressable) so the chip list still
            scrolls with a slow drag on Android. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>Saved ★</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{title}</Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>TAGS</Text>
          <ScrollView style={styles.chipScroll} contentContainerStyle={styles.chipWrap}>
            {tags.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                No tags yet — create one below, e.g. "Daily reading" or "Karma".
              </Text>
            ) : tags.map((t) => {
              const on = selected.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => toggle(t.id)}
                  style={[
                    styles.chip,
                    { borderColor: t.color, backgroundColor: on ? t.color : 'transparent' },
                  ]}
                >
                  <Text style={[styles.chipText, { color: on ? '#FFF' : t.color }]}>
                    {on ? '✓ ' : ''}{t.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.newRow}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.searchBackground }]}
              value={name}
              onChangeText={setName}
              placeholder="New tag…"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={create}
              maxLength={30}
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: name.trim() ? colors.primary : colors.border }]}
              onPress={create}
              disabled={!name.trim()}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            {onRemove && (
              <Pressable style={[styles.btn, { borderColor: colors.border }]} onPress={onRemove}>
                <Text style={[styles.btnText, { color: colors.error }]}>Remove from Saved</Text>
              </Pressable>
            )}
            <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: '#FFF' }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12,
    maxHeight: '80%',
  },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center', marginTop: -6 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 },
  chipScroll: { flexShrink: 1, maxHeight: 220 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 20 },
  newRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  addBtn: { borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', borderColor: 'transparent',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
});
