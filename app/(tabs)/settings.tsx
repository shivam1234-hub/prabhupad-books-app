import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore, fontSizeLabels } from '@/store/settingsStore';
import { FontSize, ThemeMode, TranslateLang } from '@/types';
import { isTranslationAvailable, languageName } from '@/services/translate';
import { TranslateLanguageSheet } from '@/components/TranslateLanguageSheet';
import { scheduleDailySlokaNotification, requestNotificationPermissions } from '@/services/notifications';

function Row({ label, right, onPress, muted }: {
  label: string; right?: React.ReactNode; onPress?: () => void; muted?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.row, { borderBottomColor: colors.borderLight }]} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {muted ? <Text style={[styles.rowMuted, { color: colors.textMuted }]}>{muted}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function PickerRow({ label, value, options, onSelect }: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Row
      label={label}
      right={<Text style={[styles.rowValue, { color: colors.primary }]}>{options.find(o => o.value === value)?.label}</Text>}
      onPress={() => Alert.alert(
        label,
        '',
        [
          ...options.map(o => ({
            text: o.value === value ? `✓ ${o.label}` : o.label,
            onPress: () => onSelect(o.value),
          })),
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      )}
    />
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, updateSetting, resetSettings } = useSettingsStore();
  const [pickLang, setPickLang] = useState(false);

  const handleSlokaTime = () => {
    Alert.alert('Notification Time', 'Choose a time for your daily sloka notification', [
      { text: '6:00 AM', onPress: () => updateSetting('slokaOfDayTime', '06:00') },
      { text: '8:00 AM', onPress: () => updateSetting('slokaOfDayTime', '08:00') },
      { text: '12:00 PM', onPress: () => updateSetting('slokaOfDayTime', '12:00') },
      { text: '6:00 PM', onPress: () => updateSetting('slokaOfDayTime', '18:00') },
      { text: '9:00 PM', onPress: () => updateSetting('slokaOfDayTime', '21:00') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleToggleNotif = async (val: boolean) => {
    await updateSetting('slokaOfDayEnabled', val);
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in your device settings.');
        await updateSetting('slokaOfDayEnabled', false);
        return;
      }
      const [h, m] = settings.slokaOfDayTime.split(':').map(Number);
      await scheduleDailySlokaNotification(h, m);
    }
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Section title="APPEARANCE">
        <PickerRow
          label="Theme"
          value={settings.themeMode}
          options={[
            { label: '☀️ Light', value: 'light' },
            { label: '🌙 Dark', value: 'dark' },
            { label: '🪔 Vedabase', value: 'vedabase' },
            { label: '🔄 System', value: 'system' },
          ]}
          onSelect={(v) => updateSetting('themeMode', v as ThemeMode)}
        />
        <PickerRow
          label="Text Size"
          value={settings.fontSize}
          options={Object.entries(fontSizeLabels).map(([v, label]) => ({ value: v, label }))}
          onSelect={(v) => updateSetting('fontSize', v as FontSize)}
        />
        {/* The books are read in Śrīla Prabhupāda's English; this machine-
            translates the translation and purport (🌐 on a verse). */}
        {isTranslationAvailable() && (
          <Row
            label="Translate verses into"
            muted="Machine translation, not BBT’s"
            right={
              <Text style={[styles.rowValue, { color: colors.primary }]}>
                {settings.translateLang ? languageName(settings.translateLang).native : 'Choose'}
              </Text>
            }
            onPress={() => setPickLang(true)}
          />
        )}
        <TranslateLanguageSheet
          visible={pickLang}
          current={settings.translateLang}
          onSelect={(v: TranslateLang) => { setPickLang(false); updateSetting('translateLang', v); }}
          onClose={() => setPickLang(false)}
        />
      </Section>

      <Section title="VERSE DISPLAY">
        {[
          { key: 'showDevanagari', label: 'Sanskrit Text', icon: '🔤' },
          { key: 'showTransliteration', label: 'Transliteration', icon: '🔡' },
          { key: 'showSynonyms', label: 'Word-for-Word', icon: '📖' },
          { key: 'showTranslation', label: 'Translation', icon: '💬' },
          { key: 'showPurport', label: 'Purport', icon: '📝' },
        ].map(({ key, label, icon }) => (
          <Row
            key={key}
            label={`${icon} ${label}`}
            right={
              <Switch
                value={(settings as any)[key]}
                onValueChange={(v) => updateSetting(key as any, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFF"
              />
            }
          />
        ))}
      </Section>

      <Section title="DAILY SLOKA">
        <Row
          label="🔔 Daily Notification"
          right={
            <Switch
              value={settings.slokaOfDayEnabled}
              onValueChange={handleToggleNotif}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          }
        />
        {settings.slokaOfDayEnabled && (
          <Row
            label="⏰ Notification Time"
            right={<Text style={[styles.rowValue, { color: colors.primary }]}>{settings.slokaOfDayTime}</Text>}
            onPress={handleSlokaTime}
          />
        )}
        <Row
          label="📱 Lock Screen Verse"
          muted="Show verse in notification on lock screen"
          right={
            <Switch
              value={settings.lockScreenEnabled}
              onValueChange={(v) => updateSetting('lockScreenEnabled', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          }
        />
        <PickerRow
          label="📚 Source Book"
          value={settings.slokaOfDayBook}
          options={[
            { label: 'All Books', value: 'all' },
            { label: 'Bhagavad-gīta', value: 'bg' },
            { label: 'Śrīmad-Bhāgavatam', value: 'sb' },
            { label: 'Nectar of Instruction', value: 'noi' },
            { label: 'Śrī Īśopaniṣad', value: 'iso' },
          ]}
          onSelect={(v) => updateSetting('slokaOfDayBook', v as any)}
        />
      </Section>

      <Section title="OFFLINE">
        <Row
          label="📥 Offline Mode"
          muted="Use only downloaded content"
          right={
            <Switch
              value={settings.offlineMode}
              onValueChange={(v) => updateSetting('offlineMode', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          }
        />
        <Row
          label="📦 Download Manager"
          muted="Download all or individual books for offline use"
          onPress={() => router.push('/downloads' as any)}
          right={<Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>}
        />
      </Section>

      <Section title="ABOUT">
        <Row label="📖 Vedabase.io" muted="Content sourced from vedabase.io" />
        <Row label="🏛 Publisher" muted="Bhaktivedanta Book Trust" />
        <Row label="ℹ️ App Version" right={<Text style={[styles.rowValue, { color: colors.textMuted }]}>1.0.0</Text>} />
      </Section>

      <Pressable
        style={[styles.resetBtn, { borderColor: colors.error }]}
        onPress={() => Alert.alert('Reset Settings', 'Reset all settings to defaults?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: resetSettings },
        ])}
      >
        <Text style={[styles.resetBtnText, { color: colors.error }]}>Reset All Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 60 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginLeft: 4 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15 },
  rowMuted: { fontSize: 12 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  chevron: { fontSize: 20 },
  resetBtn: {
    borderRadius: 12, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '700' },
});
