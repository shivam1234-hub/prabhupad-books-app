// The header's dropdowns: reader settings (text size + verse sections), theme
// and recent pages. Same settings and stores as the phone's header buttons.
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Colors } from '@/constants/colors';
import {
  useSettingsStore, clampFontScale, FONT_SCALE_STEP, FONT_SCALE_MIN, FONT_SCALE_MAX, fontSizeLabels,
} from '@/store/settingsStore';
import { useHistoryStore, HistoryEntry } from '@/store/historyStore';
import { ThemeMode, FontSize } from '@/types';
import { SANS, SERIF, tints, web } from './theme';
import { Toggle, Segmented, IconBtn } from './ui';

type PState = { pressed: boolean; hovered?: boolean };

export const THEMES: { mode: ThemeMode; icon: string; label: string; desc: string }[] = [
  { mode: 'system', icon: '◐', label: 'System', desc: 'Follows Windows light / dark' },
  { mode: 'light', icon: '☀', label: 'Light', desc: 'Cream parchment, saffron accents' },
  { mode: 'dark', icon: '☾', label: 'Dark', desc: 'Warm brown-black, easy at night' },
  { mode: 'vedabase', icon: '🪔', label: 'Vedabase', desc: 'Classic vedabase.io look' },
];

export const SECTION_KEYS = [
  { key: 'showDevanagari', label: 'Devanāgarī' },
  { key: 'showTransliteration', label: 'Verse text' },
  { key: 'showSynonyms', label: 'Synonyms' },
  { key: 'showTranslation', label: 'Translation' },
  { key: 'showPurport', label: 'Purport' },
] as const;

function MenuTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[s.menuTitle, { color: colors.textMuted }]}>{children}</Text>;
}

