import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useHistoryStore } from '@/store/historyStore';
import { registerBackgroundTask } from '@/services/notifications';
import {
  resumeInterruptedDownloads,
  registerDownloadBackgroundTask,
} from '@/services/downloadManager';
import { useTheme } from '@/hooks/useTheme';
import { FloatingSearch } from '@/components/FloatingSearch';
import { HeaderActions } from '@/components/HeaderActions';
import { BackButton } from '@/components/BackButton';
import { FeatureTour } from '@/components/FeatureTour';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNav() {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          // react-native-web's stack draws no back chevron, so supply one on
          // every platform; it hides itself on screens with nothing to pop.
          headerLeft: () => <BackButton />,
          headerRight: () => <HeaderActions />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="book/[slug]"
          options={{ headerTitle: 'Book', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="chapter"
          options={{ headerTitle: 'Chapter', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="verse"
          options={{ headerTitle: 'Verse', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="sloka"
          options={{ headerTitle: 'Śloka', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="downloads"
          options={{ headerTitle: 'Download Manager', headerBackTitle: '' }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <FloatingSearch />
      <FeatureTour />
    </View>
  );
}

export default function Layout() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadFavorites = useFavoritesStore((s) => s.load);
  const loadHistory = useHistoryStore((s) => s.load);

  useEffect(() => {
    async function init() {
      try {
        await loadSettings();
        await loadFavorites();
        await loadHistory();
        await registerBackgroundTask();
        await registerDownloadBackgroundTask();
        // Pick up any download interrupted by the app closing.
        resumeInterruptedDownloads().catch(() => {});
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <RootNav />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
