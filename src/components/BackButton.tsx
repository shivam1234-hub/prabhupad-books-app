import React from 'react';
import { Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter, useNavigation, usePathname, useGlobalSearchParams, Href } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

// Header back button for every pushed stack screen.
//
// On native, the stack draws its own back chevron. Under react-native-web it
// does not, so on web and on the desktop build the header had no way back at
// all — and desktop has no hardware back button to fall back on. This renders
// the same affordance on every platform.
/**
 * Where "back" goes when there is no history to pop: one level up the library.
 * History is empty whenever a screen is the first one loaded — the desktop app
 * reopening where you left off, a window reload (Ctrl+R), or a deep link — and
 * without this the header would have no way out at all.
 */
function parentOf(pathname: string, params: Record<string, string | string[] | undefined>): Href | null {
  const p = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const book = p('book');
  if (pathname === '/verse' && book) {
    const chapter = p('chapter');
    const canto = p('canto');
    return chapter
      ? { pathname: '/chapter', params: { book, chapter, ...(canto ? { canto } : {}) } }
      : { pathname: '/book/[slug]', params: { slug: book } };
  }
  if (pathname === '/chapter' && book) return { pathname: '/book/[slug]', params: { slug: book } };
  if (pathname.startsWith('/book/')) return '/library';
  if (pathname === '/' || pathname === '') return null;
  return '/';
}

export function BackButton() {
  const { colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  const canGoBack = navigation.canGoBack?.() ?? router.canGoBack();
  const parent = canGoBack ? null : parentOf(pathname, params);
  // Root screens (the tab bar) have nothing to go back to — render nothing
  // rather than a dead control.
  if (!canGoBack && !parent) return null;

  return (
    <Pressable
      onPress={() => (canGoBack ? router.back() : router.replace(parent!))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.searchBackground, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.icon, { color: colors.text }]}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginLeft: Platform.OS === 'ios' ? 4 : 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The chevron glyph sits high in its em box; nudge it back onto the centre.
  icon: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
    marginTop: -2,
  },
});
