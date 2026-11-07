import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

// expo-router renders this for any unmatched route. The file existing but
// exporting nothing makes the router resolve the screen to `undefined`, which
// throws during render and blanks the ENTIRE app — not just the 404 path — so
// this default export must always be present.
export default function NotFoundScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Not Found' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.emoji}>🪷</Text>
        <Text style={[styles.title, { color: colors.text }]}>Page not found</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This verse or page isn’t available. It may have moved, or the reference may be incorrect.
        </Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.textInverse }]}>
            {router.canGoBack() ? 'Go Back' : 'Go to Library'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 44,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 28,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
