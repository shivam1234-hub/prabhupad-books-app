import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { Verse } from '@/types';
import {
  lookupWord, LookupResult, normalizeWord, POS_LABEL, PartOfSpeech, SandhiPart, SandhiResult, SandhiSource,
  Sense, VerseRef, WordMeaning,
} from '@/services/dictionary';
import type { ColorScheme } from '@/constants/colors';
import { GrammarGuide } from './GrammarGuide';
import { VerbBreakdown } from './VerbBreakdown';

interface Props {
  /** The word long-pressed / double-clicked; null keeps the sheet closed. */
  word: string | null;
  /** It came from the transliteration or a synonyms entry — read as Sanskrit. */
  sanskritFirst?: boolean;
  /** The verse on screen, whose own word-for-word is checked first. */
  verse?: Verse | null;
  onClose: () => void;
  /** Open one of the verses a meaning was found in. */
  onOpenVerse?: (ref: VerseRef) => void;
  /** Open the whole-verse analysis (sandhi, grammar, meanings). */
  onAnalyseVerse?: () => void;
}

/**
 * Offline meaning of a word from the verse screen. A bottom sheet on phones, a
 * centred card on a wide desktop window.
 */
export function WordMeaningSheet({ word, sanskritFirst = false, verse, onClose, onOpenVerse, onAnalyseVerse }: Props) {
  const { colors } = useTheme();
  const sc = useSettingsStore(s => s.settings.fontScale ?? 1);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const px = (n: number) => Math.round(n * sc);

  const [result, setResult] = useState<LookupResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!word) return;
    let cancelled = false;
    setResult(null);
    setFailed(false);
    setShowGuide(false);
    lookupWord(word, { sanskritFirst, verse })
      .then(r => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [word, sanskritFirst, verse?.id]);

  const grouped = useMemo(() => {
    const groups: { pos: PartOfSpeech; senses: Sense[] }[] = [];
    for (const s of result?.senses ?? []) {
      const last = groups[groups.length - 1];
      if (last && last.pos === s.pos) last.senses.push(s);
      else groups.push({ pos: s.pos, senses: [s] });
    }
    return groups;
  }, [result]);

  const title = result?.word || word || '';
  const sandhi = result?.sandhi ?? null;
  // The older per-piece breakdown is superseded by the sandhi card.
  const hasParts = !sandhi && (result?.parts.length ?? 0) > 0;
  const notFound = !!result && !result.meanings.length && !result.glossary && !grouped.length && !hasParts && !sandhi;
  const onlineUrl = result
    ? `https://sanskritdictionary.org/${encodeURIComponent(normalizeWord(result.word).replace(/-/g, ''))}`
    : '';

  const open = (ref: VerseRef) => { onClose(); onOpenVerse?.(ref); };

  const renderMeaning = (m: WordMeaning, i: number) => (
    <View key={i} style={styles.meaningRow}>
      <Text style={[styles.meaning, { color: colors.text, fontSize: px(15), lineHeight: px(22) }]}>
        {m.word.toLowerCase() !== title.toLowerCase() && (
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{m.word} — </Text>
        )}
        {m.meaning}
      </Text>
      <View style={styles.refRow}>
        {m.inThisVerse && (
          <Text style={[styles.refChip, styles.refChipHere, { color: colors.primary, borderColor: colors.primary }]}>
            in this verse
          </Text>
        )}
        {m.refs.map(r => (
          <Pressable key={r.label} onPress={() => open(r)} hitSlop={6}>
            <Text style={[styles.refChip, { color: colors.textSecondary, borderColor: colors.border }]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={!!word} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* The backdrop is its own layer behind the sheet, not a wrapper around
          it: a touchable parent takes slow drags away from the ScrollView on
          Android, so the sheet would not scroll. */}
      <View style={[styles.overlay, wide && styles.overlayWide]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
            wide ? styles.sheetWide : { paddingBottom: 16 + insets.bottom },
          ]}
        >
          {!wide && <View style={[styles.handle, { backgroundColor: colors.border }]} />}

          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.word, { color: colors.text, fontSize: px(24) }]} numberOfLines={1}>{title}</Text>
              {result?.headword && result.headword !== normalizeWord(result.word) && (
                <Text style={[styles.sub, { color: colors.textMuted, fontSize: px(13) }]}>
                  form of <Text style={{ fontWeight: '700' }}>{result.headword}</Text>
                </Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {showGuide && <GrammarGuide accentColor={colors.primary} />}
            {!showGuide && <>
            {sandhi && <SandhiCard sandhi={sandhi} word={title} colors={colors} px={px} />}

            {!result && !failed && (
              <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
            )}
            {failed && (
              <Text style={[styles.empty, { color: colors.textMuted, fontSize: px(14) }]}>
                The offline dictionary could not be opened.
              </Text>
            )}

            {!!result?.meanings.length && (
              <View style={[styles.block, { borderLeftColor: colors.primary }]}>
                <Text style={[styles.blockLabel, { color: colors.primary }]}>ŚRĪLA PRABHUPĀDA'S WORD-FOR-WORD</Text>
                {result.meanings.map(renderMeaning)}
              </View>
            )}

            {result?.glossary && (
              <View style={[styles.block, { borderLeftColor: colors.primary }]}>
                <Text style={[styles.blockLabel, { color: colors.primary }]}>GLOSSARY</Text>
                <Text style={[styles.glossTerm, { color: colors.primary, fontSize: px(16) }]}>{result.glossary.term}</Text>
                <Text style={[styles.meaning, { color: colors.text, fontSize: px(15), lineHeight: px(22) }]}>
                  {result.glossary.def}
                </Text>
              </View>
            )}

            {hasParts && result!.parts.map((part, i) => (
              <View key={i} style={[styles.block, { borderLeftColor: colors.border }]}>
                <Text style={[styles.glossTerm, { color: colors.primary, fontSize: px(15) }]}>{part.word}</Text>
                {part.meanings.map(renderMeaning)}
                {!part.meanings.length && part.glossary && (
                  <Text style={[styles.meaning, { color: colors.text, fontSize: px(15), lineHeight: px(22) }]}>
                    {part.glossary.def}
                  </Text>
                )}
                {!part.meanings.length && !part.glossary && (
                  <Text style={[styles.empty, styles.emptyInline, { color: colors.textMuted, fontSize: px(13) }]}>
                    not found offline
                  </Text>
                )}
              </View>
            ))}

            {grouped.map(({ pos, senses }, gi) => (
              <View key={`${pos}-${gi}`} style={styles.posGroup}>
                <Text style={[styles.pos, { color: colors.primary, fontSize: px(12) }]}>{POS_LABEL[pos]}</Text>
                {senses.map((s, i) => (
                  <View key={i} style={styles.senseRow}>
                    <Text style={[styles.senseNum, { color: colors.textMuted, fontSize: px(14), lineHeight: px(22) }]}>{i + 1}.</Text>
                    <Text style={[styles.meaning, { flex: 1, color: colors.text, fontSize: px(15), lineHeight: px(22) }]}>{s.def}</Text>
                  </View>
                ))}
              </View>
            ))}

            {notFound && (
              <Text style={[styles.empty, { color: colors.textMuted, fontSize: px(14) }]}>
                No offline meaning found for “{title}”.{result?.isSanskrit ? ' Downloading more books adds more of Śrīla Prabhupāda\'s word-for-word meanings.' : ''}
              </Text>
            )}

            {(notFound || hasParts) && (
              <Pressable
                onPress={() => Linking.openURL(onlineUrl)}
                style={[styles.onlineBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.onlineText, { color: colors.primary, fontSize: px(14) }]}>
                  Look up on sanskritdictionary.org ↗
                </Text>
                <Text style={[styles.onlineSub, { color: colors.textMuted, fontSize: px(11) }]}>
                  Śrīla Prabhupāda's word-for-word translations · needs a connection
                </Text>
              </Pressable>
            )}
            </>}
          </ScrollView>

          {(sandhi || result?.isSanskrit) && (
            <View style={styles.actions}>
              {onAnalyseVerse && !!verse?.transliteration && (
                <Pressable onPress={onAnalyseVerse} style={[styles.actionBtn, { borderColor: colors.primary }]}>
                  <Text style={[styles.actionText, { color: colors.primary, fontSize: px(13) }]}>Analyse the whole verse</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setShowGuide(g => !g)} style={[styles.actionBtn, { borderColor: colors.primary }]}>
                <Text style={[styles.actionText, { color: colors.primary, fontSize: px(13) }]}>
                  {showGuide ? '‹ Back to the word' : 'Grammar guide'}
                </Text>
              </Pressable>
            </View>
          )}

          <Text style={[styles.source, { color: colors.textMuted }]}>
            {grouped.length
              ? 'Offline · English: WordNet 3.0 (Princeton)'
              : sandhi?.from === 'offline'
                ? "Offline · meanings from Śrīla Prabhupāda's books in your library · word list for splitting: Apte (CC BY-SA)"
                : "Offline · from Śrīla Prabhupāda's books in your library"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const SOURCE_LABEL: Record<SandhiSource, string> = {
  prabhupada: 'Śrīla Prabhupāda · this verse',
  library: 'Śrīla Prabhupāda',
  particle: 'common word-for-word',
  glossary: 'glossary, in Śrīla Prabhupāda\'s usage',
  apte: '',
  derived: 'built from its parts',
};

/** "Śrīla Prabhupāda · BG 9.6", then his other renderings with theirs. */
const sourceText = (p: SandhiPart) =>
  p.source === 'library'
    ? [`Śrīla Prabhupāda${p.ref ? ` · ${p.ref.label}` : ''}`,
      ...p.alsoRendered.map(a => `also “${a.meaning}”${a.ref ? ` (${a.ref.label})` : ''}`)].join(' · ') : p.source ? SOURCE_LABEL[p.source] : '';

/** A meaning's first clause, for the one-line split ("Desire; lust — …" → "desire"). */
function shortMeaning(meaning: string | null): string {
  if (!meaning) return '';
  const first = meaning.split(/[;—(]/)[0].replace(/\.$/, '').trim();
  const cut = first.length > 40 ? first.slice(0, 38).replace(/\s\S*$/, '') + '…' : first;
  // "The original…" → "the original…", but names ("Kṛṣṇa") keep their capital.
  // Lower-case like running text, but names keep their capital: "Kṛṣṇa, …",
  // "Arjuna, the son of Pṛthā", anything with diacritics or a following comma.
  const firstWord = cut.split(/[\s,]/)[0];
  const isName = /[^\x00-\x7F]/.test(firstWord) || /^[^\s]+,/.test(cut)
    || ['Arjuna', 'Brahman', 'Veda', 'Vedas', 'Lord', 'God'].includes(firstWord);
  return isName || /^(O|I)(\s|$)/.test(cut) ? cut : cut.charAt(0).toLowerCase() + cut.slice(1);
}

/** Capitalised, as Apte's compound senses start lower-case. */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Sandhi-viccheda of the word: the words it separates into, the rule that
 * joined them, and each word's grammar and meaning with its source.
 */
function SandhiCard({ sandhi, word, colors, px }: {
  sandhi: SandhiResult; word: string; colors: ColorScheme; px: (n: number) => number;
}) {
  const his = sandhi.from === 'prabhupada';
  const split = sandhi.parts.length > 1 || sandhi.parts[0]?.members.length > 1
    || sandhi.parts[0]?.word.toLowerCase() !== word.toLowerCase();
  // Several words sharing one meaning in his list show that meaning once.
  const rows: SandhiPart[] = [];
  for (const p of sandhi.parts) {
    const prev = rows[rows.length - 1];
    if (prev && p.entryWords && prev.entryWords === p.entryWords) continue;
    rows.push(p);
  }
  const rules = sandhi.parts.flatMap(p => [p.start, p.join]).filter(Boolean);
  return (
    <View style={[styles.block, { borderLeftColor: his ? colors.primary : colors.border }]}>
      <Text style={[styles.blockLabel, { color: colors.primary }]}>
        {!split ? 'GRAMMAR' : his ? `SANDHI-VICCHEDA · WORD-FOR-WORD, ${sandhi.verse}` : 'SANDHI-VICCHEDA · COMPUTED OFFLINE'}
      </Text>
      {split && (
        <Text style={[styles.equation, { color: colors.text, fontSize: px(16) }]}>
          {word} <Text style={{ color: colors.textMuted, fontWeight: '400', fontStyle: 'normal' }}>=</Text>{' '}
          {sandhi.parts.flatMap(p => (p.members.length > 1 ? p.members : [p])).map((p, k, all) => (
            <Text key={k}>
              {k > 0 ? ' + ' : ''}{p.word}
              {all.length > 1 && shortMeaning(p.meaning)
                ? <Text style={{ color: colors.textMuted, fontWeight: '400', fontStyle: 'normal' }}>{` (${shortMeaning(p.meaning)})`}</Text>
                : null}
            </Text>
          ))}
        </Text>
      )}
      {rules.map((j, i) => (
        <Text key={`r${i}`} style={[styles.rule, { color: colors.textMuted, fontSize: px(12), lineHeight: px(17) }]}>{j!.rule}</Text>
      ))}
      {rows.map((p, i) => (
        <View key={i} style={styles.meaningRow}>
          <Text style={[styles.glossTerm, { color: colors.primary, fontSize: px(15) }]}>
            {p.entryWords ? p.entryWords.join(' ') : p.word}
            {p.stem ? <Text style={{ color: colors.textMuted, fontStyle: 'normal', fontWeight: '400' }}>{p.verb ? `  √${p.stem}` : `  (${p.stem})`}</Text> : null}
          </Text>
          {p.grammar && (
            <Text style={{ color: colors.textSecondary, fontSize: px(13), lineHeight: px(19) }}>
              {p.grammar.note ?? `${p.grammar.best!.stem} · ${p.grammar.best!.form}`}
              {!!p.grammar.others.length && <Text style={{ color: colors.textMuted }}>{`  (or ${p.grammar.others[0].form})`}</Text>}
            </Text>
          )}
          {/* An unsplit word of this verse: his meaning is already in the
              word-for-word block below, so only its grammar is shown here. */}
          {p.grammar?.verb && <VerbBreakdown verb={p.grammar.verb} form={p.word} />}
          {!p.grammar?.verb && p.grammar?.origin && (
            <View style={{ marginTop: 3, marginBottom: 3, paddingLeft: 8, borderLeftWidth: 2, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontSize: px(13), lineHeight: px(19) }}>
                From <Text style={{ color: colors.text, fontWeight: '700', fontStyle: 'italic' }}>{p.grammar.origin.base}</Text>
                {p.grammar.origin.baseMeaning ? ` — ${p.grammar.origin.baseMeaning.replace(/\.$/, '')}` : ''}
              </Text>
              {p.grammar.origin.steps.map((st, k) => (
                <Text key={k} style={{ color: colors.textMuted, fontSize: px(12), lineHeight: px(17) }}>{st}</Text>
              ))}
            </View>
          )}
          {!split && his ? null : p.meaning ? (
            <Text style={[styles.meaning, { color: colors.text, fontSize: px(15), lineHeight: px(22) }]}>{sentence(p.meaning)}</Text>
          ) : (
            <Text style={[styles.empty, styles.emptyInline, { color: colors.textMuted, fontSize: px(13) }]}>
              Not in Śrīla Prabhupāda's word-for-word in your library yet
            </Text>
          )}
          {!!p.original && (!split && his ? false : true) && (
            <Text style={{ color: colors.textMuted, fontSize: px(12), lineHeight: px(17), marginTop: 2 }}>
              Śrīla Prabhupāda: “{p.original}”
            </Text>
          )}
          {!!p.meaning && !!sourceText(p) && (p.source !== 'prabhupada' || !his) && (
            <Text style={{ color: colors.textMuted, fontSize: px(11), marginTop: 2 }}>{sourceText(p)}</Text>
          )}
          {p.members.length > 1 && (
            <View style={{ marginTop: 4, paddingLeft: 10 }}>
              {p.members.map((m, j) => (
                <Text key={j} style={{ color: colors.text, fontSize: px(13), lineHeight: px(19) }}>
                  <Text style={{ color: colors.primary, fontStyle: 'italic' }}>{m.word}</Text>
                  {m.meaning ? ` — ${sentence(m.meaning)}` : ''}
                  {m.meaning && sourceText(m) ? <Text style={{ color: colors.textMuted }}>{`  · ${sourceText(m)}`}</Text> : null}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
      {!his && (
        <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: px(12), lineHeight: px(17) }}>
          The split is computed offline. Every meaning shown is Śrīla Prabhupāda's own, from his word-for-word; words he doesn't gloss in your library show none.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  equation: { fontWeight: '700', fontStyle: 'italic', marginBottom: 6 },
  rule: { marginBottom: 6, marginTop: -2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionBtn: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  actionText: { fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  overlayWide: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10,
    maxHeight: '75%', borderWidth: StyleSheet.hairlineWidth,
  },
  sheetWide: { width: '100%', maxWidth: 580, borderRadius: 16, paddingTop: 18, paddingBottom: 14 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  word: { fontWeight: '800' },
  sub: { marginTop: 2 },
  closeBtn: { padding: 4, marginLeft: 8 },
  closeText: { fontSize: 18, fontWeight: '600' },
  // flexShrink lets the scroll area give way to the sheet's maxHeight. With
  // flexGrow: 0 alone it takes its full content height and the sheet merely
  // clips it — on Android that leaves nothing to scroll.
  body: { flexGrow: 0, flexShrink: 1 },
  centered: { paddingVertical: 28, alignItems: 'center' },
  empty: { fontStyle: 'italic', paddingVertical: 12 },
  emptyInline: { paddingVertical: 0 },
  block: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 2, marginBottom: 14 },
  blockLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  glossTerm: { fontWeight: '700', fontStyle: 'italic', marginBottom: 4 },
  meaningRow: { marginBottom: 10 },
  meaning: {},
  refRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  refChip: {
    fontSize: 11, fontWeight: '600', borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  refChipHere: { fontWeight: '800' },
  posGroup: { marginBottom: 12 },
  pos: { fontWeight: '700', fontStyle: 'italic', marginBottom: 4 },
  senseRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  senseNum: { minWidth: 18 },
  onlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 },
  onlineText: { fontWeight: '600' },
  onlineSub: { marginTop: 2 },
  source: { fontSize: 11, marginTop: 8, textAlign: 'center' },
});
