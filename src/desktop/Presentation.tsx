// Presentation view for full-screen verse reading: only the (roman) śloka, or only the
// translation, blown up to fill the whole screen — for projecting in a class.
//
// The text is fitted to the screen (largest size at which it still fits), and
// the zoom (Ctrl + / Ctrl − / Ctrl+wheel, or the bar's − / + buttons) scales
// on top of that. Zoomed past the screen, the text scrolls.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Verse } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { Segmented, IconBtn } from './ui';
import { useDesktopUi, PresentMode } from './uiStore';
import { SANS, SERIF, web } from './theme';

const MIN_PX = 12;
const MAX_PX = 260;

/** The largest base font size (px) at which `content` fits inside `box`. */
function fitSize(box: HTMLElement, content: HTMLElement): number {
  const cs = getComputedStyle(box);
  const room = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const fits = (px: number) => {
    content.style.fontSize = `${px}px`;
    // Height: the whole text on screen. Width: no word wider than the screen.
    return content.scrollHeight <= room && content.scrollWidth <= content.clientWidth + 1;
  };
  let lo = MIN_PX;
  let hi = MAX_PX;
  if (fits(hi)) return hi;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return Math.floor(lo * 2) / 2;
}

export function Presentation({ verse, mode, label, onTap }: { verse: Verse; mode: Exclude<PresentMode, 'full'>; label?: string; onTap?: (e: any) => void }) {
  const { colors } = useTheme();
  const zoom = useDesktopUi((st) => st.presentZoom);
  const zoomPresent = useDesktopUi((st) => st.zoomPresent);
  const boxRef = useRef<any>(null);
  const contentRef = useRef<any>(null);
  const [fit, setFit] = useState<number | null>(null);

  // Śloka: the roman (English-letter) verse text only — the user asked for no
  // Devanāgarī here; it shows only when a page has no roman text at all.
  // Translation: the translation.
  const hasDeva = !!verse.devanagari?.trim();
  const hasTr = !!verse.transliteration?.trim();
  const showTr = hasTr;
  const showDeva = !hasTr && hasDeva;
  const translation = (verse.translation ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const empty = mode === 'sloka' ? !showDeva && !showTr : translation.length === 0;

  const measure = useCallback(() => {
    const box = boxRef.current as HTMLElement | null;
    const content = contentRef.current as HTMLElement | null;
    if (!box || !content || !box.clientHeight) return;
    setFit(fitSize(box, content));
  }, []);

  // Refit when the verse, the mode or the screen size changes.
  useLayoutEffect(() => { setFit(null); measure(); }, [verse.id, mode, showDeva, showTr, label, measure]);
  useEffect(() => {
    const box = boxRef.current as HTMLElement | null;
    if (!box || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });
    ro.observe(box);
    // Web fonts arriving late change the text's size.
    (document as any).fonts?.ready?.then?.(() => measure());
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [measure]);

  // Apply fit × zoom after every render (React doesn't own the font size).
  useLayoutEffect(() => {
    const content = contentRef.current as HTMLElement | null;
    if (content && fit) content.style.fontSize = `${Math.round(fit * zoom * 2) / 2}px`;
  });

  // Ctrl + mouse wheel zooms the presentation (not the whole window).
  useEffect(() => {
    const box = boxRef.current as HTMLElement | null;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomPresent(e.deltaY < 0 ? 1 : -1);
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [zoomPresent]);

  const lines = (text: string) => text.trim().split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <View ref={boxRef} style={[s.box, web({ overflow: 'auto' })]} {...({ onClick: onTap } as any)}>
      <View ref={contentRef} style={[s.content, { opacity: fit ? 1 : 0 }]}>
        {/* The verse number (e.g. "Bg. 2.13"), part of the fitted text so it scales with it. */}
        {label && !empty ? <Text selectable style={[s.ref, { color: colors.primary }]}>{label}</Text> : null}
        {empty ? (
          <Text style={[s.empty, { color: colors.textMuted }]}>
            {mode === 'sloka' ? 'This page has no śloka.' : 'This page has no translation.'}
          </Text>
        ) : mode === 'sloka' ? (
          <>
            {showDeva ? (
              lines(verse.devanagari!).map((l, i) => (
                <Text key={i} selectable style={[s.deva, { color: colors.devanagari }, web({ whiteSpace: 'nowrap' })]}>{l}</Text>
              ))
            ) : null}
            {/* One verse line per row, never wrapped: the fit shrinks the text
                until the longest line fits the screen width. */}
            {showTr ? lines(verse.transliteration!).map((l, i) => (
              <Text key={i} selectable style={[s.translit, { color: colors.transliteration === colors.textSecondary ? colors.text : colors.transliteration }, web({ whiteSpace: 'nowrap' })]}>
                {l}
              </Text>
            )) : null}
          </>
        ) : (
          translation.map((p, i) => (
            <Text key={i} selectable style={[s.translation, { color: colors.translation }, i > 0 && s.gapAbove]}>{p}</Text>
          ))
        )}
      </View>
    </View>
  );
}

/** Full-screen bar controls: what to show, and the presentation zoom. */
export function PresentControls() {
  const { colors } = useTheme();
  const mode = useDesktopUi((st) => st.presentMode);
  const setMode = useDesktopUi((st) => st.setPresentMode);
  const zoom = useDesktopUi((st) => st.presentZoom);
  const zoomPresent = useDesktopUi((st) => st.zoomPresent);
  return (
    <View style={s.controls}>
      <Segmented<PresentMode>
        value={mode}
        onChange={setMode}
        options={[
          { key: 'full', label: 'Full page' },
          { key: 'sloka', label: 'Śloka' },
          { key: 'translation', label: 'Translation' },
        ]}
      />
      {mode !== 'full' ? (
        <View style={s.zoom}>
          <IconBtn icon="−" tip="Smaller  (Ctrl −)" onPress={() => zoomPresent(-1)} size={30} />
          <Text
            onPress={() => zoomPresent(0)}
            style={[s.zoomText, { color: colors.textSecondary }, web({ cursor: 'pointer' })]}
            {...({ title: 'Fit to screen  (Ctrl 0)' } as any)}
          >
            {Math.round(zoom * 100)}%
          </Text>
          <IconBtn icon="+" tip="Bigger  (Ctrl +)" onPress={() => zoomPresent(1)} size={30} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, minHeight: 0, paddingHorizontal: '5%', paddingVertical: '4%' } as any,
  // margin auto centres the text while still letting it scroll when zoomed past the screen.
  content: { marginVertical: 'auto', alignSelf: 'stretch', alignItems: 'center' } as any,
  deva: { fontFamily: SERIF, fontSize: '1.25em', lineHeight: '1.6em', textAlign: 'center' } as any,
  translit: { fontFamily: SERIF, fontStyle: 'italic', fontSize: '1em', lineHeight: '1.45em', textAlign: 'center' } as any,
  translation: { fontFamily: SERIF, fontWeight: '700', fontSize: '1em', lineHeight: '1.4em', textAlign: 'center' } as any,
  ref: { fontFamily: SERIF, fontWeight: '700', fontSize: '0.55em', lineHeight: '1.3em', textAlign: 'center', marginBottom: '0.5em', letterSpacing: 0.5 } as any,
  gapAbove: { marginTop: '0.6em' } as any,
  empty: { fontFamily: SANS, fontSize: '0.5em', textAlign: 'center' } as any,
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoom: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  zoomText: { fontFamily: SANS, fontSize: 12.5, fontWeight: '600', minWidth: 44, textAlign: 'center' },
});
