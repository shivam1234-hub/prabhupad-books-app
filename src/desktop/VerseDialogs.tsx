// Desktop dialogs for a saved verse: tags (same store and rules as the phone's
// TagSheet) and the personal note.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useFavoritesStore } from '@/store/favoritesStore';
import { Dialog, Btn, Chip } from './ui';
import { SANS, web } from './theme';

const TAG_COLORS = ['#C2410C', '#15803D', '#1D4ED8', '#9333EA', '#BE185D', '#0E7490', '#A16207', '#4D7C0F'];

export function TagDialog({ open, verseId, title, onClose, onRemove }: {
  open: boolean; verseId: string; title: string; onClose: () => void; onRemove?: () => void;
}) {
  const { colors } = useTheme();
  const tags = useFavoritesStore((s) => s.tags);
  const selected = useFavoritesStore((s) => s.verseTags[verseId]) ?? [];
  const { createTag, addVerseTag, removeVerseTag, loadVerseTagsFor } = useFavoritesStore();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open && verseId) loadVerseTagsFor(verseId);
    if (!open) setName('');
  }, [open, verseId]);

  const toggle = (id: string) => (selected.includes(id) ? removeVerseTag(verseId, id) : addVerseTag(verseId, id));
  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    const tag = existing ?? await createTag(trimmed, TAG_COLORS[tags.length % TAG_COLORS.length]);
    if (!selected.includes(tag.id)) await addVerseTag(verseId, tag.id);
    setName('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`★ Saved — ${title}`}
      width={500}
      footer={
        <>
          {onRemove ? <Btn label="Remove from Saved" kind="dangerGhost" onPress={onRemove} /> : null}
          <View style={{ flex: 1 }} />
          <Btn label="Done" kind="primary" onPress={onClose} />
        </>
      }
    >
      <Text style={[s.label, { color: colors.textMuted }]}>TAGS</Text>
      <View style={s.chips}>
        {tags.length === 0 ? (
          <Text style={[s.hint, { color: colors.textMuted }]}>No tags yet — create one below, e.g. “Daily reading” or “Karma”.</Text>
        ) : tags.map((t) => (
          <Chip key={t.id} label={(selected.includes(t.id) ? '✓ ' : '') + t.name} on={selected.includes(t.id)} color={t.color} onPress={() => toggle(t.id)} />
        ))}
      </View>
      <Text style={[s.label, { color: colors.textMuted, marginTop: 8 }]}>NEW TAG</Text>
      <View style={s.newRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={create}
          placeholder="Tag name"
          placeholderTextColor={colors.textMuted}
          style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.searchBackground }, web({ outlineColor: colors.primary })]}
        />
        <Btn label="Add" kind="primary" onPress={create} disabled={!name.trim()} />
      </View>
    </Dialog>
  );
}

export function NoteDialog({ open, initial, title, onClose, onSave }: {
  open: boolean; initial: string; title: string; onClose: () => void; onSave: (t: string) => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(initial);
  useEffect(() => { if (open) setText(initial); }, [open, initial]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`My note — ${title}`}
      width={600}
      footer={
        <>
          <Btn label="Cancel" onPress={onClose} />
          <Btn label="Save note" kind="primary" onPress={() => { onSave(text); onClose(); }} />
        </>
      }
    >
      <TextInput
        multiline
        autoFocus
        value={text}
        onChangeText={setText}
        placeholder="Write your reflection here…"
        placeholderTextColor={colors.textMuted}
        style={[s.note, { color: colors.text, borderColor: colors.border, backgroundColor: colors.searchBackground }]}
      />
    </Dialog>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: SANS, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: SANS, fontSize: 13 },
  newRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 36, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontFamily: SANS, fontSize: 14 },
  note: { minHeight: 220, borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: SANS, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' } as any,
});
