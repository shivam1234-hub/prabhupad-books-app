// The desktop app bar, modelled on vedabase.io: logo on the left, the main
// sections, a search box that jumps straight to "bg 2.13"-style references or
// opens the full results page, then reader settings, theme, recent pages and
// settings.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { useHistoryStore } from '@/store/historyStore';
import { parseVerseRef, findMatchingBooks, VerseRef } from '@/utils/parseVerseRef';
import { BOOKS } from '@/constants/books';
import { SANS, SERIF, HEADER_H, tints, web, alpha } from './theme';
import { IconBtn, Popover, Kbd } from './ui';
import { useDesktopUi } from './uiStore';
import { THEMES, ThemeMenuContent, ReaderSettingsContent, HistoryMenuContent } from './HeaderMenus';

type PState = { pressed: boolean; hovered?: boolean };

const NAV = [
  { label: 'Library', path: '/library', match: (p: string) => p === '/library' || p === '/' || p.startsWith('/book') || p === '/chapter' || p === '/verse' },
  { label: 'Ślokas', path: '/slokas', match: (p: string) => p === '/slokas' || p === '/sloka' },
  { label: 'Saved', path: '/favorites', match: (p: string) => p === '/favorites' },
  { label: 'Downloads', path: '/downloads', match: (p: string) => p === '/downloads' },
];

type Suggestion =
  | { kind: 'ref'; ref: VerseRef; primary: boolean }
  | { kind: 'book'; book: (typeof BOOKS)[number] }
  | { kind: 'search'; q: string };

export function verseHref(r: { bookSlug: string; chapter: number; verse: string | number; canto?: number }) {
  return {
    pathname: '/verse' as const,
    params: { book: r.bookSlug, chapter: String(r.chapter), verse: String(r.verse), canto: r.canto !== undefined ? String(r.canto) : '' },
  };
}

