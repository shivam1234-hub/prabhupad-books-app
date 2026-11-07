#!/usr/bin/env python3
"""
Build the word-form lexicon the verse analysis checks every word against.

Why: reading a word's grammar off its ending with hand-written rules gets a
great deal wrong (verb classes, participles, consonant stems, pronouns).
Vidyut (ambuda-org/vidyut, a Pāṇinian generator of Sanskrit forms) knows the
real readings of a form. It is too large to ship (77 MB), so this looks up
every word that Śrīla Prabhupāda lists in the word-for-word of the verses we
have collected, keeps only its genuine readings, and writes a small file.

Input:  corpus/verses.jsonl — one verse per line: {"synonyms": [[words, meaning], ...]}
        (collected from vanisource.org; see the collection script).
Output: assets/dictionary/forms.dict   — form<TAB>reading<US>reading...
        assets/dictionary/verbtables.dict — table-key<TAB>9 forms (3rd→1st person × sg/du/pl)

Readings (fields joined by "|"):
  N|stem|gender|case(1-8)|number(0-2)|lexical genders|krt|root|prefixes   (a declined word)
  A|stem                                                                   (indeclinable)
  V|root|prefixes|gana|lakara|person(3/2/1)|number|prayoga|sanadi|table-key|morphemes|sutras
Morphemes are the pieces before sandhi joins them (pra+vad+a+anti), from
Vidyut's own derivation; sutras are the Aṣṭādhyāyī rules it applied.

Usage: vvenv/bin/python scripts/build-forms.py corpus/verses.jsonl vdata
"""
import json
import os
import re
import sys

from vidyut.kosha import Kosha
from vidyut.lipi import Scheme, transliterate
from vidyut.prakriya import Dhatu, Lakara, Pada, Prayoga, Purusha, Vacana, Vyakarana

# The 18 personal endings (tiṅ) as Pāṇini states them; the last nine are ātmanepada.
TIN_P = {'tip', 'tas', 'Ji', 'sip', 'Tas', 'Ta', 'mip', 'vas', 'mas'}
TIN_A = {'ta', 'AtAm', 'Ja', 'TAs', 'ATAm', 'Dvam', 'iw', 'vahi', 'mahiN'}

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dictionary')
MAX_READINGS = 16

# Derived words kept as readings: participles, gerundives, gerunds,
# infinitives. Other krt suffixes (kvip, vic, ḍa …) mostly give obscure
# technical derivatives of common words (ca, hi, te), and plain dictionary
# stems already cover real nouns.
KEEP_KRT = {'kta', 'ktavatu', 'Satf', 'SAnac', 'kvasu', 'kAnac', 'tavya', 'tavyat', 'anIyar', 'yat', 'Ryat',
            'kyap', 'ktvA', 'lyap', 'tumun', 'Ramul'}
AVYAYA_KRT = {'ktvA', 'lyap', 'tumun', 'Ramul'}

name = lambda e: getattr(e, 'name', str(e).split('.')[-1]) if e is not None else ''

# Rules too general to be worth showing (it-markers, saṁjñā, pada assignment).
QUIET = re.compile(r'^(1\.1\.\d+|1\.2\.4|1\.2\.45|1\.3\.\d+|1\.4\.(13|14|58|59|60|80)|3\.4\.(77|78|113|114)|8\.4\.68)$')
GENDER = {'Pum': 'm', 'Stri': 'f', 'Napumsaka': 'n'}
CASE = {'Prathama': 1, 'Dvitiya': 2, 'Trtiya': 3, 'Caturthi': 4, 'Panchami': 5, 'Sasthi': 6, 'Saptami': 7, 'Sambodhana': 8}
NUMBER = {'Eka': 0, 'Dvi': 1, 'Bahu': 2}
PERSON = {'Prathama': 3, 'Madhyama': 2, 'Uttama': 1}


def slp(iast: str) -> str:
    return transliterate(iast, Scheme.Iast, Scheme.Slp1)


def kosha_keys(form: str):
    """Vidyut stores final visarga as -s (rāmas) and some finals as -r (punar)."""
    keys = [form]
    if form.endswith('H'):
        keys += [form[:-1] + 's', form[:-1] + 'r']
    if form.endswith('M'):
        keys.append(form[:-1] + 'm')
    return keys


_ROOTS = {}


