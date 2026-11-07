import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HistoryButton } from './HistoryButton';
import { ThemeButton } from './ThemeButton';
import { TextSizeButton } from './TextSizeButton';
// The header's right-hand controls, on every platform: text size and theme
// dropdowns plus history. Search lives in the bottom floating bar (and the
// verse page's Search pill), so it no longer has a header icon.
export function HeaderActions() {
  return (
    <View style={styles.row}>
      <TextSizeButton />
      <ThemeButton />
      <HistoryButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