function SearchBox() {
  const { colors } = useTheme();
  const t = tints(colors);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<any>(null);
  const wrap = useRef<any>(null);
  const focusTick = useDesktopUi((s) => s.searchFocus);

  useEffect(() => {
    if (focusTick === 0) return;
    input.current?.focus();
    input.current?.select?.();
  }, [focusTick]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const text = q.trim();
    if (!text) return [];
    const ref = parseVerseRef(text);
    const out: Suggestion[] = [];
    if (ref) {
      out.push({ kind: 'ref', ref, primary: true });
      for (const a of ref.alternates ?? []) out.push({ kind: 'ref', ref: a, primary: false });
    }
    if (text.length >= 2) for (const b of findMatchingBooks(text).slice(0, 4)) out.push({ kind: 'book', book: b });
    if (text.length >= 2) out.push({ kind: 'search', q: text });
    return out;
  }, [q]);

  useEffect(() => setActive(0), [q]);

  const choose = (sg: Suggestion | undefined) => {
    if (!sg) return;
    input.current?.blur();
    setFocused(false);
    if (sg.kind === 'ref') { setQ(''); router.push(verseHref(sg.ref)); }
    else if (sg.kind === 'book') { setQ(''); router.push({ pathname: '/book/[slug]', params: { slug: sg.book.slug } }); }
    else router.push({ pathname: '/search', params: { q: sg.q } });
  };

  const onKey = (e: any) => {
    const k = e.nativeEvent?.key ?? e.key;
    if (k === 'ArrowDown') { e.preventDefault?.(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
    else if (k === 'ArrowUp') { e.preventDefault?.(); setActive((a) => Math.max(a - 1, 0)); }
    else if (k === 'Escape') { setQ(''); input.current?.blur(); setFocused(false); }
  };

  const open = focused && q.trim().length > 0;

  return (
    <View ref={wrap} style={s.searchWrap}>
      <View
        style={[
          s.search,
          { backgroundColor: colors.searchBackground, borderColor: focused ? colors.primary : 'transparent' },
          focused && web({ boxShadow: `0 0 0 3px ${alpha(colors.primary, 0.18)}` }),
          web({ transition: 'border-color 120ms, box-shadow 120ms' }),
        ]}
      >
        <Text style={[s.searchIcon, { color: colors.textMuted }]}>⌕</Text>
        <TextInput
          ref={input}
          value={q}
          onChangeText={setQ}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyPress={onKey}
          onSubmitEditing={() => choose(suggestions[active] ?? (q.trim() ? { kind: 'search', q: q.trim() } : undefined))}
          placeholder='Search — “bg 2.13”, “sb 1.2.6”, “yoga”…'
          placeholderTextColor={colors.textMuted}
          style={[s.searchInput, { color: colors.text }, web({ outlineStyle: 'none' })]}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search the library"
        />
        {q ? (
          <IconBtn icon="✕" tip="Clear" size={24} onPress={() => setQ('')} />
        ) : (
          <Kbd>Ctrl K</Kbd>
        )}
      </View>
      {open && suggestions.length > 0 ? (
        <View
          dataSet={{ vbPop: '1' }}
          style={[s.suggest, { backgroundColor: colors.surface, borderColor: colors.border }, web({ boxShadow: t.shadowLg })]}
        >
          {suggestions.map((sg, i) => {
            const on = i === active;
            const book = sg.kind === 'ref' ? BOOKS.find((b) => b.slug === sg.ref.bookSlug) : sg.kind === 'book' ? sg.book : undefined;
            return (
              <Pressable
                key={i}
                onPress={() => choose(sg)}
                onHoverIn={() => setActive(i)}
                style={[s.sgRow, { backgroundColor: on ? t.selected : 'transparent' }, web({ cursor: 'pointer' })]}
              >
                <View style={[s.sgIcon, { backgroundColor: book?.coverColor ?? colors.primary }]}>
                  <Text style={s.sgIconText}>{sg.kind === 'ref' ? '§' : sg.kind === 'book' ? '📖' : '⌕'}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.sgTitle, { color: colors.text }]} numberOfLines={1}>
                    {sg.kind === 'ref' ? sg.ref.label : sg.kind === 'book' ? sg.book.title : `Search for “${sg.q}”`}
                  </Text>
                  <Text style={[s.sgSub, { color: colors.textMuted }]} numberOfLines={1}>
                    {sg.kind === 'ref'
                      ? (sg.primary ? 'Go to verse' : 'Also could mean')
                      : sg.kind === 'book' ? (sg.book.subtitle || 'Open book')
                        : 'Full-text search in your downloaded books'}
                  </Text>
                </View>
                {on ? <Text style={[s.sgEnter, { color: colors.textMuted }]}>↵</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function DesktopHeader() {
  const { colors } = useTheme();
  const t = tints(colors);
  const router = useRouter();
  const pathname = usePathname();
  const themeMode = useSettingsStore((st) => st.settings.themeMode);
  const historyCount = useHistoryStore((st) => st.entries.length);
  const readerTick = useDesktopUi((st) => st.readerSettings);
  const [menu, setMenu] = useState<null | 'reader' | 'theme' | 'history'>(null);
  const anchors = useRef<Record<string, any>>({});
  const close = () => setMenu(null);
  useEffect(() => { if (readerTick) setMenu('reader'); }, [readerTick]);
  const { width } = useWindowDimensions();
  const compact = width < 1240;
  const themeIcon = THEMES.find((th) => th.mode === themeMode)?.icon ?? '◐';

  return (
    <View style={[s.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => router.push('/library')}
        style={[s.logo, compact && { marginRight: 6 }, web({ cursor: 'pointer' })]}
        accessibilityRole="link"
        accessibilityLabel="Vedabase library home"
      >
        <Image source={require('../../assets/icon.png')} style={s.logoImg} />
        <View>
          <Text style={[s.logoText, { color: colors.text }]}>Vedabase</Text>
          {!compact ? <Text style={[s.logoSub, { color: colors.textMuted }]}>Śrīla Prabhupāda's books</Text> : null}
        </View>
      </Pressable>

      <View style={s.nav} accessibilityRole={'navigation' as any}>
        {NAV.map((n) => {
          const on = n.match(pathname);
          return (
            <Pressable
              key={n.path}
              onPress={() => router.push(n.path as any)}
              accessibilityRole="link"
              accessibilityState={{ selected: on }}
              style={(st: PState) => [s.navItem, { backgroundColor: st.hovered && !on ? t.hover : 'transparent' }, web({ cursor: 'pointer', transition: 'background-color 120ms' })]}
            >
              <Text style={[s.navText, { color: on ? colors.primary : colors.textSecondary }]}>{n.label}</Text>
              <View style={[s.navLine, { backgroundColor: on ? colors.primary : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <SearchBox />

      <View style={s.actions}>
        <View ref={(el) => { anchors.current.reader = el; }}>
          <IconBtn
            icon={<Text style={{ fontFamily: SERIF, color: menu === 'reader' ? colors.primary : colors.textSecondary, fontSize: 17, fontWeight: '600' }}>A<Text style={{ fontSize: 13 }}>a</Text></Text>}
            tip="Reading settings — text size and verse sections"
            active={menu === 'reader'}
            onPress={() => setMenu(menu === 'reader' ? null : 'reader')}
          />
        </View>
        <View ref={(el) => { anchors.current.theme = el; }}>
          <IconBtn icon={themeIcon} tip="Theme" active={menu === 'theme'} onPress={() => setMenu(menu === 'theme' ? null : 'theme')} />
        </View>
        <View ref={(el) => { anchors.current.history = el; }}>
          <IconBtn icon="⏱" tip="Recent pages" badge={historyCount} active={menu === 'history'} onPress={() => setMenu(menu === 'history' ? null : 'history')} />
        </View>
        <IconBtn icon="⚙" tip="Settings" active={pathname === '/settings'} onPress={() => router.push('/settings')} />
      </View>

      <Popover anchor={anchors.current.reader} open={menu === 'reader'} onClose={close} width={300}>
        <ReaderSettingsContent />
      </Popover>
      <Popover anchor={anchors.current.theme} open={menu === 'theme'} onClose={close} width={290}>
        <ThemeMenuContent onPicked={close} />
      </Popover>
      <Popover anchor={anchors.current.history} open={menu === 'history'} onClose={close} width={380}>
        <HistoryMenuContent onClose={close} />
      </Popover>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    height: HEADER_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 50,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 18 },
  logoImg: { width: 34, height: 34, borderRadius: 8 },
  logoText: { fontFamily: SERIF, fontSize: 19, fontWeight: '700', letterSpacing: 0.2, lineHeight: 22 },
  logoSub: { fontFamily: SERIF, fontSize: 11, fontStyle: 'italic', lineHeight: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navItem: { height: 38, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  navText: { fontFamily: SANS, fontSize: 14, fontWeight: '600' },
  navLine: { position: 'absolute', bottom: -11, left: 12, right: 12, height: 2.5, borderRadius: 2 },
  searchWrap: { width: 400, flexShrink: 1, minWidth: 220 },
  search: { flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 10, borderWidth: 1.5, paddingLeft: 12, paddingRight: 8, gap: 8 },
  searchIcon: { fontSize: 18, marginTop: -2 },
  searchInput: { flex: 1, fontFamily: SANS, fontSize: 14, height: 34 },
  suggest: { position: 'absolute', top: 44, left: 0, right: 0, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 6, zIndex: 100 },
  sgRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8 },
  sgIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  sgIconText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  sgTitle: { fontFamily: SANS, fontSize: 13.5, fontWeight: '600' },
  sgSub: { fontFamily: SANS, fontSize: 11.5, marginTop: 1 },
  sgEnter: { fontSize: 14, paddingHorizontal: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 10 },
});
