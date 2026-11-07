import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import type { ColorScheme } from '@/constants/colors';
import { Verse } from '@/types';
import { verseLabel } from '@/services/dictionary';
import type { Citation, LibraryRef } from '@/services/purport/citations';
import type { MappedLine, StudySource } from '@/services/purport/purportSources';
import { mapVersePurport } from '@/services/purport/resolvePurport';

interface Props {
  /** The verse whose purport is shown; null hides the sheet. */
  verse: Verse | null;
  onClose: () => void;
  onOpenVerse: (ref: LibraryRef) => void;
}

const BADGE: Record<MappedLine['evidence']['kind'], string> = {
  cited: 'CITED',
  quote: 'QUOTED VERSE',
  translation: 'TRANSLATION',
  introduces: 'INTRODUCES A QUOTE',
  explains: 'EXPLANATION',
};

/**
 * Where each line of a purport comes from. Every line is listed in order
 * with the kind of link it has — a verse Śrīla Prabhupāda names, a verse he
 * quotes, his translation of it, or his explanation of this verse — and
 * tapping a line shows the source and opens it when it is in the library.
 * Verses offered for an explanation line are marked "similar", never as
 * his source.
 */
export function PurportSourcesSheet({ verse, onClose, onOpenVerse }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fs = useSettingsStore(s => s.settings.fontScale ?? 1);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const t = (size: number) => ({ fontSize: size * fs, lineHeight: size * fs * 1.45 });

  const [lines, setLines] = useState<MappedLine[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [onlySourced, setOnlySourced] = useState(false);

  useEffect(() => {
    if (!verse) return;
    let cancelled = false;
    setLines(null);
    setOpen(null);
    mapVersePurport(verse).then(l => { if (!cancelled) setLines(l); }).catch(() => { if (!cancelled) setLines([]); });
    return () => { cancelled = true; };
  }, [verse?.id]);

  const counts = useMemo(() => {
    const n = (k: string) => lines?.filter(l => l.evidence.kind === k).length ?? 0;
    const based = lines?.filter(l => l.evidence.kind === 'explains' && l.study?.some(st => st.rel === 'restates' || st.rel === 'refers')).length ?? 0;
    return { quote: n('quote'), cited: n('cited'), translation: n('translation'), explains: n('explains') - based, based };
  }, [lines]);

  if (!verse) return null;
  const here = verseLabel(verse);
  const byId = new Map((lines ?? []).map(l => [l.id, l]));
  const shown = (lines ?? []).filter(l => !onlySourced || l.evidence.kind !== 'explains'
    || !!l.study?.some(st => st.rel === 'restates' || st.rel === 'refers'));

  const openRef = (ref: LibraryRef) => { onClose(); onOpenVerse(ref); };
  const OpenButton = ({ ref_, label }: { ref_: LibraryRef; label: string }) => (
    <Pressable onPress={() => openRef(ref_)} style={styles.openBtn} hitSlop={6}>
      <Text style={[styles.openText, t(13)]}>Open {label} ›</Text>
    </Pressable>
  );
  const CitationRow = ({ ci }: { ci: Citation }) => (
    <View style={styles.detailRow}>
      <Text style={[styles.detailText, t(13)]}>
        <Text style={styles.strong}>{ci.label}</Text>
        {ci.how === 'implied' ? ' — the book is the one this purport belongs to' : ' — named by Śrīla Prabhupāda'}
      </Text>
      {ci.ref
        ? <OpenButton ref_={ci.ref} label={shortLabel(ci)} />
        : <Text style={[styles.dim, t(12)]}>Not a book of this library; the words he quotes from it are in this purport.</Text>}
    </View>
  );

  // A source found by studying the purport: what the line does with it.
  const StudyRow = ({ st }: { st: StudySource }) => (
    <View style={styles.detailRow}>
      <Text style={[styles.detailText, t(13)]}>
        {st.rel === 'this' ? 'Explains ' : st.rel === 'restates' ? 'Rests on ' : st.rel === 'refers' ? 'Refers to '
          : st.rel === 'identifies-quote' ? 'The verse quoted is ' : 'Cited by Śrīla Prabhupāda: '}
        <Text style={styles.strong}>{st.rel === 'this' ? `${st.label}, the verse of this purport` : st.label}</Text>
        {st.why ? ` — ${st.why}` : ''}
      </Text>
      {!!st.quote && <Text style={[styles.quoteInline, t(13)]}>{st.quote}</Text>}
      {st.rel !== 'this' && (st.ref
        ? <OpenButton ref_={st.ref} label={st.label.replace(/^Bhagavad-gītā /, 'Bg. ').replace(/^Śrīmad-Bhāgavatam /, 'SB ')} />
        : <Text style={[styles.dim, t(12)]}>Not a book of this library.</Text>)}
    </View>
  );
  // His own references the parser didn't see on this line (an inline quote,
  // a translation of the second of two verses) come from the study too.
  const studyOf = (line: MappedLine) => (line.study ?? []).filter(st => st.rel !== 'his-citation'
    || line.evidence.kind === 'explains' || line.evidence.kind === 'translation');

  const details = (line: MappedLine) => {
    const e = line.evidence;
    switch (e.kind) {
      case 'cited':
        return e.citations.map((ci, i) => <CitationRow key={i} ci={ci} />);
      case 'quote': {
        const cited = e.citation;
        return (
          <>
            {cited && <CitationRow ci={cited} />}
            {!cited && e.found && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailText, t(13)]}>
                  <Text style={styles.strong}>{e.found.label}</Text> — he does not name it here; found in your library by its Sanskrit text.
                </Text>
                <OpenButton ref_={e.found.ref} label={e.found.label} />
              </View>
            )}
            {cited && !cited.ref && e.found && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailText, t(13)]}>Also stands in {e.found.label} of your library.</Text>
                <OpenButton ref_={e.found.ref} label={e.found.label} />
              </View>
            )}
            {!cited && !e.found && (
              <Text style={[styles.dim, t(13)]}>
                He does not name its source here, and it is not in the books downloaded to this device.
                Downloading Bhagavad-gītā, Śrīmad-Bhāgavatam and Caitanya-caritāmṛta lets more quotations be found.
              </Text>
            )}
          </>
        );
      }
      case 'translation': {
        const q = byId.get(e.of);
        const fromStudy = line.study?.find(st => st.rel === 'his-citation')?.label;
        const src = fromStudy ?? (q?.evidence.kind === 'quote' ? (q.evidence.citation?.label ?? q.evidence.found?.label) : undefined);
        return (
          <Text style={[styles.detailText, t(13)]}>
            His translation of the verse quoted just above{src ? ` (${src})` : ''}:{' '}
            <Text style={styles.quoteInline}>{firstLine(q?.text)}</Text>
          </Text>
        );
      }
      case 'introduces': {
        const q = byId.get(e.of);
        const src = q?.evidence.kind === 'quote' ? (q.evidence.citation?.label ?? q.evidence.found?.label) : undefined;
        return (
          <Text style={[styles.detailText, t(13)]}>
            Leads into the quotation that follows{src ? ` — ${src}` : ''}.
          </Text>
        );
      }
      case 'explains': {
        const study = studyOf(line);
        return study.length
          ? <>{study.map((st, k) => <StudyRow key={k} st={st} />)}</>
          : (
            <Text style={[styles.detailText, t(13)]}>
              Śrīla Prabhupāda's explanation of <Text style={styles.strong}>{here}</Text>, the verse of this purport.
            </Text>
          );
      }
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop as a sibling layer, not a wrapper: a touchable parent takes
          slow drags from the ScrollView on Android. */}
      <View style={[styles.overlay, wide && styles.overlayWide]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, wide ? styles.sheetWide : { paddingBottom: 16 + insets.bottom }]}>
          {!wide && <View style={styles.handle} />}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, t(10)]}>PURPORT SOURCES · {here}</Text>
              <Text style={[styles.subtitle, t(13)]}>Where each line of the purport comes from — tap a line</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: c.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          {lines && lines.length > 0 && (
            <>
              <Text style={[styles.summary, t(12)]}>
                {counts.quote} quoted verse{counts.quote === 1 ? '' : 's'} · {counts.cited} line{counts.cited === 1 ? '' : 's'} naming a verse
                · {counts.based} based on another verse · {counts.translation} of translation · {counts.explains} explaining this verse
              </Text>
              <View style={styles.tabs}>
                {([false, true] as const).map(v => (
                  <Pressable key={String(v)} onPress={() => setOnlySourced(v)}
                    style={[styles.tab, onlySourced === v && { borderColor: c.primary, backgroundColor: c.primary + '1f' }]}>
                    <Text style={[styles.tabText, t(13), onlySourced === v && { color: c.primary }]}>
                      {v ? 'Quotations & references' : 'Every line'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {!lines && <View style={styles.centered}><ActivityIndicator color={c.primary} /></View>}
            {lines && !lines.length && <Text style={[styles.empty, t(14)]}>This verse has no purport.</Text>}
            {shown.map(line => {
              const expanded = open === line.id;
              const basedOn = line.evidence.kind === 'explains' && !!line.study?.some(st => st.rel === 'restates' || st.rel === 'refers');
              const sourced = line.evidence.kind !== 'explains' || basedOn;
              return (
                <Pressable key={line.id} onPress={() => setOpen(expanded ? null : line.id)}
                  style={[styles.lineRow, { borderColor: sourced ? c.primary : c.border }]}>
                  <Text style={[styles.badge, t(10), { color: sourced ? c.primary : c.textMuted }]}>
                    {basedOn ? 'BASED ON' : BADGE[line.evidence.kind]}{badgeSuffix(line)}
                  </Text>
                  <Text style={[line.kind === 'verse' ? styles.verseText : styles.lineText, t(14)]}
                    numberOfLines={expanded ? undefined : line.kind === 'verse' ? 4 : 3}>
                    {line.text}
                  </Text>
                  {expanded && (
                    <View style={styles.details}>
                      {details(line)}
                      {line.evidence.kind === 'quote' && !line.evidence.citation && studyOf(line).map((st, k) => <StudyRow key={k} st={st} />)}
                    </View>
                  )}
                </Pressable>
              );
            })}
            {lines && lines.length > 0 && (
              <Text style={[styles.note, t(11)]}>
                “Cited” and “quoted verse” are Śrīla Prabhupāda's own references. “Rests on” and “refers to”
                come from a study of the purport, checked against the verses named.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function badgeSuffix(line: MappedLine): string {
  const e = line.evidence;
  if (e.kind === 'explains' && line.study?.length) {
    const other = line.study.filter(st => st.rel === 'restates' || st.rel === 'refers');
    return other.length ? ` · ${other.map(st => shortWork(st.label)).join(', ')}` : '';
  }
  if (e.kind === 'quote' && !e.citation && !e.found) {
    const id = line.study?.find(st => st.rel === 'identifies-quote');
    if (id) return ` · ${shortWork(id.label)}`;
  }
  if (e.kind === 'cited') return ` · ${e.citations.map(shortLabel).join(', ')}`;
  if (e.kind === 'quote') return e.citation ? ` · ${shortLabel(e.citation)}` : e.found ? ` · ${e.found.label} (found)` : ' · source not named';
  return '';
}

const shortWork = (label: string) => label.replace(/ Upaniṣad /, ' Up. ').replace(/^Bhagavad-gītā /, 'Bg. ')
  .replace(/^Śrīmad-Bhāgavatam /, 'SB ').replace(/^Śrī Caitanya-caritāmṛta /, 'Cc. ');

/** "Bg. 7.17", "Kaṭha Up. 2.2.13". */
function shortLabel(ci: Citation): string {
  return ci.label.replace(/ Upaniṣad /, ' Up. ').replace(/^Bhagavad-gītā /, 'Bg. ').replace(/^Śrīmad-Bhāgavatam /, 'SB ')
    .replace(/^Śrī Caitanya-caritāmṛta /, 'Cc. ');
}

const firstLine = (s?: string) => (s ?? '').split('\n')[0] + ((s ?? '').includes('\n') ? ' …' : '');

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
  summary: { color: c.textMuted, marginBottom: 8 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  tabText: { color: c.textSecondary, fontWeight: '600' },
  // flexShrink lets the list give way to the sheet's maxHeight, so it scrolls.
  body: { flexGrow: 0, flexShrink: 1 },
  centered: { paddingVertical: 28, alignItems: 'center' },
  empty: { color: c.textMuted, fontStyle: 'italic', paddingVertical: 16 },
  lineRow: { borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 6, marginBottom: 8 },
  badge: { fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  lineText: { color: c.text },
  verseText: { color: c.text, fontStyle: 'italic' },
  details: { marginTop: 6, gap: 6 },
  detailRow: { gap: 2 },
  detailText: { color: c.textSecondary },
  strong: { color: c.text, fontWeight: '700' },
  dim: { color: c.textMuted },
  quoteInline: { fontStyle: 'italic', color: c.text },
  openBtn: { alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: c.primary, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 },
  openText: { color: c.primary, fontWeight: '700' },
  similarBox: { marginTop: 6, paddingLeft: 8, borderLeftWidth: 1, borderColor: c.border, gap: 8 },
  similarHead: { color: c.textMuted, fontWeight: '800', letterSpacing: 1 },
  similarRow: { gap: 2 },
  note: { color: c.textMuted, marginTop: 10, textAlign: 'center' },
});
