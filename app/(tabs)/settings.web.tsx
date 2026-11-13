// Desktop Settings — every option of the phone's Settings screen (same store,
// same keys), laid out as a settings page with inline controls instead of
// pop-up pickers.
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore, fontSizeLabels, languageLabels } from '@/store/settingsStore';
import { scheduleDailySlokaNotification, requestNotificationPermissions } from '@/services/notifications';
import { useTourStore } from '@/components/FeatureTour';
import { Colors } from '@/constants/colors';
import { FontSize, Language } from '@/types';
import { Page, PageTitle, Card, Toggle, Segmented, Btn, Popover, ConfirmDialog, Kbd } from '@/desktop/ui';
import { THEMES, SECTION_KEYS, FontScaleStepper } from '@/desktop/HeaderMenus';
import { SANS, tints, web } from '@/desktop/theme';

type PState = { pressed: boolean; hovered?: boolean };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={[s.secTitle, { color: colors.primary }]}>{title}</Text>
      <Card style={{ overflow: 'hidden' }}>{children}</Card>
    </View>
  );
}

function Row({ label, hint, children, last }: { label: string; hint?: string; children?: React.ReactNode; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }]}>
      <View style={{ flex: 1, minWidth: 130 }}>
        <Text style={[s.label, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[s.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const TIMES = [['06:00', '6 AM'], ['08:00', '8 AM'], ['12:00', 'Noon'], ['18:00', '6 PM'], ['21:00', '9 PM']] as const;
// Short labels: five full titles don't fit the settings card on a laptop.
const SOURCES = [['all', 'All'], ['bg', 'Bhagavad-gītā'], ['sb', 'Bhāgavatam'], ['noi', 'Nectar of Instr.'], ['iso', 'Īśopaniṣad']] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = tints(colors);
  const { settings, updateSetting, resetSettings } = useSettingsStore();
  const showTour = useTourStore((st) => st.show);
  const [langOpen, setLangOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const langBtn = useRef<any>(null);
  const bridge = typeof window !== 'undefined' ? window.vedabaseDesktop : undefined;

  const arm = (time: string, enabled: boolean) => bridge?.scheduleDailySloka(time, enabled).catch(() => {});
  const toggleNotif = async (val: boolean) => {
    await updateSetting('slokaOfDayEnabled', val);
    if (!val) { arm(settings.slokaOfDayTime, false); return; }
    const granted = await requestNotificationPermissions();
    if (!granted) { await updateSetting('slokaOfDayEnabled', false); return; }
    const [h, m] = settings.slokaOfDayTime.split(':').map(Number);
    await scheduleDailySlokaNotification(h, m);
  };
  const setTime = (v: string) => { updateSetting('slokaOfDayTime', v); if (settings.slokaOfDayEnabled) arm(v, true); };

  return (
    <Page maxWidth={780}>
      <PageTitle title="Settings" subtitle="Changes apply at once and are remembered on this computer." />

      <Section title="APPEARANCE">
        <View style={s.themes}>
          {THEMES.map((th) => {
            const on = settings.themeMode === th.mode;
            const c = th.mode === 'system' ? null : Colors[th.mode];
            return (
              <Pressable
                key={th.mode}
                onPress={() => updateSetting('themeMode', th.mode)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={(st: PState) => [s.themeCard, { borderColor: on ? colors.primary : colors.border, backgroundColor: st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}
              >
                <View style={[s.preview, { borderColor: colors.border }]}>
                  {c ? (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background, padding: 8, gap: 5 }]}>
                      <View style={{ height: 8, borderRadius: 2, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }} />
                      <View style={{ width: '70%', height: 5, borderRadius: 2, backgroundColor: c.text, opacity: 0.8 }} />
                      <View style={{ width: '90%', height: 5, borderRadius: 2, backgroundColor: c.textSecondary, opacity: 0.6 }} />
                      <View style={{ width: 22, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                    </View>
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
                      <View style={{ flex: 1, backgroundColor: Colors.light.background }} />
                      <View style={{ flex: 1, backgroundColor: Colors.dark.background }} />
                    </View>
                  )}
                </View>
                <Text style={[s.themeName, { color: on ? colors.primary : colors.text }]}>{on ? '✓ ' : ''}{th.label}</Text>
                <Text style={[s.themeDesc, { color: colors.textMuted }]} numberOfLines={2}>{th.desc}</Text>
              </Pressable>
            );
          })}
        </View>
        <Row label="Reading text size" hint="Scales every book's text. Also in the Aa menu on any page.">
          <FontScaleStepper />
        </Row>
        <Row label="Base size">
          <Segmented<FontSize> value={settings.fontSize} onChange={(v) => updateSetting('fontSize', v)} options={(Object.keys(fontSizeLabels) as FontSize[]).map((k) => ({ key: k, label: fontSizeLabels[k] }))} />
        </Row>
        <Row label="Language" hint="Language of verse text fetched from vedabase.io" last>
          <View ref={langBtn}><Btn label={`${languageLabels[settings.language]}  ▾`} onPress={() => setLangOpen((o) => !o)} /></View>
        </Row>
      </Section>

      <Section title="VERSE DISPLAY">
        {SECTION_KEYS.map(({ key, label }, i) => (
          <Row key={key} label={label} hint={i === 0 ? 'Sections shown open on verse pages. Hidden ones stay one click away.' : undefined} last={i === SECTION_KEYS.length - 1}>
            <Toggle value={settings[key]} onChange={(v) => updateSetting(key, v)} label={label} />
          </Row>
        ))}
      </Section>

      <Section title="DAILY ŚLOKA">
        <Row label="Daily notification" hint="A Windows notification with the day's śloka at the time you choose (while the app is running).">
          <Toggle value={settings.slokaOfDayEnabled} onChange={toggleNotif} label="Daily notification" />
        </Row>
        {settings.slokaOfDayEnabled ? (
          <Row label="Notification time">
            <Segmented<string> value={settings.slokaOfDayTime} onChange={setTime} options={TIMES.map(([k, l]) => ({ key: k, label: l }))} />
          </Row>
        ) : null}
        <Row label="Show the verse in the notification" hint="The desktop counterpart of the phone's lock-screen verse.">
          <Toggle value={settings.lockScreenEnabled} onChange={(v) => updateSetting('lockScreenEnabled', v)} />
        </Row>
        <Row label="Source book" last>
          <Segmented<string> value={settings.slokaOfDayBook} onChange={(v) => updateSetting('slokaOfDayBook', v as any)} options={SOURCES.map(([k, l]) => ({ key: k, label: l }))} />
        </Row>
      </Section>

      <Section title="OFFLINE">
        <Row label="Offline mode" hint="Use only downloaded content">
          <Toggle value={settings.offlineMode} onChange={(v) => updateSetting('offlineMode', v)} />
        </Row>
        <Row label="Download Manager" hint="Download all or individual books for offline use" last>
          <Btn label="Open ›" onPress={() => router.push('/downloads')} />
        </Row>
      </Section>

      <Section title="ABOUT">
        <Row label="Vedabase.io" hint="Content sourced from vedabase.io">
          <Btn label="Visit ↗" kind="ghost" onPress={() => (bridge?.openExternal ? bridge.openExternal('https://vedabase.io') : window.open('https://vedabase.io', '_blank'))} />
        </Row>
        <Row label="Publisher" hint="The Bhaktivedanta Book Trust" />
        <Row label="App version"><Text style={[s.value, { color: colors.textMuted }]}>{bridge?.appVersion ?? '—'}</Text></Row>
        <Row label="Feature tour" hint="A short walk through what the app can do">
          <Btn label="Show tour" onPress={showTour} />
        </Row>
        <Row label="Keyboard shortcuts" last>
          <View style={s.keys}>
            {[['Ctrl K', 'Search'], ['Ctrl F', 'Find in page'], ['← →', 'Prev / next'], ['Alt ←', 'Back'], ['[', 'Contents'], ['Esc', 'Close']].map(([k, l]) => (
              <View key={k} style={s.key}><Kbd>{k}</Kbd><Text style={[s.keyLabel, { color: colors.textSecondary }]}>{l}</Text></View>
            ))}
          </View>
        </Row>
      </Section>

      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Btn kind="dangerGhost" label="Reset all settings" onPress={() => setConfirmReset(true)} />
      </View>

      <Popover anchor={langBtn.current} open={langOpen} onClose={() => setLangOpen(false)} width={220}>
        {(Object.keys(languageLabels) as Language[]).map((k) => (
          <Pressable key={k} onPress={() => { updateSetting('language', k); setLangOpen(false); }} style={(st: PState) => [s.menuRow, { backgroundColor: settings.language === k ? t.selected : st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}>
            <Text style={[s.menuText, { color: colors.text }]}>{languageLabels[k]}</Text>
            {settings.language === k ? <Text style={{ color: colors.primary, fontWeight: '800' }}>✓</Text> : null}
          </Pressable>
        ))}
      </Popover>
      <ConfirmDialog open={confirmReset} title="Reset all settings?" message="Theme, text size, verse sections and daily śloka go back to their defaults. Saved verses, notes and downloads are not affected." confirmLabel="Reset" destructive onConfirm={async () => {
        await resetSettings();
        // The daily notification timer lives in the main process: re-arm it
        // with the default time / on-off, or it keeps the old schedule.
        const st = useSettingsStore.getState().settings;
        arm(st.slokaOfDayTime, st.slokaOfDayEnabled);
      }} onClose={() => setConfirmReset(false)} />
    </Page>
  );
}

const s = StyleSheet.create({
  secTitle: { fontFamily: SANS, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingVertical: 14, minHeight: 56 },
  label: { fontFamily: SANS, fontSize: 14, fontWeight: '600' },
  hint: { fontFamily: SANS, fontSize: 12.5, marginTop: 2, lineHeight: 18 },
  value: { fontFamily: SANS, fontSize: 13.5 },
  themes: { flexDirection: 'row', gap: 12, padding: 16 },
  themeCard: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 8, gap: 4 },
  preview: { height: 64, borderRadius: 7, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  themeName: { fontFamily: SANS, fontSize: 13.5, fontWeight: '700', paddingHorizontal: 2 },
  themeDesc: { fontFamily: SANS, fontSize: 11.5, paddingHorizontal: 2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7 },
  menuText: { fontFamily: SANS, fontSize: 14 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, maxWidth: 420, justifyContent: 'flex-end' },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyLabel: { fontFamily: SANS, fontSize: 12.5 },
});
