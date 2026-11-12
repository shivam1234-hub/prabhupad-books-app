// Reading-page bars that get out of the way: they float over the text, slide
// up as you scroll down, come back as you scroll up, and a click on the page
// (not on a link, word or button) shows / hides them.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDesktopUi } from './uiStore';
import { web } from './theme';

const INTERACTIVE =
  'a,button,input,textarea,select,[role="link"],[role="button"],[role="checkbox"],[data-vb-link],[data-vb-person],[data-vb-syn],[data-vb-pop],[aria-modal="true"]';

export function useAutoHideBar(pinned = false) {
  const shown = useDesktopUi((s) => s.barsShown);
  const setShown = useDesktopUi((s) => s.setBarsShown);
  const [height, setHeight] = useState(52);
  const lastY = useRef(0);
  const tapTimer = useRef<any>(null);
  const searchTick = useDesktopUi((s) => s.searchFocus);
  useEffect(() => { if (searchTick) setShown(true); }, [searchTick]);
  useEffect(() => { if (pinned) setShown(true); }, [pinned]);

  const onScrollY = useCallback((y: number) => {
    const d = y - lastY.current;
    lastY.current = y;
    if (pinned || y < 24) { setShown(true); return; }
    if (d > 6) setShown(false);
    else if (d < -6) setShown(true);
  }, [pinned]);

  // One click toggles; a double-click (word lookup) or a text selection doesn't.
  const onTap = useCallback((e: any) => {
    const target = e?.target as HTMLElement | null;
    if (target?.closest?.(INTERACTIVE)) return;
    clearTimeout(tapTimer.current);
    if ((e?.detail ?? 1) > 1) return;
    tapTimer.current = setTimeout(() => {
      const sel = window.getSelection?.();
      if (sel && !sel.isCollapsed) return;
      setShown((v) => (pinned ? true : !v));
    }, 260);
  }, [pinned]);
  useEffect(() => () => clearTimeout(tapTimer.current), []);

  return { shown, height, setHeight, onScrollY, onTap };
}

/** Full-screen reading: the hidden bar (with search) slides in when the mouse
 *  goes to the top of the screen and slides away again when it moves down —
 *  unless the search box is being typed in or its suggestions are open. */
export function useRevealAtTop(enabled: boolean, barHeight: number) {
  const setShown = useDesktopUi((s) => s.setBarsShown);
  useEffect(() => {
    if (!enabled) return;
    let hideTimer: any = null;
    const busy = () => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      return typing || !!document.querySelector('[data-vb-pop], [aria-modal="true"]');
    };
    const onMove = (e: MouseEvent) => {
      if (e.clientY <= 48) {
        clearTimeout(hideTimer); hideTimer = null;
        setShown(true);
      } else if (e.clientY > barHeight + 120 && useDesktopUi.getState().barsShown && !busy()) {
        if (!hideTimer) hideTimer = setTimeout(() => { hideTimer = null; if (!busy()) setShown(false); }, 500);
      } else if (e.clientY <= barHeight + 120) {
        clearTimeout(hideTimer); hideTimer = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => { window.removeEventListener('mousemove', onMove); clearTimeout(hideTimer); };
  }, [enabled, barHeight, setShown]);
}

export function AutoHideBar({ bar, children }: { bar: ReturnType<typeof useAutoHideBar>; children: React.ReactNode }) {
  return (
    <View
      onLayout={(e) => bar.setHeight(e.nativeEvent.layout.height)}
      style={[
        s.wrap,
        web({
          transform: bar.shown ? 'translateY(0)' : 'translateY(-105%)',
          transition: 'transform 220ms ease, box-shadow 220ms ease',
          pointerEvents: bar.shown ? 'auto' : 'none',
        }),
      ]}
    >
      {children}
    </View>
  );
}

/** Space at the top of the scroll content so the floating bar never covers the first line. */
export function BarSpacer({ bar }: { bar: ReturnType<typeof useAutoHideBar> }) {
  return <View style={{ height: bar.height, alignSelf: 'stretch' }} />;
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60 },
});
