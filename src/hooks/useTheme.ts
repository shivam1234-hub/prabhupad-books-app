import { useColorScheme } from 'react-native';
import { Colors, ColorScheme } from '@/constants/colors';
import { useSettingsStore } from '@/store/settingsStore';

export function useTheme(): { colors: ColorScheme; isDark: boolean } {
  const systemScheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.settings.themeMode);

  // 'vedabase' is a light theme in its own right — it never follows the
  // system scheme and never counts as dark.
  if (themeMode === 'vedabase') {
    return { colors: Colors.vedabase, isDark: false };
  }

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemScheme === 'dark');

  return { colors: isDark ? Colors.dark : Colors.light, isDark };
}
