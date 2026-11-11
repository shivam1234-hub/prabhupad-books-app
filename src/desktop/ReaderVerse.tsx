// Desktop verse renderer, laid out like a vedabase.io verse page: Devanāgarī
// and the verse text centred, synonyms as one flowing paragraph whose italic
// Sanskrit words open their meanings, the translation in bold and the purport
// in serif paragraphs. Purport references and personalities preview on hover.
//
// The phone keeps src/components/VerseContent.tsx (cards per section); this
// file is used only by the *.web.tsx reading screens.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Verse } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore, fontSizeMap } from '@/store/settingsStore';
import { findCitations, Citation, LibraryRef } from '@/services/purport/citations';
import { findPersonalities } from '@/services/personalities';
import type { Personality } from '@/constants/personalities';
import { SANS, SERIF, web, alpha } from './theme';

export type LinkedCitation = Citation & { ref: LibraryRef };
export type Anchor = { x: number; y: number };
export type SectionKey = 'devanagari' | 'transliteration' | 'synonyms' | 'translation' | 'purport';
export type Display = Record<SectionKey, boolean>;

type Segment = { text: string; cite?: LinkedCitation; person?: Personality };

function citationSegments(text: string, inBook?: string): Segment[] {
  let cites: LinkedCitation[];
  try { cites = findCitations(text, inBook).filter((c): c is LinkedCitation => !!c.ref); } catch { return [{ text }]; }
  if (!cites.length) return [{ text }];
  const out: Segment[] = [];
  let i = 0;
  for (const c of cites) {
    if (c.start < i) continue;
    if (c.start > i) out.push({ text: text.slice(i, c.start) });
    let end = c.end;
    const linked = text.slice(c.start, end);
    if (text[end] === ')' && linked.split('(').length > linked.split(')').length) end++;
    out.push({ text: text.slice(c.start, end), cite: c });
    i = end;
  }
  if (i < text.length) out.push({ text: text.slice(i) });
  return out;
}

function personalitySegments(segs: Segment[], seen: Set<string>): Segment[] {
  const out: Segment[] = [];
  for (const seg of segs) {
    if (seg.cite) { out.push(seg); continue; }
    let found: ReturnType<typeof findPersonalities>;
    try { found = findPersonalities(seg.text); } catch { found = []; }
    let i = 0;
    for (const m of found) {
      if (seen.has(m.person.id)) continue;
      seen.add(m.person.id);
      if (m.start > i) out.push({ text: seg.text.slice(i, m.start) });
      out.push({ text: seg.text.slice(m.start, m.end), person: m.person });
      i = m.end;
    }
    if (i < seg.text.length) out.push({ text: seg.text.slice(i) });
  }
  return out;
}

function parseSynonyms(s: string): { word: string; meaning: string }[] {
  return s.split(';').map((x) => x.trim()).filter(Boolean).map((seg) => {
    const m = seg.match(/^([\s\S]*?)\s[–—-]\s([\s\S]*)$/);
    return m ? { word: m[1].trim(), meaning: m[2].trim() } : { word: seg, meaning: '' };
  });
}

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
const HAS_LETTER = /\p{L}/u;

/** Anchor point for a preview card: under the link, or above it when low on screen. */
function anchorOf(e: any): Anchor | null {
  const el = e?.currentTarget as HTMLElement | undefined;
  const r = el?.getBoundingClientRect?.();
  if (!r) return null;
  const low = r.top > window.innerHeight * 0.5;
  return { x: r.left + Math.min(r.width, 240) / 2, y: low ? r.top : r.bottom };
}

export interface ReaderVerseProps {
  verse: Verse;
  /** Which sections start open (collapsed ones show as a small "show" link). */
  display: Display;
  /** Find-in-page query and the current match. */
  query?: string;
  activeMatch?: number;
  onMatchCount?: (n: number) => void;
  onWordLookup?: (word: string, sanskrit: boolean) => void;
  onCitationHover?: (c: LinkedCitation, at: Anchor | null) => void;
  onCitationOpen?: (c: LinkedCitation) => void;
  onPersonHover?: (p: Personality, at: Anchor | null) => void;
  /** Smaller type for the continuous chapter view. */
  compact?: boolean;
}

const LABELS: Record<SectionKey, string> = {
  devanagari: 'Devanāgarī',
  transliteration: 'Verse text',
  synonyms: 'Synonyms',
  translation: 'Translation',
  purport: 'Purport',
};

