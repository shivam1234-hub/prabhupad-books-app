import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import type { ColorScheme } from '@/constants/colors';
import { Verse } from '@/types';
import { analyseVerse, SandhiPart, VerseAnalysis, WordOrigin } from '@/services/dictionary';
import { CASES } from '@/services/sanskrit/sanskritGrammar';
import { GrammarGuide } from './GrammarGuide';
import { VerbBreakdown } from './VerbBreakdown';
import { caseAndNumber, sentenceWordsOf, short, unanalysedPart } from '@/services/sanskrit/ruleWords';
import {
  buildSentenceMap, detectSentenceRules, linkAcrossVerses, MapGroup, MapWord, MappedWord, rolesOf, RuleWord, sentenceContinues,
} from '@/services/sanskrit/sentenceRules';
import { fetchVerse } from '@/services/vedabaseApi';

interface Props {
  /** The verse to analyse; null keeps the sheet closed. */
  verse: Verse | null;
  onClose: () => void;
}

const SOURCE_TAG: Record<string, string> = {
  prabhupada: 'Śrīla Prabhupāda · this verse',
  library: 'Śrīla Prabhupāda',
  particle: 'common word-for-word',
  glossary: 'glossary, in Śrīla Prabhupāda\'s usage',
  derived: 'built from its parts',
};

/** "Śrīla Prabhupāda · BG 9.6", then his other renderings with theirs. */
const sourceText = (p: SandhiPart) =>
  p.source === 'library'
    ? [`Śrīla Prabhupāda${p.ref ? ` · ${p.ref.label}` : ''}`,
      ...p.alsoRendered.map(a => `also “${a.meaning}”${a.ref ? ` (${a.ref.label})` : ''}`)].join(' · ') : (p.source && SOURCE_TAG[p.source]) || '';

/**
 * Whole-verse worksheet for the verse on screen:
 *   1. sandhi-viccheda — each written word, the words it separates into and
 *      the rule that joined them;
 *   2. word meanings — each word's grammar (stem, gender, vibhakti, number;
 *      or root, tense, person) and meaning;
 *   3. how the words fit — the words grouped by case, since words in one
 *      case usually describe the same thing.
 * The split and meanings are Śrīla Prabhupāda's word-for-word for this verse
 * wherever it covers a word; anything else is computed offline and labelled.
 * A "Grammar guide" tab explains every label.
 */
