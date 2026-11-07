import { useEffect, useMemo, useRef, useCallback } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useHistoryStore, makeRouteKey, HistoryEntry } from '@/store/historyStore';

type VisitData = Omit<HistoryEntry, 'key' | 'visitedAt' | 'pathname' | 'params'>;

interface Options {
  pathname: string;
  params: Record<string, string | undefined>;
  entry: () => VisitData | null;
  // Optional deps that identify when this "visit" changes (e.g. verse changes
  // via replace() without unmount). Defaults to serialized params.
  visitDeps?: unknown[];
}

// Records a history visit for the current route, exposes a throttled onScroll
// handler that persists scroll offset, and returns the saved offset so the
// screen can restore its scroll position after data loads.
export function useTrackedRoute({ pathname, params, entry, visitDeps }: Options) {
  const cleanParams = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') out[k] = String(v);
    }
    return out;
  }, [JSON.stringify(params)]);

  const key = useMemo(() => makeRouteKey(pathname, cleanParams), [pathname, cleanParams]);

  const visit = useHistoryStore((s) => s.visit);
  const saveScroll = useHistoryStore((s) => s.saveScroll);
  const savedOffset = useHistoryStore((s) => s.scrollPositions[key]);

  const depsKey = JSON.stringify(visitDeps ?? [key]);

  useEffect(() => {
    const data = entry();
    if (!data) return;
    visit({ ...data, key, pathname, params: cleanParams });
    // Intentionally trigger only on identity/data change of the visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  // Persist scroll offset — throttled to at most once per ~200ms.
  const lastY = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    saveScroll(key, lastY.current);
    timer.current = null;
  }, [key, saveScroll]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastY.current = e.nativeEvent.contentOffset.y;
      if (timer.current) return;
      timer.current = setTimeout(flush, 220);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        // Final flush so the last known offset is persisted on unmount.
        saveScroll(key, lastY.current);
      }
    };
  }, [key, saveScroll]);

  return { key, savedOffset, onScroll };
}
