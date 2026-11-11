// Desktop (Electron / web) shell. The phone keeps app/_layout.tsx with its
// stack headers and floating search bar; on a wide window the app instead gets
// a vedabase.io-style app bar on top and full-width pages underneath. Same
// stores, same start-up work.
import React, { useEffect } from 'react';
import { Slot, useRouter, usePathname } from 'expo-router';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useHistoryStore } from '@/store/historyStore';
import { registerBackgroundTask } from '@/services/notifications';
import { resumeInterruptedDownloads, registerDownloadBackgroundTask } from '@/services/downloadManager';
import { useTheme } from '@/hooks/useTheme';
import { FeatureTour } from '@/components/FeatureTour';
import { installWebAlert } from '@/utils/webAlert';
import { DesktopHeader } from '@/desktop/DesktopHeader';
import { applyDesktopCss } from '@/desktop/globalCss';
import { useDesktopUi, typingInField } from '@/desktop/uiStore';
import { SANS } from '@/desktop/theme';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();
installWebAlert();

const queryClient = new QueryClient();

function useGlobalShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const focusSearch = useDesktopUi((s) => s.focusSearch);
  const toggleToc = useDesktopUi((s) => s.toggleToc);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      // Ctrl+K anywhere; Ctrl+F too, except on verse pages, which own Ctrl+F
      // for find-in-page.
      if (mod && (k === 'k' || (k === 'f' && pathname !== '/verse'))) {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (typingInField() || mod || e.altKey) return;
      if (e.key === '[' && (pathname === '/verse' || pathname === '/chapter')) { e.preventDefault(); toggleToc(); return; }
      if (e.key === 'Backspace' && router.canGoBack()) { e.preventDefault(); router.back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname, router, focusSearch, toggleToc]);
}

function Shell() {
  const { colors, isDark } = useTheme();
  useEffect(() => { applyDesktopCss(colors, isDark); }, [colors, isDark]);
  useGlobalShortcuts();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, fontFamily: SANS } as any}>
      <DesktopHeader />
      <View style={{ flex: 1, minHeight: 0 }}>
        <Slot />
      </View>
      <FeatureTour />
    </View>
  );
}

export default function Layout() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadFavorites = useFavoritesStore((s) => s.load);
  const loadHistory = useHistoryStore((s) => s.load);

  useEffect(() => {
    (async () => {
      try {
        await loadSettings();
        await loadFavorites();
        await loadHistory();
        await registerBackgroundTask();
        await registerDownloadBackgroundTask();
        resumeInterruptedDownloads().catch(() => {});
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        SplashScreen.hideAsync();
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Shell />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