export function ThemeMenuContent({ onPicked }: { onPicked?: () => void }) {
  const { colors } = useTheme();
  const t = tints(colors);
  const mode = useSettingsStore((st) => st.settings.themeMode);
  const update = useSettingsStore((st) => st.updateSetting);
  return (
    <View>
      <MenuTitle>THEME</MenuTitle>
      {THEMES.map((th) => {
        const on = th.mode === mode;
        const sw = th.mode === 'system' ? [Colors.light.background, Colors.dark.background] : [Colors[th.mode].background, Colors[th.mode].primary];
        return (
          <Pressable
            key={th.mode}
            onPress={() => { update('themeMode', th.mode); onPicked?.(); }}
            style={(st: PState) => [s.menuRow, { backgroundColor: on ? t.selected : st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}
          >
            <View style={[s.swatch, { backgroundColor: sw[0], borderColor: colors.border }]}>
              <View style={[s.swatchDot, { backgroundColor: sw[1] }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: colors.text }]}>{th.label}</Text>
              <Text style={[s.rowDesc, { color: colors.textMuted }]}>{th.desc}</Text>
            </View>
            {on ? <Text style={[s.check, { color: colors.primary }]}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A−  100%  A+ stepper for the global reading scale. */
export function FontScaleStepper() {
  const { colors } = useTheme();
  const scale = useSettingsStore((st) => st.settings.fontScale ?? 1);
  const update = useSettingsStore((st) => st.updateSetting);
  const set = (v: number) => update('fontScale', clampFontScale(v));
  return (
    <View style={[s.stepper, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
      <IconBtn icon={<Text style={{ fontFamily: SERIF, fontSize: 14, color: colors.text }}>A</Text>} tip="Smaller text (Ctrl −)" onPress={() => set(scale - FONT_SCALE_STEP)} disabled={scale <= FONT_SCALE_MIN + 1e-6} size={32} />
      <Pressable onPress={() => set(1)} style={[s.stepVal, web({ cursor: 'pointer' })]} accessibilityLabel="Reset text size">
        <Text style={[s.stepValText, { color: colors.primary }]}>{Math.round(scale * 100)}%</Text>
      </Pressable>
      <IconBtn icon={<Text style={{ fontFamily: SERIF, fontSize: 20, color: colors.text }}>A</Text>} tip="Larger text (Ctrl +)" onPress={() => set(scale + FONT_SCALE_STEP)} disabled={scale >= FONT_SCALE_MAX - 1e-6} size={32} />
    </View>
  );
}

/** Reader settings: text size, base size, verse sections. */
export function ReaderSettingsContent() {
  const { colors } = useTheme();
  const settings = useSettingsStore((st) => st.settings);
  const update = useSettingsStore((st) => st.updateSetting);
  return (
    <View style={{ padding: 6, gap: 6 }}>
      <MenuTitle>TEXT SIZE</MenuTitle>
      <View style={{ alignItems: 'center' }}><FontScaleStepper /></View>
      <Segmented<FontSize>
        value={settings.fontSize}
        onChange={(v) => update('fontSize', v)}
        options={(Object.keys(fontSizeLabels) as FontSize[]).map((k) => ({ key: k, label: k === 'xlarge' ? 'XL' : fontSizeLabels[k] }))}
        style={{ alignSelf: 'stretch', marginTop: 4 }}
      />
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <MenuTitle>SHOW ON VERSE PAGES</MenuTitle>
      {SECTION_KEYS.map(({ key, label }) => (
        <View key={key} style={s.toggleRow}>
          <Text style={[s.rowLabel, { color: colors.text, fontWeight: '500' }]}>{label}</Text>
          <Toggle value={settings[key]} onChange={(v) => update(key, v)} label={label} />
        </View>
      ))}
    </View>
  );
}

function relTime(ts: number) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'just now';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const KIND_ICON = { book: '📖', chapter: '📑', verse: '📜' } as const;

export function HistoryMenuContent({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const t = tints(colors);
  const router = useRouter();
  const entries = useHistoryStore((st) => st.entries);
  const scroll = useHistoryStore((st) => st.scrollPositions);
  const remove = useHistoryStore((st) => st.removeEntry);
  const clear = useHistoryStore((st) => st.clear);
  const open = (e: HistoryEntry) => { onClose(); router.push({ pathname: e.pathname as any, params: e.params }); };
  return (
    <View>
      <View style={s.histHead}>
        <View style={{ flex: 1 }}>
          <Text style={[s.histTitle, { color: colors.text }]}>Recent pages</Text>
          <Text style={[s.rowDesc, { color: colors.textMuted }]}>Scroll position is remembered</Text>
        </View>
        {entries.length > 0 ? (
          <Pressable onPress={clear} style={(st: PState) => [s.clearBtn, { borderColor: colors.border, backgroundColor: st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}>
            <Text style={[s.clearText, { color: colors.textSecondary }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {entries.length === 0 ? (
        <Text style={[s.histEmpty, { color: colors.textMuted }]}>Pages you open show up here so you can hop back with one click.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 440 }}>
          {entries.map((e) => (
            <Pressable
              key={e.key}
              onPress={() => open(e)}
              style={(st: PState) => [s.histRow, { backgroundColor: st.hovered ? t.hover : 'transparent' }, web({ cursor: 'pointer' })]}
            >
              {(st: PState) => (
                <>
                  <Text style={s.histIcon}>{KIND_ICON[e.kind]}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.rowLabel, { color: colors.text }]} numberOfLines={1}>{e.title}</Text>
                    <Text style={[s.rowDesc, { color: colors.textMuted }]} numberOfLines={1}>
                      {e.subtitle ? `${e.subtitle} · ` : ''}{relTime(e.visitedAt)}
                      {(scroll[e.key] ?? 0) > 8 ? <Text style={{ color: colors.primary }}>{' · resume position'}</Text> : null}
                    </Text>
                  </View>
                  <View style={{ opacity: st.hovered ? 1 : 0 }}>
                    <IconBtn icon="✕" tip="Remove from recent" size={26} onPress={() => remove(e.key)} />
                  </View>
                </>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  menuTitle: { fontFamily: SANS, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6, marginLeft: 6, marginTop: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8 },
  swatch: { width: 30, height: 30, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatchDot: { width: 12, height: 12, borderRadius: 6 },
  rowLabel: { fontFamily: SANS, fontSize: 13.5, fontWeight: '600' },
  rowDesc: { fontFamily: SANS, fontSize: 11.5, marginTop: 1 },
  check: { fontSize: 15, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 2, gap: 4 },
  stepVal: { minWidth: 64, alignItems: 'center' },
  stepValText: { fontFamily: SANS, fontSize: 14, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 5 },
  histHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 },
  histTitle: { fontFamily: SANS, fontSize: 15, fontWeight: '700' },
  clearBtn: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 4 },
  clearText: { fontFamily: SANS, fontSize: 12, fontWeight: '600' },
  histEmpty: { fontFamily: SANS, fontSize: 13, lineHeight: 19, padding: 12, textAlign: 'center' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8 },
  histIcon: { fontSize: 16, width: 22, textAlign: 'center' },
});