export function VerseAnalysisSheet({ verse, onClose }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fs = useSettingsStore(s => s.settings.fontScale ?? 1);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const t = (size: number) => ({ fontSize: size * fs, lineHeight: size * fs * 1.45 });

  const [analysis, setAnalysis] = useState<VerseAnalysis | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<'analysis' | 'guide'>('analysis');

  useEffect(() => {
    if (!verse) return;
    let cancelled = false;
    setAnalysis(null);
    setFailed(false);
    setTab('analysis');
    analyseVerse(verse)
      .then(a => { if (!cancelled) setAnalysis(a); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [verse?.id]);

  // Every word of the verse — one that couldn't be analysed is listed as
  // such, never dropped.
  const wordsOf = (lines: VerseAnalysis['lines']): SandhiPart[] =>
    lines.flatMap(l => l.tokens.flatMap(tk => tk.sandhi?.parts ?? [unanalysedPart(tk.written)]));
  const words: SandhiPart[] = useMemo(() => wordsOf(analysis?.lines ?? []), [analysis]);
  // The speaker line ("sañjaya uvāca") is a sentence of its own: the verse's
  // sentence rules and map leave it out.
  const heading = analysis?.lines.find(l => l.heading) ?? null;
  const headingWords: SandhiPart[] = useMemo(() => (heading ? wordsOf([heading]) : []), [heading]);
  const sentence_ = useMemo(() => sentenceWordsOf(analysis?.lines ?? []), [analysis]);
  const sentenceWords: SandhiPart[] = sentence_.parts;

  // Which sentence rules are at work in this verse, and the sentence's shape.
  const ruleWords = sentence_.rules;
  const rules = useMemo(() => detectSentenceRules(ruleWords), [ruleWords]);
  // Each word's role, shown in the word list ("object of avāpya").
  const roleOf = useMemo(() => {
    const roles = rolesOf(ruleWords);
    return new Map(sentenceWords.map((p, i) => [p, roles[i]]));
  }, [ruleWords, sentenceWords]);
  const mapped: MappedWord[] = useMemo(
    () => ruleWords.map((r, i) => ({ ...r, meaning: short(sentenceWords[i].meaning) || null })),
    [ruleWords, sentenceWords],
  );
  const sentenceMap = useMemo(() => (mapped.length ? buildSentenceMap(mapped) : null), [mapped]);

  // A verse end is not a sentence end: when the sentence runs on (a yad
  // with no tad, or no verb), analyse the next verse and show the links.
  const [carryOn, setCarryOn] = useState<{ label: string; lines: string[] } | null>(null);
  useEffect(() => {
    setCarryOn(null);
    if (!verse || !analysis || !sentenceContinues(ruleWords)) return;
    const last = parseInt(String(verse.verseRange ?? verse.verse).split('-').pop() ?? '', 10);
    if (isNaN(last)) return;
    let cancelled = false;
    (async () => {
      const next = await fetchVerse(verse.bookSlug, verse.chapter, String(last + 1), verse.canto, verse.language as any).catch(() => null);
      if (!next || cancelled) return;
      const a = await analyseVerse(next);
      const nextSw = sentenceWordsOf(a.lines);
      const nextMapped = nextSw.rules.map((r, i) => ({ ...r, meaning: short(nextSw.parts[i].meaning) || null }));
      const lines = linkAcrossVerses(mapped, nextMapped, a.verse);
      if (!cancelled && lines.length) setCarryOn({ label: a.verse, lines });
    })();
    return () => { cancelled = true; };
  }, [analysis, ruleWords]);

  // Words grouped by their best reading's case; verbs in their own group.
  const groups = useMemo(() => {
    const byCase = new Map<number, string[]>();
    const verbs: string[] = [];
    const put = (no: number, w: string) => byCase.set(no, [...(byCase.get(no) ?? []), w]);
    for (const part of words) {
      const g = part.grammar;
      if (g?.best?.case) put(g.best.case, part.word);
      else if (g?.best) verbs.push(part.word);
      else if (g?.note) {
        // Only a note that names one case ("idam · locative singular");
        // "te" (nominative plural, or genitive/dative singular) stays out.
        const cases = g.note.match(/nominative|accusative|instrumental|dative|ablative|genitive|locative|vocative/g) ?? [];
        const m = cases.length === 1 && !/\bor\b/.test(g.note) ? [cases[0], cases[0]] : null;
        const k = m ? CASES.find(x => x.english === m[1]) : undefined;
        if (k) put(k.no, part.word);
        else if (g.note.startsWith('√')) verbs.push(part.word);
      }
    }
    return { byCase: [...byCase.entries()].sort((a, b) => a[0] - b[0]), verbs };
  }, [words]);

  const sourceLine = !analysis ? '' : analysis.coverage === 'prabhupada'
    ? `Split and meanings: Śrīla Prabhupāda's word-for-word, ${analysis.verse} (simpler wording, same sense) · grammar computed offline`
    : analysis.coverage === 'mixed'
      ? `Śrīla Prabhupāda's word-for-word (${analysis.verse}) where it covers a word; the rest computed offline`
      : 'Split computed offline — meanings are Śrīla Prabhupāda\'s word-for-word from elsewhere in your library';

  return (
    <Modal visible={!!verse} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* The backdrop is its own layer behind the sheet, not a wrapper around
          it: a touchable parent takes slow drags away from the ScrollView on
          Android, so the sheet would not scroll. */}
      <View style={[styles.overlay, wide && styles.overlayWide]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, wide ? styles.sheetWide : { paddingBottom: 16 + insets.bottom }]}>
          {!wide && <View style={styles.handle} />}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, t(10)]}>VERSE ANALYSIS{analysis ? ` · ${analysis.verse}` : ''}</Text>
              <Text style={[styles.subtitle, t(13)]}>Sandhi-viccheda, grammar and word meanings</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: c.textMuted }]}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.tabs}>
            {(['analysis', 'guide'] as const).map(id => (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[styles.tab, tab === id && { borderColor: c.primary, backgroundColor: c.primary + '1f' }]}
              >
                <Text style={[styles.tabText, t(13), tab === id && { color: c.primary }]}>
                  {id === 'analysis' ? 'Analysis' : 'Grammar guide'}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {tab === 'guide' && <GrammarGuide accentColor={c.primary} />}

            {tab === 'analysis' && !analysis && !failed && (
              <View style={styles.centered}><ActivityIndicator color={c.primary} /></View>
            )}
            {tab === 'analysis' && failed && (
              <Text style={[styles.empty, t(14)]}>This verse could not be analysed.</Text>
            )}
            {tab === 'analysis' && analysis && !analysis.lines.length && (
              <Text style={[styles.empty, t(14)]}>This verse has no transliteration to analyse.</Text>
            )}

            {tab === 'analysis' && analysis && analysis.lines.length > 0 && (
              <>
                <Text style={[styles.h, t(11)]}>SANDHI-VICCHEDA · SEPARATING THE WORDS</Text>
                {analysis.lines.map((line, li) => (
                  <View key={li} style={styles.lineBlock}>
                    <Text style={[styles.lineText, t(15)]}>{line.text}</Text>
                    {line.tokens.map((tk, i) => {
                      const parts = tk.sandhi?.parts ?? [];
                      // Every word down to compound members: "veda-vāda-ratāḥ"
                      // → veda + vāda + ratāḥ.
                      const pieceParts = parts.flatMap(p => (p.members.length > 1 ? p.members : [p]));
                      const pieces = pieceParts.map(p => p.word);
                      const compound = parts.some(p => p.members.length > 1);
                      const changed = pieces.length > 1 || (pieces[0] !== undefined && pieces[0] !== tk.written);
                      const rules = parts
                        .flatMap(p => [p.start && `${p.word}: ${p.start.rule}`, p.join && `${p.word}: ${p.join.rule}`])
                        .filter((r): r is string => !!r);
                      if (compound) rules.push('Samāsa: a compound — the words are joined and only the last takes an ending');
                      return (
                        <View key={i} style={styles.tokenRow}>
                          <Text style={[styles.token, t(14)]}>
                            {tk.written}
                            {changed && (
                              <Text style={styles.split}>
                                {'  →  '}
                                {pieceParts.map((p, k) => (
                                  <Text key={k}>
                                    {k > 0 ? ' + ' : ''}{p.word}
                                    {pieceParts.length > 1 && short(p.meaning)
                                      ? <Text style={styles.dim}>{` (${short(p.meaning)})`}</Text> : null}
                                  </Text>
                                ))}
                              </Text>
                            )}
                            {!changed && parts.length > 0 && <Text style={styles.dim}>{'  '}(one word, no sandhi change)</Text>}
                            {!parts.length && <Text style={styles.dim}>{'  '}(unanalysed: not found in Śrīla Prabhupāda's word-for-word, and no split could be confirmed)</Text>}
                          </Text>
                          {rules.map((r, j) => <Text key={j} style={[styles.rule, t(12)]}>{r}</Text>)}
                        </View>
                      );
                    })}
                  </View>
                ))}

                <Text style={[styles.h, t(11)]}>WORD MEANINGS</Text>
                {words.map((part, i) => {
                  const g = part.grammar;
                  return (
                    <View key={i} style={styles.wordRow}>
                      <Text style={[styles.word, t(15)]}>{part.word}</Text>
                      {g?.note && <Text style={[styles.grammar, t(13)]}>{g.note}</Text>}
                      {g?.best && (
                        <Text style={[styles.grammar, t(13)]}>
                          {g.best.stem} · <Text style={styles.strong}>{g.best.form}</Text>
                          {g.best.sanskrit ? <Text style={styles.dim}>{`  (${g.best.sanskrit})`}</Text> : null}
                        </Text>
                      )}
                      {!!g?.others.length && (
                        <Text style={[styles.dim, t(12)]}>or {g.others.map(o => o.form).join('; or ')}</Text>
                      )}
                      {!g && <Text style={[styles.dim, t(12)]}>grammar not found</Text>}
                      {!!roleOf.get(part) && (
                        <Text style={[styles.grammar, t(12)]}>
                          <Text style={styles.strong}>Role: </Text>{roleOf.get(part)}
                        </Text>
                      )}
                      {g?.verb
                        ? <VerbBreakdown verb={g.verb} form={part.word} agreement={agreementFor(g.verb.person, g.verb.number, sentenceWords.includes(part) ? sentenceWords : headingWords)} />
                        : g?.origin && <Origin origin={g.origin} styles={styles} t={t} />}
                      <Text style={[styles.meaning, t(14)]}>
                        {part.meaning
                          ? sentence(part.meaning)
                          : <Text style={styles.dim}>Not in Śrīla Prabhupāda's word-for-word in your library yet</Text>}
                        {!!part.meaning && part.source !== 'prabhupada' && !!sourceText(part) && (
                          <Text style={styles.dim}>{`  · ${sourceText(part)}`}</Text>
                        )}
                      </Text>
                      {!!part.original && (
                        <Text style={[styles.dim, t(12)]}>Śrīla Prabhupāda: “{part.original}”</Text>
                      )}
                      {!!part.phrase && (
                        <Text style={[styles.dim, t(12)]}>
                          Part of the phrase “{part.phrase.words}”: Śrīla Prabhupāda — “{part.phrase.meaning}”
                        </Text>
                      )}
                      {part.unanalysed && (
                        <Text style={[styles.dim, t(12)]}>Unanalysed: shown so no word is left out.</Text>
                      )}
                      {part.members.length > 1 && (
                        <View style={styles.memberList}>
                          <Text style={[styles.dim, t(12)]}>The words of the compound:</Text>
                          {part.members.map((m, j) => (
                            <View key={j} style={styles.memberRow}>
                              <Text style={[styles.memberWord, t(14)]}>{m.word}</Text>
                              {m.grammar && (
                                <Text style={[styles.grammar, t(12)]}>
                                  {m.grammar.note ?? `${m.grammar.best!.stem} · ${m.grammar.best!.form}`}
                                </Text>
                              )}
                              {m.grammar?.origin && <Origin origin={m.grammar.origin} styles={styles} t={t} />}
                              <Text style={[styles.meaning, t(13)]}>
                                {m.meaning
                                  ? sentence(m.meaning)
                                  : <Text style={styles.dim}>Not in Śrīla Prabhupāda's word-for-word in your library yet</Text>}
                                {!!m.meaning && !!sourceText(m) && <Text style={styles.dim}>{`  · ${sourceText(m)}`}</Text>}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}

                {heading && (
                  <>
                    <Text style={[styles.h, t(11)]}>HEADING · A SENTENCE OF ITS OWN</Text>
                    <Text style={[styles.meaning, t(13)]}>
                      <Text style={styles.mapWord}>{heading.text}</Text>
                      {' — '}{heading.tokens.map(tk => tk.sandhi?.parts[0]?.phrase?.meaning ?? '').find(Boolean) ?? ''}
                    </Text>
                    <Text style={[styles.dim, t(12)]}>
                      The speaker line is separate from the verse's sentence: its doer is the speaker, its verb uvāca.
                    </Text>
                  </>
                )}

                {sentenceMap && (sentenceMap.clauses.length > 0 || sentenceMap.doers) && (
                  <>
                    <Text style={[styles.h, t(11)]}>SENTENCE MAP · WHO DOES WHAT</Text>
                    {sentenceMap.clauses.map((cl, ci) => (
                      <View key={ci} style={styles.clause}>
                        <Text style={[styles.clauseHead, t(12)]}>
                          {sentence(cl.kind)} · <Text style={styles.mapWord}>{cl.verb.word}</Text>
                          {cl.verb.meaning ? ` (${cl.verb.meaning})` : ''}
                        </Text>
                        {cl.doer
                          ? <MapTree title="Doer" group={cl.doer} styles={styles} t={t} />
                          : !!cl.impliedDoer && <Text style={[styles.meaning, t(13)]}><Text style={styles.strong}>Doer: </Text>{cl.impliedDoer}</Text>}
                        {cl.coDoers.map((d, i) => (
                          <MapTree key={`cd${i}`} title="Doer (joined by ca)" group={d} styles={styles} t={t} />
                        ))}
                        {(cl.sameDoer ?? []).map((d, i) => (
                          <MapTree key={`sd${i}`} title="Also the doer (same person)" group={d} styles={styles} t={t} />
                        ))}
                        {(cl.predicates ?? []).map((d, i) => (
                          <MapTree key={`pr${i}`} title="Predicate (what the subject is)" group={d} styles={styles} t={t} />
                        ))}
                        {cl.objects.map((o, i) => (
                          <MapTree key={`o${i}`} title="Object" group={o.group} note={o.note} styles={styles} t={t} />
                        ))}
                        {cl.gerunds.map((g, gi) => (
                          <View key={`gz${gi}`}>
                            <Text style={[styles.meaning, t(13)]}>
                              <Text style={styles.strong}>Gerund (same doer): </Text>
                              <Text style={styles.mapWord}>{g.word.word}</Text>{g.word.meaning ? ` (${g.word.meaning})` : ''} — "having …"
                            </Text>
                            {g.objects.map((o, i) => (
                              <MapTree key={`go${i}`} title={`Object of ${g.word.word}`} group={o.group} note={o.note} styles={styles} t={t} />
                            ))}
                          </View>
                        ))}
                      </View>
                    ))}
                    {sentenceMap.clauseObject && (
                      <Text style={[styles.meaning, t(13)]}>
                        <Text style={styles.strong}>Clause as object: </Text>
                        [{sentenceMap.clauseObject.from} … {sentenceMap.clauseObject.to}] is the object of{' '}
                        <Text style={styles.mapWord}>{sentenceMap.clauseObject.of}</Text>
                      </Text>
                    )}
                    {sentenceMap.quoted && (
                      <Text style={[styles.meaning, t(13)]}>
                        <Text style={styles.strong}>Quotation (closed by iti): </Text>“{sentenceMap.quoted.words}”
                        {sentenceMap.quoted.verbs.length ? <Text style={styles.dim}>{`  — its own verb: ${sentenceMap.quoted.verbs.join(', ')}`}</Text> : null}
                      </Text>
                    )}
                    {sentenceMap.governed.map((g, i) => (
                      <Text key={`g${i}`} style={[styles.meaning, t(13)]}>
                        <Text style={styles.strong}>Fixed by a neighbour: </Text>
                        <Text style={styles.mapWord}>{g.word.word}</Text> ← {g.by} ("{g.sense}"){g.word.meaning ? ` — ${g.word.meaning}` : ''}
                      </Text>
                    ))}
                    {sentenceMap.addressed.length > 0 && (
                      <Text style={[styles.meaning, t(13)]}>
                        <Text style={styles.strong}>Addressed: </Text>
                        {sentenceMap.addressed.map(a => `${a.word}${a.meaning ? ` (${a.meaning})` : ''}`).join(', ')}
                      </Text>
                    )}
                    {sentenceMap.others.map(o => o.groups.map((g, i) => (
                      <MapTree key={`${o.label}${i}`} title={sentence(o.label)} group={g} styles={styles} t={t} />
                    )))}
                    {sentenceMap.depends.length > 0 && (
                      <Text style={[styles.meaning, t(13)]}>
                        <Text style={styles.strong}>Genitives ("of …") and the word each depends on: </Text>
                        {sentenceMap.depends.map(d => `${d.word} → ${d.on}`).join('; ')}
                      </Text>
                    )}

                    {sentenceMap.askWho.length > 0 && (
                      <>
                        <Text style={[styles.h, t(11)]}>ASK “WHO?” · WHAT EACH DESCRIPTION DESCRIBES</Text>
                        {sentenceMap.askWho.map((a, i) => (
                          <Text key={i} style={[styles.meaning, t(13)]}>
                            <Text style={styles.mapWord}>{a.word}</Text> → {a.describes}
                            <Text style={styles.dim}>{`  (${a.why})`}</Text>
                          </Text>
                        ))}
                        <Text style={[styles.dim, t(12)]}>The matching ending is the link, not the word's position.</Text>
                      </>
                    )}
                  </>
                )}

                {carryOn && (
                  <>
                    <Text style={[styles.h, t(11)]}>{`THE SENTENCE CONTINUES IN ${carryOn.label}`}</Text>
                    <Text style={[styles.dim, t(12), { marginBottom: 4 }]}>
                      A verse ending does not end the sentence — keep reading until you find the verb and all its connected words.
                    </Text>
                    {carryOn.lines.map((l, i) => <Text key={i} style={[styles.meaning, t(13), { marginBottom: 4 }]}>• {l}</Text>)}
                  </>
                )}

                {rules.length > 0 && (
                  <>
                    <Text style={[styles.h, t(11)]}>SENTENCE RULES IN THIS VERSE</Text>
                    {rules.map((r, i) => (
                      <View key={i} style={styles.ruleRow}>
                        <Text style={[styles.ruleNo, t(12)]}>{r.no}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.strong, t(13)]}>{r.title}</Text>
                          <Text style={[styles.meaning, t(13)]}>{r.text}</Text>
                        </View>
                      </View>
                    ))}
                    <Text style={[styles.dim, t(11)]}>The numbers match the Sentences section of the Grammar guide.</Text>
                  </>
                )}

              </>
            )}
          </ScrollView>
          {tab === 'analysis' && !!sourceLine && <Text style={[styles.source, { color: c.textMuted }]}>{sourceLine}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const NUMBER_NAME = ['singular', 'dual', 'plural'];



/** One group of the sentence map: the head word and what describes it. */
function MapTree({ title, group, note, styles, t }: {
  title: string; group: MapGroup; note?: string; styles: ReturnType<typeof makeStyles>; t: (n: number) => object;
}) {
  const branches: (MapWord & { pointer?: boolean })[] = [
    ...group.pointers.map(p => ({ ...p, pointer: true })),
    ...group.descriptions,
  ];
  return (
    <View style={styles.mapGroup}>
      <Text style={[styles.dim, t(11)]}>{title} · {group.label}</Text>
      <Text style={[styles.meaning, t(14)]}>
        <Text style={styles.mapWord}>{group.head.word}</Text>{group.head.meaning ? ` — ${group.head.meaning}` : ''}
      </Text>
      {!!note && <Text style={[styles.dim, t(12)]}>{note}</Text>}
      {branches.map((b, i) => (
        <Text key={i} style={[styles.meaning, t(13)]}>
          <Text style={styles.dim}>{i === branches.length - 1 ? ' └─ ' : ' ├─ '}</Text>
          <Text style={styles.mapWord}>{b.word}</Text>
          {b.meaning ? ` — ${b.meaning}` : ''}
          {b.says ? <Text style={styles.dim}>{` · ${b.says}`}</Text> : null}
          {b.pointer ? <Text style={styles.dim}>  (points to it)</Text> : null}
        </Text>
      ))}
      {group.genitives.map((gw, i) => (
        <Text key={`gen${i}`} style={[styles.meaning, t(13)]}>
          <Text style={styles.dim}>{' ·  of: '}</Text>
          <Text style={styles.mapWord}>{gw.word}</Text>{gw.meaning ? ` — ${gw.meaning}` : ''}
        </Text>
      ))}
    </View>
  );
}




/**
 * Which word of the verse a verb ending agrees with: a 3rd-person verb with
 * the nominatives of the same number (the doers), a 2nd-person one with
 * "you" or whoever is addressed, a 1st-person one with "I / we".
 */
function agreementFor(person: 1 | 2 | 3, num: number, words: SandhiPart[]): string {
  const numName = NUMBER_NAME[num];
  const pick = (w: string[]) => words.filter(p => w.includes(p.word)).map(p => p.word);
  if (person === 3) {
    const doers = words.filter(p => {
      const cn = caseAndNumber(p);
      if (cn) return cn.case === 'nominative' && cn.number === numName;
      // "neuter nominative/accusative singular" (anyat): nominative is one
      // of its readings, so it may be the doer.
      const text = p.grammar?.best?.form ?? p.grammar?.note ?? '';
      return /nominative/.test(text) && text.includes(numName) && !/\bor\b/.test(text);
    }).map(p => p.word);
    return doers.length
      ? `${doers.join(', ')} — nominative ${numName} (the doer${num ? 's' : ''}); the ending matches in number and person`
      : `the doer is not named in this line; the ending itself says "${['he / she / it', 'the two', 'they'][num]}"`;
  }
  if (person === 2) {
    const you = pick(['tvam', 'yūyam', 'yuvām']);
    const called = words.filter(p => caseAndNumber(p)?.case === 'vocative').map(p => p.word);
    return you.length ? `${you.join(', ')} (you)` : called.length
      ? `the one addressed — ${called.join(', ')} (vocative)` : 'the person spoken to ("you")';
  }
  const me = pick(['aham', 'vayam', 'āvām']);
  return me.length ? `${me.join(', ')} (I / we)` : 'the speaker ("I / we")';
}

/** "From idam — this", then how idam became the written word. */
function Origin({ origin, styles, t }: {
  origin: WordOrigin; styles: ReturnType<typeof makeStyles>; t: (n: number) => object;
}) {
  return (
    <View style={styles.origin}>
      <Text style={[styles.originHead, t(13)]}>
        From <Text style={styles.originBase}>{origin.base}</Text>
        {origin.baseMeaning ? <Text style={styles.grammar}>{` — ${origin.baseMeaning.replace(/\.$/, '')}`}</Text> : null}
      </Text>
      {origin.steps.map((st, i) => <Text key={i} style={[styles.originStep, t(12)]}>{st}</Text>)}
    </View>
  );
}

const makeStyles = (c: ColorScheme) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  overlayWide: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10,
    maxHeight: '88%',
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  sheetWide: { width: '100%', maxWidth: 680, borderRadius: 16, paddingTop: 18, paddingBottom: 14, maxHeight: '90%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  label: { color: c.primary, fontWeight: '800', letterSpacing: 1.4, marginBottom: 2 },
  subtitle: { color: c.textSecondary },
  closeBtn: { padding: 4, marginLeft: 8 },
  closeText: { fontSize: 18, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  tabText: { color: c.textSecondary, fontWeight: '600' },
  // flexShrink lets the scroll area give way to the sheet's maxHeight. With
  // flexGrow: 0 alone it takes its full content height and the sheet merely
  // clips it — on Android that leaves nothing to scroll.
  body: { flexGrow: 0, flexShrink: 1 },
  centered: { paddingVertical: 28, alignItems: 'center' },
  empty: { color: c.textMuted, fontStyle: 'italic', paddingVertical: 16 },
  h: { color: c.primary, fontWeight: '800', letterSpacing: 1.2, marginTop: 10, marginBottom: 6 },
  lineBlock: { marginBottom: 10 },
  lineText: { color: c.text, fontStyle: 'italic', fontWeight: '700', marginBottom: 4 },
  tokenRow: { marginBottom: 6, paddingLeft: 10 },
  token: { color: c.text, fontStyle: 'italic', fontWeight: '600' },
  split: { color: c.textSecondary, fontWeight: '400' },
  rule: { color: c.textMuted, paddingLeft: 12 },
  wordRow: { marginBottom: 12, borderLeftWidth: 2, borderColor: c.primary, paddingLeft: 10 },
  word: { color: c.primary, fontWeight: '700', fontStyle: 'italic' },
  grammar: { color: c.textSecondary },
  strong: { color: c.text, fontWeight: '700' },
  dim: { color: c.textMuted },
  meaning: { color: c.text, marginTop: 2 },
  groupRow: { color: c.text, marginBottom: 4 },
  origin: { marginTop: 4, marginBottom: 2, paddingLeft: 8, borderLeftWidth: 2, borderColor: c.border },
  originHead: { color: c.textSecondary },
  originBase: { color: c.text, fontWeight: '700', fontStyle: 'italic' },
  originStep: { color: c.textMuted, marginTop: 1 },
  ruleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  clause: { marginBottom: 8, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  clauseHead: { color: c.textSecondary, fontWeight: '700', marginBottom: 4 },
  mapGroup: { marginBottom: 6, paddingLeft: 8, borderLeftWidth: 2, borderColor: c.primary },
  mapWord: { color: c.primary, fontWeight: '700', fontStyle: 'italic' },
  mapVerb: { color: c.text, marginVertical: 4 },
  ruleNo: { color: c.primary, fontWeight: '800', minWidth: 14 },
  memberList: { marginTop: 6, paddingLeft: 10, borderLeftWidth: 1, borderColor: c.border },
  memberRow: { marginTop: 4 },
  memberWord: { color: c.primary, fontStyle: 'italic', fontWeight: '600' },
  source: { fontSize: 11, marginTop: 8, textAlign: 'center' },
});
