import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl,
  ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Redirect } from 'expo-router';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchVerse } from '@/services/vedabaseApi';
import { pickDailySloka } from '@/services/notifications';
import { BOOKS } from '@/constants/books';
import { Verse } from '@/types';
import { VerseWallpaperView } from '@/components/VerseWallpaperView';

// The Today tab is hidden (see (tabs)/_layout.tsx), but "/" still resolves to
// this route, so it forwards to the Library. Kept as a redirect rather than
// deleted so deep links and the daily-sloka notification still land somewhere.
export default function HomeScreen() {
  return <Redirect href="/(tabs)/library" />;
}

// The Today screen itself — currently unreachable, kept intact so the tab can
// be restored by exporting this as the default again.
function TodayScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();
  const themeMode = useSettingsStore((st) => st.settings.themeMode);
  const updateSetting = useSettingsStore((st) => st.updateSetting);

  const vedabaseTheme = themeMode === 'vedabase';
  // Tapping the lamp switches to the vedabase.io light theme; tapping it again
  // hands control back to the system scheme.
  const toggleVedabaseTheme = () =>
    updateSetting('themeMode', vedabaseTheme ? 'system' : 'vedabase');

  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verseRef, setVerseRef] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [purportExpanded, setPurportExpanded] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);

  const loadDailySloka = useCallback(async () => {
    try {
      const sloka = await pickDailySloka();
      if (!sloka) return;
      const v = await fetchVerse(sloka.bookSlug, sloka.chapter, sloka.verse, sloka.canto);
      if (v) {
        setVerse(v);
        const book = BOOKS.find(b => b.slug === sloka.bookSlug);
        setBookTitle(book?.title ?? '');
        setVerseRef(
          sloka.canto
            ? `${sloka.canto}.${sloka.chapter}.${sloka.verse}`
            : `${sloka.chapter}.${sloka.verse}`
        );
      }
    } catch {}
  }, []);

  // Reload whenever Home regains focus so a verse set from the verse screen
  // ("Set as Today's Verse") shows immediately. Spinner only on first load;
  // later focuses refresh silently.
  const firstLoad = useRef(true);
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (firstLoad.current) setLoading(true);
        await loadDailySloka();
        if (firstLoad.current) { setLoading(false); firstLoad.current = false; }
      })();
    }, [loadDailySloka])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDailySloka();
    setRefreshing(false);
  };

  const openVerse = () => {
    if (!verse) return;
    router.push({
      pathname: '/verse',
      params: {
        book: verse.bookSlug,
        chapter: String(verse.chapter),
        verse: String(verse.verse),
        canto: verse.canto !== undefined ? String(verse.canto) : '',
      },
    });
  };

  const toggleFavorite = () => {
    if (!verse) return;
    if (isFavorite(verse.id)) {
      removeFavorite(verse.id);
    } else {
      addFavorite({ verseId: verse.id, bookSlug: verse.bookSlug, canto: verse.canto, chapter: verse.chapter, verse: verse.verse });
    }
  };

  const fav = verse ? isFavorite(verse.id) : false;
  const today = format(new Date(), 'EEEE, MMMM d');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Top bar ─── */}
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.dayLabel, { color: colors.textMuted }]}>SLOKA OF THE DAY</Text>
          <Text style={[styles.dateText, { color: colors.text }]}>{today}</Text>
        </View>
        <View style={styles.topBarActions}>
          <Pressable
            onPress={toggleVedabaseTheme}
            accessibilityRole="button"
            accessibilityLabel="Vedabase theme"
            accessibilityState={{ selected: vedabaseTheme }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.themeBtn,
              {
                backgroundColor: vedabaseTheme ? colors.primaryLight : colors.surfaceElevated,
                borderColor: vedabaseTheme ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.themeBtnIcon, { opacity: vedabaseTheme ? 1 : 0.55 }]}>🪔</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/library')}
            style={[styles.libraryChip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <Text style={[styles.libraryChipText, { color: colors.primary }]}>Library →</Text>
          </Pressable>
        </View>
      </View>

      {/* ─── Divider ─── */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading today's sloka…</Text>
        </View>
      ) : verse ? (
        <>
          {/* ─── Book label ─── */}
          <View style={styles.bookLabelRow}>
            <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
            <Text style={[styles.bookLabel, { color: colors.textMuted }]}>
              {bookTitle}  ·  {verseRef}
            </Text>
          </View>

          {/* ─── Devanagari ─── */}
          {verse.devanagari ? (
            <Text style={[styles.devanagari, { color: colors.primary }]} selectable>
              {verse.devanagari}
            </Text>
          ) : null}

          {/* ─── Transliteration ─── */}
          {verse.transliteration ? (
            <Text style={[styles.transliteration, { color: colors.textSecondary }]} selectable>
              {verse.transliteration}
            </Text>
          ) : null}

          {/* ─── Translation ─── */}
          {verse.translation ? (
            <View style={[styles.translationBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.sectionTag, { color: colors.primary }]}>TRANSLATION</Text>
              <Text style={[styles.translationText, { color: colors.text }]} selectable>
                {verse.translation}
              </Text>
            </View>
          ) : null}

          {/* ─── Purport ─── */}
          {verse.purport ? (
            <View style={[styles.purportBox, { borderColor: colors.border }]}>
              <Pressable
                style={styles.purportToggle}
                onPress={() => setPurportExpanded(p => !p)}
              >
                <Text style={[styles.sectionTag, { color: colors.textMuted }]}>PURPORT</Text>
                <Text style={[styles.toggleIcon, { color: colors.textMuted }]}>
                  {purportExpanded ? '▲' : '▼'}
                </Text>
              </Pressable>
              <Text
                style={[styles.purportText, { color: colors.textSecondary }]}
                numberOfLines={purportExpanded ? undefined : 6}
                selectable
              >
                {verse.purport}
              </Text>
              {!purportExpanded && (
                <Pressable onPress={() => setPurportExpanded(true)}>
                  <Text style={[styles.showMore, { color: colors.primary }]}>Show more</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {/* ─── Actions ─── */}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={toggleFavorite}
            >
              <Text style={[styles.actionBtnIcon, { color: fav ? colors.primary : colors.textMuted }]}>
                {fav ? '★' : '☆'}
              </Text>
              <Text style={[styles.actionBtnLabel, { color: fav ? colors.primary : colors.textMuted }]}>
                {fav ? 'Saved' : 'Save'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.openBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={openVerse}
            >
              <Text style={styles.openBtnText}>Full Verse →</Text>
            </Pressable>
          </View>

          {/* ─── Wallpaper view button ─── */}
          <Pressable
            style={({ pressed }) => [
              styles.wallpaperBtn,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => setShowWallpaper(true)}
          >
            <Text style={[styles.wallpaperIcon, { color: colors.primary }]}>⊞</Text>
            <View style={styles.wallpaperText}>
              <Text style={[styles.wallpaperTitle, { color: colors.text }]}>Wallpaper View</Text>
              <Text style={[styles.wallpaperSub, { color: colors.textMuted }]}>
                Full-screen sloka display
              </Text>
            </View>
            <Text style={[styles.wallpaperChevron, { color: colors.textMuted }]}>›</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No verse available</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Pull down to refresh or check your connection.
          </Text>
        </View>
      )}

      {verse && (
        <VerseWallpaperView
          verse={verse}
          visible={showWallpaper}
          onClose={() => setShowWallpaper(false)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 60,
    gap: 22,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dateText: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: -0.3,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeBtn: {
    borderWidth: 1,
    borderRadius: 20,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  themeBtnIcon: {
    fontSize: 16,
  },
  libraryChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 4,
  },
  libraryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  divider: { height: 1, width: '100%' },

  // Book label
  bookLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accentBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  bookLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Loading
  loaderWrap: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: { fontSize: 14 },

  // Devanagari
  devanagari: {
    fontSize: 27,
    fontFamily: Platform.OS === 'ios' ? 'Kohinoor Devanagari' : 'serif',
    lineHeight: 50,
    textAlign: 'center',
    letterSpacing: 0.4,
    fontWeight: '500',
  },

  // Transliteration
  transliteration: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.2,
  },

  // Translation
  translationBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  sectionTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  translationText: {
    fontSize: 17,
    lineHeight: 30,
    fontWeight: '400',
  },

  // Purport
  purportBox: {
    borderTopWidth: 1,
    paddingTop: 18,
    gap: 10,
  },
  purportToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleIcon: {
    fontSize: 9,
    fontWeight: '700',
  },
  purportText: {
    fontSize: 14,
    lineHeight: 26,
  },
  showMore: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionBtnIcon: {
    fontSize: 17,
    fontWeight: '600',
  },
  actionBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  openBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Wallpaper button
  wallpaperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  wallpaperIcon: { fontSize: 22 },
  wallpaperText: { flex: 1, gap: 2 },
  wallpaperTitle: { fontSize: 14, fontWeight: '700' },
  wallpaperSub: { fontSize: 11, lineHeight: 16 },
  wallpaperChevron: { fontSize: 20 },

  // Empty
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