def root_of(dhatu_entry, prefixes, v=None):
    """The bare root, as Vidyut derives it from the dhātupāṭha entry alone —
    no prefixes, no causative (āviś → viś, dhāri → dhṛ, saṁpravṛt → vṛt)."""
    d = dhatu_entry.dhatu
    key = (d.aupadeshika, str(d.gana))
    if key not in _ROOTS:
        try:
            texts = [p.text for p in VY.derive(Dhatu.mula(d.aupadeshika, d.gana))]
        except Exception:
            texts = []
        _ROOTS[key] = texts[0] if texts else dhatu_entry.clean_text
    return _ROOTS[key]


def pada_of(prakriya):
    """P / A from the personal ending the derivation actually used."""
    for step in prakriya.history:
        for t in step.result:
            if t in TIN_A:
                return 'A'
            if t in TIN_P:
                return 'P'
    return ''


VY = Vyakarana()


def final_morphemes(prakriya):
    """The pieces as they stand at the end of the derivation (gacch, not
    gatC), with a piece the rules deleted shown as "hi→∅" (avagaccha,
    6.4.105) or "a→∅" (māti, śap dropped by 2.4.72). The piece's earlier
    form comes from the step where it last had one after its it-markers
    were gone."""
    hist = prakriya.history
    last = hist[-1].result
    out = []
    for i, t in enumerate(last):
        if t:
            out.append(t)
            continue
        # The latest non-empty spelling of this piece.
        before = next((s.result[i] for s in reversed(hist) if len(s.result) == len(last) and s.result[i]), '')
        if before:
            out.append(before + '→∅')
    return out


def main(corpus_path, vdata):
    kosha = Kosha(os.path.join(vdata, 'kosha'))
    v = Vyakarana()
    forms = set()
    for line in open(corpus_path, encoding='utf-8'):
        d = json.loads(line)
        for words, _meaning in d.get('synonyms', []):
            for w in words.replace('‘', '').replace('’', "'").split():
                w = w.strip(".,;:!?'\"()")
                if not w:
                    continue
                last = w.split('-')[-1]
                if last:
                    forms.add(slp(last))
                # The whole compound too: a derivative written with a hyphen
                # (vibhūti-mat, guhya-tamam) is one word in the lexicon.
                if '-' in w:
                    forms.add(slp(w.replace('-', '')))
    print(f'{len(forms)} distinct forms')

    out = {}
    tables = {}
    for form in sorted(forms):
        entries = []
        for key in kosha_keys(form):
            entries += kosha.get(key)
        basic_nouns = any(type(e).__name__.endswith('Subanta') and type(e.pratipadika_entry).__name__.endswith('Basic')
                          for e in entries)
        readings, seen = [], set()
        for e in entries:
            kind = type(e).__name__
            if kind.endswith('Subanta'):
                pe = e.pratipadika_entry
                if type(pe).__name__.endswith('Basic'):
                    stem = pe.pratipadika.text
                    if pe.is_avyaya or getattr(pe.pratipadika, 'is_avyaya', False):
                        r = f'A|{stem}'
                    else:
                        lex = ''.join(GENDER.get(name(g), '') for g in pe.lingas)
                        # A noun is declined in its own gender only (śoka is masculine).
                        if lex and GENDER.get(name(e.linga), '') not in lex:
                            continue
                        r = f'N|{stem}|{GENDER.get(name(e.linga), "")}|{CASE.get(name(e.vibhakti), 0)}|{NUMBER.get(name(e.vacana), 0)}|{lex}|||'
                else:
                    krt = name(pe.krt)
                    if krt not in KEEP_KRT:
                        continue
                    # A derived reading of a word that is also a plain noun is
                    # kept only when it is a participle / gerundive.
                    if basic_nouns and krt in {'yat', 'Ryat', 'kyap'}:
                        continue
                    de = pe.dhatu_entry
                    pre = de.dhatu.prefixes
                    root = root_of(de, pre)
                    # The derived stem itself (carat, gata), from Vidyut's own derivation.
                    try:
                        stems = [p.text for p in v.derive(pe.to_prakriya_args())]
                    except Exception:
                        stems = []
                    stem = stems[0] if stems else de.clean_text
                    if krt in AVYAYA_KRT:
                        r = f'N|{stem}||0|0||{krt}|{root}|{"-".join(pre)}'
                    else:
                        r = f'N|{stem}|{GENDER.get(name(e.linga), "")}|{CASE.get(name(e.vibhakti), 0)}|{NUMBER.get(name(e.vacana), 0)}||{krt}|{root}|{"-".join(pre)}'
            elif kind.endswith('Tinanta'):
                de = e.dhatu_entry
                d = de.dhatu
                pre = d.prefixes
                root = root_of(de, pre)
                sanadi = '-'.join(name(s) for s in d.sanadi)
                lak, pra = name(e.lakara), name(e.prayoga)
                tkey = f'{d.aupadeshika}#{name(d.gana)}#{"-".join(pre)}#{sanadi}#{lak}#{pra}'
                morphemes, sutras, pd = '', '', ''
                try:
                    derivs = v.derive(e.to_prakriya_args())
                    p = next((p for p in derivs if p.text in kosha_keys(form)), derivs[0] if derivs else None)
                    if p is not None:
                        pd = pada_of(p)
                        morphemes = '+'.join(final_morphemes(p))
                        sutras = ','.join(dict.fromkeys(s.code for s in p.history
                                                        if re.match(r'^[1-8]\.\d+\.\d+$', s.code) and not QUIET.match(s.code)))
                        if tkey not in tables:
                            tables[tkey] = table_for(v, e, p.text, pd)
                except Exception:
                    pass
                r = (f'V|{root}|{"-".join(pre)}|{name(d.gana)}|{lak}|{PERSON.get(name(e.purusha), 3)}|{NUMBER.get(name(e.vacana), 0)}'
                     f'|{pra}|{sanadi}|{tkey}|{morphemes}|{sutras}|{pd}')
            else:
                continue
            # One reading per root / tense / person / number / voice (Vidyut lists
            # a root once per gaṇa it belongs to).
            f_ = r.split('|')
            dedupe = '|'.join([f_[0], f_[1], f_[2]] + f_[4:9]) if r.startswith('V') else r
            if dedupe in seen:
                continue
            seen.add(dedupe)
            readings.append(r)
        if readings:
            # Plain nouns and finite verbs first; derived readings after.
            readings.sort(key=lambda r: (0 if r.startswith('V') else 1 if (r.startswith('N') and not r.split('|')[6]) else 2 if r.startswith('A') else 3))
            out[form] = readings[:MAX_READINGS]

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'forms.dict'), 'w', encoding='utf-8') as f:
        f.write('# Word forms of Śrīla Prabhupāda\'s word-for-word with their readings, from Vidyut (MIT).\n')
        f.write('# Built by scripts/build-forms.py.\n')
        for form in sorted(out):
            f.write(form + '\t' + '\x1f'.join(out[form]) + '\n')
    with open(os.path.join(OUT_DIR, 'verbtables.dict'), 'w', encoding='utf-8') as f:
        f.write('# Conjugation tables (3rd, 2nd, 1st person × singular, dual, plural), from Vidyut.\n')
        for key in sorted(tables):
            f.write(key + '\t' + ','.join(tables[key]) + '\n')
    print(f'{len(out)} forms with readings, {len(tables)} verb tables')


