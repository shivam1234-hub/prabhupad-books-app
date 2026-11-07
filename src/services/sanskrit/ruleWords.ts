import type { SandhiPart } from '@/services/dictionary';
import { SARVADI, type RuleWord } from './sentenceRules';

/**
 * Turning the dictionary's per-word analysis (SandhiPart) into what the
 * sentence rules read (RuleWord), plus the small text helpers the verse
 * analysis uses. Pure, so the evaluation script runs exactly the app's logic.
 */

const NUMBER_NAME = ['singular', 'dual', 'plural'];

/** A word that couldn't be analysed, still listed in its place. */
export function unanalysedPart(word: string): SandhiPart {
  return {
    word, meaning: null, source: null, stem: null, verb: false, entryWords: null, members: [], grammar: null,
    join: null, start: null, ref: null, alsoRendered: [], original: null, phrase: null, unanalysed: true,
  };
}

/** The case and number a word's grammar names, when it names just one. */
export function caseAndNumber(p: SandhiPart): { case: string; number: string } | null {
  const text = p.grammar?.best?.form ?? (p.grammar?.note && !/\bor\b/.test(p.grammar.note) ? p.grammar.note : '');
  const c = text?.match(/nominative|accusative|instrumental|dative|ablative|genitive|locative|vocative/g);
  const n = text?.match(/singular|dual|plural/);
  return c?.length === 1 && n ? { case: c[0], number: n[0] } : null;
}

/** A separated word as the sentence-rule detector sees it. */
/** The verse's sentence words (speaker heading left out) with the line each
 * stands on — what the sentence rules read. */
export function sentenceWordsOf(lines: { heading: boolean; tokens: { written: string; sandhi: { parts: SandhiPart[] } | null }[] }[]):
  { parts: SandhiPart[]; rules: RuleWord[] } {
  const parts: SandhiPart[] = [];
  const rules: RuleWord[] = [];
  lines.forEach((l, li) => {
    if (l.heading) return;
    for (const tk of l.tokens) {
      for (const p of tk.sandhi?.parts ?? [unanalysedPart(tk.written)]) {
        parts.push(p);
        rules.push({ ...toRuleWord(p), line: li });
      }
    }
  });
  return { parts, rules };
}

