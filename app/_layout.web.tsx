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
import { DesktopHeader, historyGo } from '@/desktop/DesktopHeader';
import { TooltipLayer } from '@/desktop/ui';
import { applyDesktopCss } from '@/desktop/globalCss';
import { useDesktopUi, typingInField } from '@/desktop/uiStore';
import { SANS, HEADER_H, web } from '@/desktop/theme';
import { FOCUS_PATHS } from '@/desktop/FocusBar';
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
      if (e.key === 'Backspace') { e.preventDefault(); historyGo(-1); }
    };
    // Mouse side buttons (X1 = back, X2 = forward). Windows also reports them as
    // an app-command to the main process; historyGo() ignores the duplicate.
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); historyGo(-1); }
      else if (e.button === 4) { e.preventDefault(); historyGo(1); }
    };
    // Alt+← / Alt+→ (main also forwards these; same guard applies).
    const onAltKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); historyGo(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); historyGo(1); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onAltKey);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onAltKey);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [pathname, router, focusSearch, toggleToc]);
}

/** Full-screen reading lives on verse, chapter and śloka pages; leaving them, or leaving
 *  window full screen (Esc / F11), switches it off. */
function useFocusMode() {
  const pathname = usePathname();
  const focusMode = useDesktopUi((s) => s.focusMode);
  const setFocusMode = useDesktopUi((s) => s.setFocusMode);
  const allowed = FOCUS_PATHS.includes(pathname);
  useEffect(() => { if (focusMode && !allowed) setFocusMode(false); }, [allowed, focusMode, setFocusMode]);
  // F toggles full-screen reading on the pages that have it.
  useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || typingInField()) return;
      if (document.querySelector('[data-vb-pop], [aria-modal="true"]')) return;
      e.preventDefault();
      setFocusMode(!useDesktopUi.getState().focusMode);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowed, setFocusMode]);
  useEffect(() => {
    if (!focusMode) return;
    const onFs = () => { if (!document.fullscreenElement) setFocusMode(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || typingInField()) return;
      if (document.querySelector('[data-vb-pop], [aria-modal="true"]')) return; // Esc closes the popup first
      setFocusMode(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('fullscreenchange', onFs); window.removeEventListener('keydown', onKey); };
  }, [focusMode, setFocusMode]);
  return focusMode && allowed;
}

function Shell() {
  const { colors, isDark } = useTheme();
  useEffect(() => { applyDesktopCss(colors, isDark); }, [colors, isDark]);
  useGlobalShortcuts();
  const focus = useFocusMode();
  const pathname = usePathname();
  // On reading pages the app bar hides with the page's own bar (scroll down /
  // click the page); every new page starts with the bars showing.
  const reading = pathname === '/verse' || pathname === '/chapter';
  const barsShown = useDesktopUi((s) => s.barsShown);
  const setBarsShown = useDesktopUi((s) => s.setBarsShown);
  useEffect(() => { setBarsShown(true); }, [pathname, setBarsShown]);
  const hideHeader = reading && !barsShown;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, fontFamily: SANS } as any}>
      {focus ? null : (
        <View
          style={[
            { height: HEADER_H, zIndex: 70 },
            web({ marginTop: hideHeader ? -HEADER_H : 0, transition: 'margin-top 220ms ease', pointerEvents: hideHeader ? 'none' : 'auto' }),
          ]}
        >
          <DesktopHeader />
        </View>
      )}
      <View style={{ flex: 1, minHeight: 0 }}>
        <Slot />
      </View>
      <FeatureTour />
      <TooltipLayer />
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
