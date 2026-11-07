import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, FlatList, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useHistoryStore, HistoryEntry, HistoryKind } from '@/store/historyStore';

const KIND_ICON: Record<HistoryKind, string> = {
  book: '📖',
  chapter: '📑',
  verse: '📜',
};

// Header button shown in every stack screen. Tapping opens the recent-pages
// panel; badge shows how many pages the user can jump back to.
export function HistoryButton() {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const count = useHistoryStore((s) => s.entries.length);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.searchBackground, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.btnIcon, { color: colors.text }]}>⏱</Text>
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </Pressable>

      <HistoryPanel visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function HistoryPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entries = useHistoryStore((s) => s.entries);
  const scrollPositions = useHistoryStore((s) => s.scrollPositions);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const clear = useHistoryStore((s) => s.clear);

  const openEntry = (e: HistoryEntry) => {
    onClose();
    // push (not replace) so the user can still use system back — the destination
    // screen will read the saved scroll position from the store on mount.
    router.push({ pathname: e.pathname as any, params: e.params });
  };

  const relTime = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Recent pages</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Jump back to where you left off — scroll position is remembered
              </Text>
            </View>
            {entries.length > 0 && (
              <Pressable
                onPress={clear}
                hitSlop={8}
                style={[styles.clearBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>Clear</Text>
              </Pressable>
            )}
          </View>

          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⏱</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Pages you open will show up here so you can hop back with one tap.
              </Text>
            </View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(e) => e.key}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const hasSavedScroll = (scrollPositions[item.key] ?? 0) > 8;
                return (
                  <Pressable
                    onPress={() => openEntry(item)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: colors.searchBackground }]}>
                      <Text style={styles.iconText}>{KIND_ICON[item.kind]}</Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text
                          style={[styles.rowSub, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {item.subtitle}
                        </Text>
                      ) : null}
                      <View style={styles.rowMeta}>
                        <Text style={[styles.rowMetaText, { color: colors.textMuted }]}>
                          {relTime(item.visitedAt)}
                        </Text>
                        {hasSavedScroll && (
                          <>
                            <Text style={[styles.dot, { color: colors.textMuted }]}>·</Text>
                            <Text style={[styles.rowMetaText, { color: colors.primary }]}>
                              resume position
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <Pressable
                      onPress={() => removeEntry(item.key)}
                      hitSlop={12}
                      style={styles.removeBtn}
                    >
                      <Text style={[styles.removeBtnText, { color: colors.textMuted }]}>✕</Text>
                    </Pressable>
                  </Pressable>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginRight: Platform.OS === 'ios' ? 4 : 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: { fontSize: 16, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 6,
    paddingHorizontal: 16,
    maxHeight: '82%',
    minHeight: '40%',
  },
  handle: { alignItems: 'center', paddingVertical: 6 },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  clearBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearBtnText: { fontSize: 12, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { fontSize: 44 },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },

  list: { paddingBottom: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, lineHeight: 16 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowMetaText: { fontSize: 11, fontWeight: '600' },
  dot: { fontSize: 11 },
  removeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  removeBtnText: { fontSize: 15, fontWeight: '700' },
});