export function toRuleWord(p: SandhiPart): RuleWord {
  const g = p.grammar;
  let cn = caseAndNumber(p);
  // "nominative / accusative" (neuter -am, yat): left for the sentence to decide.
  const both = `${g?.best?.form ?? ''} ${g?.others.map(o => o.form).join(' ') ?? ''} ${g?.note ?? ''}`;
  const numberWord = both.match(/singular|dual|plural/)?.[0] ?? null;
  // Only when the best reading is itself nominative or accusative: a
  // locative -e (dharma-kṣetre, "in the place …") is not made an object.
  const bestForm = g?.best?.form ?? g?.note ?? '';
  const ambiguous = /nominative|accusative/.test(bestForm) && /nominative/.test(both) && /accusative/.test(both)
    && (/neuter/.test(`${g?.best?.stem ?? ''} ${g?.note ?? ''}`) || /nominative\/accusative/.test(g?.note ?? ''));
  if (ambiguous) cn = null;
  const text = `${g?.best?.stem ?? ''} ${g?.note ?? ''}`;
  const genders = (text.match(/masculine|feminine|neuter/g) ?? []).filter((x, i, a) => a.indexOf(x) === i);
  const head = g?.note?.split(' · ')[0].trim() ?? '';
  const bareStem = g?.best?.stem.split(' ')[0] ?? '';
  return {
    word: p.word,
    meaning: p.meaning,
    case: cn?.case ?? null,
    number: ((cn?.number ?? (ambiguous ? numberWord : null)) as RuleWord['number']) ?? null,
    caseOptions: ambiguous ? ['nominative', 'accusative'] : undefined,
    genders,
    verb: g?.verb ? {
      person: g.verb.person,
      number: NUMBER_NAME[g.verb.number] as 'singular' | 'dual' | 'plural',
      passive: /passive/.test(g.verb.tense),
      causative: /causative/.test(g.verb.tense),
    } : null,
    // Only an unambiguous pronoun: "te" (tad, or yuṣmad "unto you") is not one.
    pronoun: ['yad', 'tad', 'etad', 'idam'].includes(head) && !/\bor\b/.test(g?.note ?? '') ? head : null,
    // From the lexicon ("(adjective)"), or puṣpita → feminine puṣpitā.
    // From the lexicon ("(adjective)"), puṣpita → feminine puṣpitā, or a
    // comparative / superlative in -tara / -tama (guhya-tamam).
    adjective: !['yad', 'tad', 'etad', 'idam'].includes(head)
      && (/\(adjective\)|participle/.test(g?.best?.stem ?? '') || !!g?.origin?.steps.some(st => /→ feminine [^s]/.test(st))
        || /(tama|tara)\b/.test(g?.best?.stem ?? '')
        // Pronominal adjectives (sarva, viśva, anya …) describe; they don't name.
        || SARVADI.has(bareStem) || SARVADI.has(head) || SARVADI.has(bareStem.replace(/ā$/, 'a'))
        // A -ta / -na stem he renders "…ed" (vimukta, "freed"): a past participle.
        || (/(t|n)a$/.test(bareStem) && /^\w+ed$/i.test((p.meaning ?? '').trim()))),
    personal: ['asmad', 'yuṣmad'].includes(head) || ['aham', 'tvam', 'mama', 'tava', 'me', 'te', 'mām', 'tvām', 'mayā', 'tvayā', 'mayi', 'tvayi',
      'mahyam', 'tubhyam', 'vayam', 'yūyam', 'naḥ', 'vaḥ', 'asmākam', 'yuṣmākam', 'āvām', 'yuvām'].includes(p.word),
    gerund: /gerund/.test(g?.best?.form ?? '') || /gerund/.test(g?.note ?? ''),
    unverified: /stem not in the dictionary/.test(g?.best?.stem ?? ''),
    participle: /participle/.test(g?.best?.stem ?? ''),
    stem: g?.best?.stem.split(' ')[0] ?? (head && !/\s/.test(head) ? head : null),
    pastParticiple: /past participle/.test(g?.best?.stem ?? ''),
    gerundive: /gerundive/.test(g?.best?.stem ?? ''),
    infinitive: /infinitive/.test(g?.best?.form ?? '') || /infinitive/.test(g?.note ?? ''),
    root: g?.verb?.root ?? (g?.best?.stem.match(/√(\S+?)(?:\)|$|\s)/)?.[1] ?? null),
  };
}

/** A meaning's first clause, for the one-line split ("Desire; lust — …" → "desire"). */
export function short(meaning: string | null): string {
  if (!meaning) return '';
  const first = meaning.split(/[;—(]/)[0].replace(/\.$/, '').trim();
  const cut = first.length > 40 ? first.slice(0, 38).replace(/\s\S*$/, '') + '…' : first;
  // "The original…" → "the original…", but names ("Kṛṣṇa") keep their capital.
  // Lower-case like running text, but names keep their capital: "Kṛṣṇa, …",
  // "Arjuna, the son of Pṛthā", anything with diacritics or a following comma.
  const firstWord = cut.split(/[\s,]/)[0];
  const isName = /[^\x00-\x7F]/.test(firstWord) || /^[^\s]+,/.test(cut)
    || ['Arjuna', 'Brahman', 'Veda', 'Vedas', 'Lord', 'God'].includes(firstWord);
  // "O son of Pṛthā": the vocative O stays a capital.
  return isName || /^(O|I)(\s|$)/.test(cut) ? cut : cut.charAt(0).toLowerCase() + cut.slice(1);
}

