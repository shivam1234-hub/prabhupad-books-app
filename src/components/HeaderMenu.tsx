import React from 'react';
import { Modal, Pressable, View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

// A small dropdown card that hangs under the header's right-hand controls.
// Tapping anywhere outside it closes it.
export function HeaderMenu({ visible, onClose, children, width = 230 }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const top = insets.top + (Platform.OS === 'ios' ? 48 : 56);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.card, { top, width, backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.12)' },
  card: {
    position: 'absolute', right: 10,
    borderWidth: 1, borderRadius: 14, padding: 8,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