export function ReaderVerse({
  verse, display, query = '', activeMatch = 0, onMatchCount, onWordLookup,
  onCitationHover, onCitationOpen, onPersonHover, compact,
}: ReaderVerseProps) {
  const { colors, isDark } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const sc = settings.fontScale ?? 1;
  const base = fontSizeMap[settings.fontSize] + (compact ? 1 : 2);
  const px = (n: number) => Math.round(n * sc);

  const [open, setOpen] = useState<Display>(display);
  useEffect(() => setOpen(display), [verse.id, JSON.stringify(display)]);

  const q = query.trim().toLowerCase();
  // Every match on the page gets a running index, in reading order, so the
  // find bar can step through them and scroll to [data-vb-match="i"].
  const counter = { n: 0 };
  const hlBg = isDark ? alpha('#C4A870', 0.55) : '#F5DEB8';
  const hl = (text: string, key: string | number): React.ReactNode => {
    if (!q) return text;
    const lower = text.toLowerCase();
    const out: React.ReactNode[] = [];
    let i = 0;
    let k = 0;
    for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, at + q.length)) {
      if (at > i) out.push(text.slice(i, at));
      const idx = counter.n++;
      out.push(
        <Text
          key={`${key}-${k++}`}
          dataSet={{ vbMatch: String(idx) }}
          style={{ backgroundColor: idx === activeMatch ? '#F2B23A' : hlBg, color: '#1E140A', borderRadius: 2 }}
        >
          {text.slice(at, at + q.length)}
        </Text>,
      );
      i = at + q.length;
    }
    if (i === 0) return text;
    out.push(text.slice(i));
    return out;
  };

  const paras = useMemo(() => {
    const seen = new Set<string>();
    const cut = (t?: string) => (t ? t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : []);
    const withLinks = (ps: string[], cites: boolean) => ps.map((p) => {
      const segs = cites ? citationSegments(p, verse.bookSlug) : [{ text: p }];
      return onPersonHover ? personalitySegments(segs, seen) : segs;
    });
    return {
      translation: withLinks(cut(verse.translation), false),
      purport: withLinks(cut(verse.purport), true),
    };
  }, [verse.id, verse.translation, verse.purport, !!onPersonHover]);
  const synonyms = useMemo(() => parseSynonyms(verse.synonyms ?? ''), [verse.synonyms]);

  // Double-click a word in the verse text, translation or purport for its meaning.
  const container = useRef<any>(null);
  const lookupRef = useRef(onWordLookup);
  lookupRef.current = onWordLookup;
  useEffect(() => {
    const node = container.current as HTMLElement | null;
    if (!node?.addEventListener || !onWordLookup) return;
    const onDbl = () => {
      const sel = window.getSelection();
      const mark = (sel?.anchorNode?.parentElement?.closest('[data-lookup]') as HTMLElement | null)?.dataset.lookup;
      const word = (mark === 'skt' && sel && wholeToken(sel)) || sel?.toString().trim();
      if (!word || !mark || !HAS_LETTER.test(word)) return;
      sel?.removeAllRanges();
      lookupRef.current?.(word, mark === 'skt');
    };
    node.addEventListener('dblclick', onDbl);
    return () => node.removeEventListener('dblclick', onDbl);
  }, [!!onWordLookup]);

  useEffect(() => { onMatchCount?.(counter.n); });

  const linkColor = colors.primary;
  const renderSegs = (segs: Segment[], key: string) => segs.map((seg, i) => {
    if (seg.cite) {
      const c = seg.cite;
      return (
        <Text
          key={i}
          dataSet={{ vbLink: '1' }}
          accessibilityRole="link"
          onPress={() => onCitationOpen?.(c)}
          onMouseEnter={(e: any) => onCitationHover?.(c, anchorOf(e))}
          onMouseLeave={() => onCitationHover?.(c, null)}
          style={[s.cite, { color: linkColor }, web({ cursor: 'pointer' })]}
        >
          {hl(seg.text, `${key}-${i}`)}
        </Text>
      );
    }
    if (seg.person) {
      const p = seg.person;
      return (
        <Text
          key={i}
          dataSet={{ vbPerson: '1' }}
          accessibilityRole="link"
          accessibilityHint="Shows who this is"
          onPress={(e: any) => onPersonHover?.(p, anchorOf(e))}
          onMouseEnter={(e: any) => onPersonHover?.(p, anchorOf(e))}
          onMouseLeave={() => onPersonHover?.(p, null)}
          style={[s.person, { textDecorationColor: alpha(linkColor, 0.7) }, web({ cursor: 'help' })]}
        >
          {hl(seg.text, `${key}-${i}`)}
        </Text>
      );
    }
    return <React.Fragment key={i}>{hl(seg.text, `${key}-${i}`)}</React.Fragment>;
  });

  const searching = !!q;
  const isOpen = (k: SectionKey) => searching || open[k];
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const heading = (k: SectionKey) => (
    <Pressable onPress={() => toggle(k)} style={[s.headingWrap, web({ cursor: 'pointer' })]} accessibilityRole="button" accessibilityState={{ expanded: isOpen(k) }}>
      {({ hovered }: any) => (
        <View>
          <Text style={[s.heading, { color: colors.text, fontSize: px(compact ? 17 : 19) }]}>{LABELS[k]}</Text>
          <Text style={[s.headingCaret, { color: colors.textMuted, opacity: hovered || !isOpen(k) ? 1 : 0 }]}>{isOpen(k) ? '▾' : '▸'}</Text>
        </View>
      )}
    </Pressable>
  );

  // Collapsed sections without a heading of their own (Devanāgarī, verse text)
  // stay reachable as a small pill.
  const hiddenPills = (['devanagari', 'transliteration'] as SectionKey[])
    .filter((k) => !isOpen(k) && (k === 'devanagari' ? verse.devanagari : verse.transliteration));

  const blocks: React.ReactNode[] = [];

  if (hiddenPills.length) {
    blocks.push(
      <View key="pills" style={s.pills}>
        {hiddenPills.map((k) => (
          <Pressable key={k} onPress={() => toggle(k)} style={({ hovered }: any) => [s.pill, { borderColor: colors.border, backgroundColor: hovered ? alpha(colors.primary, 0.08) : 'transparent' }, web({ cursor: 'pointer' })]}>
            <Text style={[s.pillText, { color: colors.textSecondary }]}>＋ Show {LABELS[k]}</Text>
          </Pressable>
        ))}
      </View>,
    );
  }

  if (verse.devanagari && isOpen('devanagari')) {
    blocks.push(
      <Text key="deva" selectable style={[s.deva, { color: colors.devanagari, fontSize: px(base + 7), lineHeight: px((base + 7) * 1.75) }]}>
        {verse.devanagari.split('\n').map((l, i, a) => <React.Fragment key={i}>{hl(l, `d${i}`)}{i < a.length - 1 ? '\n' : ''}</React.Fragment>)}
      </Text>,
    );
  }
  if (verse.transliteration && isOpen('transliteration')) {
    blocks.push(
      <Text key="tr" selectable dataSet={{ lookup: 'skt' }} style={[s.translit, { color: colors.transliteration === colors.textSecondary ? colors.text : colors.transliteration, fontSize: px(base + 1), lineHeight: px((base + 1) * 1.65) }]}>
        {verse.transliteration.split('\n').map((l, i, a) => <React.Fragment key={i}>{hl(l, `t${i}`)}{i < a.length - 1 ? '\n' : ''}</React.Fragment>)}
      </Text>,
    );
  }
  if (verse.synonyms) {
    blocks.push(
      <View key="syn" style={s.section}>
        {heading('synonyms')}
        {isOpen('synonyms') ? (
          <Text selectable style={[s.body, { color: colors.text, fontSize: px(base - 0.5), lineHeight: px((base - 0.5) * 1.7) }]}>
            {synonyms.map((p, i) => (
              <React.Fragment key={i}>
                <Text
                  dataSet={{ vbSyn: '1', lookup: 'skt' }}
                  onPress={onWordLookup ? () => onWordLookup(p.word, true) : undefined}
                  accessibilityRole={onWordLookup ? 'link' : undefined}
                  style={[s.synWord, { color: colors.primary }, onWordLookup && web({ cursor: 'pointer' })]}
                >
                  {hl(p.word, `sw${i}`)}
                </Text>
                {p.meaning ? <Text dataSet={{ lookup: 'en' }}>{' — '}{hl(p.meaning, `sm${i}`)}</Text> : null}
                {i < synonyms.length - 1 ? '; ' : ''}
              </React.Fragment>
            ))}
          </Text>
        ) : null}
      </View>,
    );
  }
  if (verse.translation) {
    blocks.push(
      <View key="tl" style={s.section}>
        {verse.synonyms || verse.devanagari ? heading('translation') : null}
        {isOpen('translation') ? paras.translation.map((segs, i) => (
          <Text key={i} selectable dataSet={{ lookup: 'en' }} style={[s.body, s.translation, { color: colors.translation, fontSize: px(base + 1), lineHeight: px((base + 1) * 1.65) }]}>
            {renderSegs(segs, `tl${i}`)}
          </Text>
        )) : null}
      </View>,
    );
  }
  if (verse.purport) {
    const titled = !!(verse.translation || verse.synonyms);
    blocks.push(
      <View key="pp" style={s.section}>
        {titled ? heading('purport') : null}
        {isOpen('purport') || !titled ? paras.purport.map((segs, i) => (
          <Text key={i} selectable dataSet={{ lookup: 'en' }} style={[s.body, { color: colors.purport === colors.textSecondary ? colors.text : colors.purport, fontSize: px(base), lineHeight: px(base * 1.75) }]}>
            {renderSegs(segs, `pp${i}`)}
          </Text>
        )) : null}
      </View>,
    );
  }

  return <View ref={container} style={s.wrap}>{blocks}</View>;
}

const s = StyleSheet.create({
  wrap: { gap: 22 },
  pills: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { fontFamily: SANS, fontSize: 12, fontWeight: '600' },
  deva: { fontFamily: SERIF, textAlign: 'center', fontWeight: '500' },
  translit: { fontFamily: SERIF, fontStyle: 'italic', textAlign: 'center' },
  section: { gap: 14 },
  headingWrap: { alignSelf: 'center' },
  heading: { fontFamily: SERIF, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
  headingCaret: { fontFamily: SANS, fontSize: 12, position: 'absolute', right: -20, top: 0, bottom: 0, textAlignVertical: 'center', lineHeight: 30 },
  body: { fontFamily: SERIF },
  synWord: { fontStyle: 'italic' },
  translation: { fontWeight: '700' },
  cite: { textDecorationLine: 'none' },
  person: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});
