import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { HeaderActions } from '@/components/HeaderActions';

function TabIcon({ label, focused, emoji }: { label: string; focused: boolean; emoji: string }) {
  const { colors } = useTheme();
  return (
    <View style={[tabStyles.iconWrap, focused && { opacity: 1 }]}>
      <Text style={[tabStyles.emoji, { opacity: focused ? 1 : 0.5 }]}>{emoji}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  emoji: {
    fontSize: 22,
  },
});

// The Today tab is hidden on every platform. Hidden rather than deleted: the
// route still exists and redirects to the Library, so deep links and the
// daily-sloka notification keep working.
export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 82 : 62,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 1,
        },
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerStyle: {
          backgroundColor: colors.surface,
          shadowOpacity: 0,
          elevation: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 16, letterSpacing: 0.2, color: colors.text },
        headerShadowVisible: false,
        // The tab screens render their own header, so the theme / history
        // controls have to be attached here as well as on the root stack.
        headerRight: () => <HeaderActions />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          href: null,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🪷" label="Today" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          headerTitle: 'Library',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" label="Library" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Saved',
          headerTitle: 'Saved',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔖" label="Saved" focused={focused} />,
        }}
      />
      {/* Settings is hidden from the tab bar (href: null) — the screen/route is
          kept so its logic and the settings store stay intact and it can be
          restored later. Downloads now live in the Library tab. */}
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
    </Tabs>
  );
}