def table_for(v, e, own_text, own_pada=''):
    """The 9 cells of this verb's table, in the same pada (parasmai- or
    ātmanepada) as the form itself: Vidyut returns both for ubhayapada roots,
    in a stable order, so the form's own position picks the column."""
    args = e.to_prakriya_args()
    own_cell = [p.text for p in v.derive(args)]
    idx = own_cell.index(own_text) if own_text in own_cell else 0
    # The part of the form before its ending (joṣay- of joṣayet): each cell
    # takes the alternative built on the same stem, so a class-10 root with
    # an optional -aya- (joṣayet / joṣet) keeps to the form's own column.
    def common(a, b):
        n = 0
        while n < min(len(a), len(b)) and a[n] == b[n]:
            n += 1
        return n
    cells = []
    for pu in (Purusha.Prathama, Purusha.Madhyama, Purusha.Uttama):
        for va in (Vacana.Eka, Vacana.Dvi, Vacana.Bahu):
            derived = v.derive(Pada.Tinanta(dhatu=args.dhatu, prayoga=args.prayoga, lakara=args.lakara, purusha=pu, vacana=va))
            # The same voice (parasmai- / ātmanepada) as the form itself.
            same = [p.text for p in derived if not own_pada or pada_of(p) == own_pada]
            alts = same or [p.text for p in derived]
            if not alts:
                cells.append('—')
                continue
            by_index = alts[idx] if idx < len(alts) else alts[0]
            best = max(alts, key=lambda a: (common(a, own_text), a == by_index))
            cells.append(best)
    return cells


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
