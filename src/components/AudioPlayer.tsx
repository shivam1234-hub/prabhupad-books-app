import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  audioUrl: string;
  title?: string;
}

export function AudioPlayer({ audioUrl, title }: Props) {
  const { colors } = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const isPlaying = status?.isLoaded && status.isPlaying;
  const position = status?.isLoaded ? status.positionMillis : 0;
  const duration = status?.isLoaded ? (status.durationMillis ?? 0) : 0;
  const progress = duration > 0 ? position / duration : 0;

  async function togglePlay() {
    if (!sound) {
      setLoading(true);
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          (s) => setStatus(s)
        );
        setSound(newSound);
      } finally {
        setLoading(false);
      }
    } else if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  }

  async function seekTo(pct: number) {
    if (sound && duration > 0) {
      await sound.setPositionAsync(pct * duration);
    }
  }

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Pressable
          style={[styles.playBtn, { backgroundColor: colors.primary }]}
          onPress={togglePlay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          )}
        </Pressable>
        <View style={styles.info}>
          {title ? <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text> : null}
          <View style={styles.timeRow}>
            <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(position)}</Text>
            <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(duration)}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 18,
    color: '#FFF',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 11,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
  },
});
