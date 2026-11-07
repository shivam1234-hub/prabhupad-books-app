import React, { useState, useMemo, useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, LayoutChangeEvent, InteractionManager } from 'react-native';
import { Verse } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore, fontSizeMap } from '@/store/settingsStore';

// Word-for-word synonyms come as "word – meaning; word – meaning; …".
// Split into pairs so the Sanskrit word can be colored apart from its meaning.
function parseSynonyms(s: string): { word: string; meaning: string }[] {
  return s
    .split(';')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const m = seg.match(/^([\s\S]*?)\s[–—-]\s([\s\S]*)$/);
      return m ? { word: m[1].trim(), meaning: m[2].trim() } : { word: seg, meaning: '' };
    });
}

function Section({
  label, defaultExpanded = true, forceOpen = false, collapsible = true, onLayout, children,
}: {
  label: string; defaultExpanded?: boolean; forceOpen?: boolean; collapsible?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultExpanded);
  const isOpen = !collapsible || forceOpen || open;
  return (
    <View
      style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}
      onLayout={onLayout}
    >
      {collapsible ? (
        <Pressable
          style={[styles.header, { borderLeftColor: colors.primary }]}
          onPress={() => setOpen(v => !v)}
          hitSlop={4}
        >
          <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
          <Text style={[styles.chevron, { color: colors.textMuted }]}>{isOpen ? '▲' : '▼'}</Text>
        </Pressable>
      ) : (
        <View style={[styles.header, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
        </View>
      )}
      {isOpen && <View style={styles.body}>{children}</View>}
    </View>
  );
}

// Where each find match sits on screen, so the find bar can scroll to it.
// Native: the section's <Text> plus its laid-out lines (onTextLayout) — nested
// spans can't be measured, but a char offset maps to a line. Web: every match
// span is a DOM node and is measured directly.
type TextLine = { text: string; y: number; height: number };
type MatchHost = { text: any; lines: TextLine[]; offsets: number[]; length: number };
export type FindLocator = (index: number, relativeTo: any, cb: (y: number) => void) => void;

function matchOffsets(lower: string, query: string): number[] {
  const out: number[] = [];
  if (!query) return out;
  for (let i = lower.indexOf(query); i !== -1; i = lower.indexOf(query, i + query.length)) out.push(i);
  return out;
}

// Renders `text`, wrapping each case-insensitive occurrence of `query` in a
// highlight. The match whose global index equals `activeMatch` gets a stronger
// highlight (the "current" find result).
function Highlighted({
  text, query, baseIndex, activeMatch, style, highlightBg, activeBg, hosts, spans,
}: {
  text: string; query: string; baseIndex: number; activeMatch: number;
  style: any; highlightBg: string; activeBg: string;
  hosts: Map<number, MatchHost>; spans: Map<number, any>;
}) {
  const offsets = useMemo(() => matchOffsets(text.toLowerCase(), query), [text, query]);
  const host = useRef<MatchHost>({ text: null, lines: [], offsets, length: text.length }).current;
  host.offsets = offsets;
  host.length = text.length;
  useEffect(() => {
    offsets.forEach((_, occ) => hosts.set(baseIndex + occ, host));
    return () => offsets.forEach((_, occ) => {
      if (hosts.get(baseIndex + occ) === host) hosts.delete(baseIndex + occ);
    });
  }, [offsets, baseIndex]);

  if (!query) return <Text style={style} selectable>{text}</Text>;
  const nodes: React.ReactNode[] = [];
  let i = 0, k = 0;
  offsets.forEach((idx, occ) => {
    if (idx > i) nodes.push(<Text key={k++}>{text.slice(i, idx)}</Text>);
    const g = baseIndex + occ;
    nodes.push(
      <Text
        key={k++}
        ref={IS_WEB ? (el: any) => { if (el) spans.set(g, el); else spans.delete(g); } : undefined}
        style={{ backgroundColor: g === activeMatch ? activeBg : highlightBg, color: '#1E140A' }}
      >
        {text.slice(idx, idx + query.length)}
      </Text>
    );
    i = idx + query.length;
  });
  nodes.push(<Text key={k++}>{text.slice(i)}</Text>);
  return (
    <Text
      ref={(el: any) => { host.text = el; }}
      style={style}
      selectable
      onTextLayout={IS_WEB ? undefined : (e) => { host.lines = e.nativeEvent.lines as TextLine[]; }}
    >
      {nodes}
    </Text>
  );
}

const HAS_LETTER = /\p{L}/u;

/** The double-clicked word widened to its whole Sanskrit token. */
function wholeToken(sel: Selection): string | null {
  if (!sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node !== range.endContainer || node.nodeType !== 3) return null;
  const text = node.textContent ?? '';
  const part = /[\p{L}\p{M}'’-]/u;
  let a = range.startOffset;
  let b = range.endOffset;
  while (a > 0 && part.test(text[a - 1])) a--;
  while (b < text.length && part.test(text[b])) b++;
  return text.slice(a, b).replace(/^-+|[-'’]+$/g, '').trim() || null;
}
const IS_WEB = Platform.OS === 'web';
type WordLookup = (word: string, sanskrit: boolean) => void;

// Web/desktop: which kind of text a double-clicked word sits in. `skt` =
// transliteration or a synonyms entry's Sanskrit side; `en` = everything else
// worth looking up. Text without a marker (headers, Devanāgarī) is ignored.
const lookupMark = (kind: 'skt' | 'en') => (IS_WEB ? ({ dataSet: { lookup: kind } } as any) : null);

/**
 * `text` with every word its own long-pressable span (native only).
 *
 * RN has no "which character was touched" API, so a word must be its own
 * nested <Text> to know it was the one pressed. On web the browser's own
 * double-click selection does that job (see the listener in VerseContent),
 * so web renders the plain string.
 */
function Words({ text, sanskrit, onWord, armed = true }: {
  text: string; sanskrit: boolean; onWord?: WordLookup; armed?: boolean;
}) {
  if (!onWord || IS_WEB || !armed) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  const re = /\S+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    parts.push(
      HAS_LETTER.test(token)
        ? <Text key={m.index} onLongPress={() => onWord(token, sanskrit)} suppressHighlighting>{token}</Text>
        : token,
    );
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const wordCount = (s: string) => s.match(/\S+/g)?.length ?? 0;

// Word spans are turned on this many words at a time, one batch per frame, so
// the verse paints at once and a long purport never stalls the JS thread.
const WORDS_PER_FRAME = 250;

/**
 * One paragraph of a section. Kept as its own <Text> (and memoised) so that
 * arming it for word lookup re-renders and re-lays out only this paragraph.
 */
const Paragraph = memo(function Paragraph({ text, style, sanskrit, onWord, armed, lookupKind }: {
  text: string; style: any; sanskrit: boolean; onWord?: WordLookup; armed: boolean;
  lookupKind: 'skt' | 'en';
}) {
  return (
    <Text style={style} selectable={!onWord || IS_WEB} {...lookupMark(lookupKind)}>
      <Words text={text} sanskrit={sanskrit} onWord={onWord} armed={armed} />
    </Text>
  );
});

// Which sections to show. Used by the chapter "advanced view" to toggle
// sections across every verse at once (like vedabase's advanced-view settings).
export interface VerseDisplay {
  devanagari: boolean;
  transliteration: boolean;
  synonyms: boolean;
  translation: boolean;
  purport: boolean;
}

export interface VerseContentSearchProps {
  /** Active in-page search query (already trimmed). */
  query?: string;
  /** Global index of the currently-focused match. */
  activeMatch?: number;
  /** Reports, in document order, the section key for each match found. */
  onMatchSectionsChange?: (sectionKeys: string[]) => void;
  /** Reports a section's y-offset (relative to VerseContent) for scroll-to. */
  onSectionLayout?: (key: string, y: number) => void;
  /** Reports VerseContent's own y-offset within the scroll content. */
  onContainerLayout?: (y: number) => void;
  /** Long-press (native) / double-click (web) on a word: show its meaning.
   * `sanskrit` is true for the transliteration and synonyms' Sanskrit side. */
  onWordLookup?: WordLookup;
  /** Called once every word can be long-pressed (native) — right away on web. */
  onLookupReady?: () => void;
  /** Receives a function that measures match `index`'s y relative to a view. */
  onFindLocator?: (locate: FindLocator) => void;
}

export function VerseContent({
  verse, query = '', activeMatch = 0, display,
  onMatchSectionsChange, onSectionLayout, onContainerLayout, onWordLookup, onLookupReady, onFindLocator,
}: { verse: Verse; display?: VerseDisplay } & VerseContentSearchProps) {
  const { colors, isDark } = useTheme();
  const settings = useSettingsStore(s => s.settings);
  // Base point size × the global reading scale — applied to every section's
  // font size AND line height so the whole verse grows proportionally.
  const sc = settings.fontScale ?? 1;
  const base = fontSizeMap[settings.fontSize];
  const px = (pt: number) => Math.round(pt * sc);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const highlightBg = isDark ? '#C4A870' : '#F5DEB8';
  const activeBg = '#F2B23A';

  // Searchable sections in document order. `text` is the plain string matched.
  const sections = useMemo(() => {
    const list: { key: string; label: string; text: string; style: any; defaultExpanded: boolean }[] = [];
    if (verse.devanagari) list.push({ key: 'devanagari', label: 'Sanskrit Text', text: verse.devanagari, style: [styles.devanagari, { color: colors.primary, fontSize: px(base + 6), lineHeight: px(46) }], defaultExpanded: settings.showDevanagari });
    if (verse.transliteration) list.push({ key: 'transliteration', label: 'Transliteration', text: verse.transliteration, style: [styles.transliteration, { color: colors.textSecondary, fontSize: px(base - 1), lineHeight: px(28) }], defaultExpanded: settings.showTransliteration });
    if (verse.synonyms) list.push({ key: 'synonyms', label: 'Word-for-Word', text: verse.synonyms, style: [styles.synonyms, { color: colors.textSecondary, fontSize: px(base - 1), lineHeight: px(26) }], defaultExpanded: settings.showSynonyms });
    if (verse.translation) list.push({ key: 'translation', label: 'Translation', text: verse.translation, style: [styles.translation, { color: colors.text, fontSize: px(base), lineHeight: px(28) }], defaultExpanded: settings.showTranslation });
    if (verse.purport) list.push({ key: 'purport', label: 'Purport', text: verse.purport, style: [styles.purport, { color: colors.textSecondary, fontSize: px(base), lineHeight: px(28) }], defaultExpanded: settings.showPurport });
    // Advanced view: keep only the sections the reader has toggled on.
    return display ? list.filter((s) => display[s.key as keyof VerseDisplay]) : list;
  }, [verse, settings, colors, base, sc, display]);

  // Compute match → section mapping and per-section base index for highlighting.
  const { matchSections, baseIndexByKey } = useMemo(() => {
    const keys: string[] = [];
    const baseIdx: Record<string, number> = {};
    for (const s of sections) {
      baseIdx[s.key] = keys.length;
      const n = matchOffsets(s.text.toLowerCase(), q).length;
      for (let i = 0; i < n; i++) keys.push(s.key);
    }
    return { matchSections: keys, baseIndexByKey: baseIdx };
  }, [sections, q]);

  useEffect(() => {
    onMatchSectionsChange?.(matchSections);
  }, [matchSections]);

  const hosts = useRef(new Map<number, MatchHost>()).current;
  const spans = useRef(new Map<number, any>()).current;
  useEffect(() => {
    onFindLocator?.((index, relativeTo, cb) => {
      if (IS_WEB) {
        const span = spans.get(index) as HTMLElement | undefined;
        const rel = relativeTo as HTMLElement | null;
        if (span?.getBoundingClientRect && rel?.getBoundingClientRect) {
          cb(span.getBoundingClientRect().top - rel.getBoundingClientRect().top);
        }
        return;
      }
      const host = hosts.get(index);
      if (!host?.text || !relativeTo) return;
      const offset = host.offsets[index - (baseIndexByKey[matchSections[index]] ?? 0)] ?? 0;
      host.text.measureLayout(relativeTo, (_x: number, y: number, _w: number, h: number) => {
        // The line holding the match: walk the laid-out lines by length.
        let lineY: number | null = null;
        let pos = 0;
        for (const line of host.lines) {
          pos += line.text.length;
          if (offset < pos) { lineY = line.y; break; }
        }
        // No line info (yet): estimate from the match's place in the text.
        if (lineY === null) lineY = h * Math.min(1, offset / Math.max(1, host.length));
        cb(y + lineY);
      }, () => {});
    });
  }, [matchSections, baseIndexByKey]);

  // Web/desktop double-click: the browser has already selected the word.
  const containerRef = useRef<View>(null);
  const lookupRef = useRef(onWordLookup);
  lookupRef.current = onWordLookup;
  useEffect(() => {
    if (!IS_WEB || !onWordLookup) return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onDblClick = () => {
      const sel = window.getSelection();
      const mark = (sel?.anchorNode?.parentElement?.closest('[data-lookup]') as HTMLElement | null)
        ?.dataset.lookup;
      // Sanskrit: a compound ("dharma-kṣetre") or an avagraha ("’śubhāt") is
      // one word to look up, though the browser's selection stops at them.
      const word = (mark === 'skt' && sel && wholeToken(sel)) || sel?.toString().trim();
      if (!word || !mark || !HAS_LETTER.test(word)) return;
      sel?.removeAllRanges();
      lookupRef.current?.(word, mark === 'skt');
    };
    node.addEventListener('dblclick', onDblClick);
    return () => node.removeEventListener('dblclick', onDblClick);
  }, [!!onWordLookup]);

  // Word lookup spans, built progressively. Each unit (a paragraph, or the
  // whole synonyms block) starts as plain text and is armed in document order
  // after the screen has settled; `armedUnits` is how many are armed so far.
  const lookupOn = !!onWordLookup && !IS_WEB && !searching;
  const units = useMemo(() => {
    const out: { key: string; paras: string[]; start: number }[] = [];
    const words: number[] = [];
    for (const s of sections) {
      if (s.key === 'devanagari') continue;
      const paras = s.key === 'synonyms' ? [s.text] : s.text.split(/\n{2,}/);
      out.push({ key: s.key, paras, start: words.length });
      for (const p of paras) words.push(wordCount(p));
    }
    return { byKey: Object.fromEntries(out.map(u => [u.key, u])), words };
  }, [sections]);
  const synonymPairs = useMemo(() => parseSynonyms(verse.synonyms ?? ''), [verse.synonyms]);
  const [armedUnits, setArmedUnits] = useState(0);
  const readyRef = useRef(onLookupReady);
  readyRef.current = onLookupReady;
  useEffect(() => {
    setArmedUnits(0);
    if (!lookupOn) {
      // Web needs no spans; during a find the plain highlighted text is shown.
      if (onWordLookup) readyRef.current?.();
      return;
    }
    let cancelled = false;
    let raf = 0;
    const step = (from: number) => {
      let to = from;
      let budget = WORDS_PER_FRAME;
      while (to < units.words.length && (budget > 0 || to === from)) budget -= units.words[to++];
      setArmedUnits(to);
      if (to >= units.words.length) readyRef.current?.();
      else raf = requestAnimationFrame(() => { if (!cancelled) step(to); });
    };
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) raf = requestAnimationFrame(() => { if (!cancelled) step(0); });
    });
    return () => { cancelled = true; task.cancel(); cancelAnimationFrame(raf); };
  }, [units, lookupOn, !!onWordLookup]);

  // Native: a selectable Text claims the long-press for its copy menu, so the
  // sections that offer word meanings give that up while lookups are on.
  const wordMode = !!onWordLookup && !IS_WEB;

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={(e) => onContainerLayout?.(e.nativeEvent.layout.y)}
    >
      {sections.map((s) => (
        <Section
          key={s.key}
          label={s.label}
          defaultExpanded={s.defaultExpanded}
          forceOpen={searching}
          collapsible={!display}
          onLayout={(e) => onSectionLayout?.(s.key, e.nativeEvent.layout.y)}
        >
          {s.key === 'synonyms' && !searching ? (
            <Text style={s.style} selectable={!wordMode}>
              {synonymPairs.map((t, i, arr) => (
                <Text key={i}>
                  <Text style={{ color: colors.primary, fontWeight: '800' }} {...lookupMark('skt')}>
                    <Words text={t.word} sanskrit onWord={onWordLookup} armed={armedUnits > units.byKey.synonyms.start} />
                  </Text>
                  {t.meaning ? (
                    <Text style={{ color: colors.text, fontStyle: 'italic' }} {...lookupMark('en')}>
                      {' — '}<Words text={t.meaning} sanskrit={false} onWord={onWordLookup} armed={armedUnits > units.byKey.synonyms.start} />
                    </Text>
                  ) : null}
                  {i < arr.length - 1 ? <Text style={{ color: colors.textMuted }}>{';  '}</Text> : null}
                </Text>
              ))}
            </Text>
          ) : !searching && onWordLookup && s.key !== 'devanagari' ? (
            <View style={{ gap: StyleSheet.flatten(s.style).lineHeight }}>
              {units.byKey[s.key].paras.map((p, i) => (
                <Paragraph
                  key={i}
                  text={p}
                  style={s.style}
                  sanskrit={s.key === 'transliteration'}
                  onWord={onWordLookup}
                  armed={armedUnits > units.byKey[s.key].start + i}
                  lookupKind={s.key === 'transliteration' ? 'skt' : 'en'}
                />
              ))}
            </View>
          ) : (
            <Highlighted
              text={s.text}
              query={q}
              baseIndex={baseIndexByKey[s.key] ?? 0}
              activeMatch={activeMatch}
              style={s.style}
              highlightBg={highlightBg}
              activeBg={activeBg}
              hosts={hosts}
              spans={spans}
            />
          )}
        </Section>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  section: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderLeftWidth: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chevron: { fontSize: 9, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingVertical: 14 },
  devanagari: {
    fontFamily: Platform.OS === 'ios' ? 'Kohinoor Devanagari' : 'serif',
    lineHeight: 46,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  transliteration: {
    fontStyle: 'italic',
    lineHeight: 28,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  synonyms: { lineHeight: 26 },
  translation: { lineHeight: 28, fontWeight: '500' },
  purport: { lineHeight: 28 },
});
