#!/usr/bin/env python3
"""
Build the offline Sanskrit lexicon behind the sandhi splitter and the
last-resort meaning of a separated Sanskrit word.

Source: V. S. Apte, *The Practical Sanskrit-English Dictionary* (1890) — the
"Professor Apte's dictionary" Śrīla Prabhupāda names in his purports — as
digitised by the Cologne Digital Sanskrit Dictionaries (csl-orig, AP90),
licensed CC BY-SA 4.0. The output is a derivative and carries the same licence
(kept in its header).

Apte gives the *range* of a word's meanings, not its sense in a verse — the
app shows it only when neither Prabhupāda's own word-for-word, the curated
glossary nor the particle list covers a piece, and labels it as such.

Output: assets/dictionary/apte.dict — plain text, sorted by key, one line per
headword, so the app can binary-search it exactly like wordnet.dict:

    slp1-headword<TAB>sense<US>sense...[<RS>kind]

where kind (after <RS> = \x1e) is the word's fixed grammar class when Apte
states it: m / f / n (noun gender, several joined when Apte lists several),
or a (adjective / participle — takes any gender). The app uses it so a noun
is given its one real gender, and adjectives are told apart from nouns.

Keys are SLP1 (one ASCII letter per Sanskrit sound: A = ā, z = ṣ, S = ś ...),
which is what utils/sandhi.ts works in; <US> is \\x1f. Kept per headword: the
first MAX_SENSES English senses, each cut at its first quotation, with the
Sanskrit citations, source references and bracketed encyclopaedic notes
("[Kṛṣṇa is the most celebrated hero of Indian mythology…]") dropped, and
Vedic-only senses skipped.

Usage:  python3 scripts/build-apte.py path/to/ap90.txt
        (ap90.txt from github.com/sanskrit-lexicon/csl-orig, v02/ap90/)
"""
import os
import re
import sys

MAX_SENSES = 3
MAX_SENSE_CHARS = 90
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dictionary', 'apte.dict')

ENTRY_RE = re.compile(r'<L>[^<]*<pc>[^<]*<k1>([^<]*)<k2>[^\n]*\n(.*?)<LEND>', re.S)
# Sense markers: {@1@}, {@--2@}; "{#--kaH#}" starts a new gender/form block.
SENSE_SPLIT = re.compile(r'\{@-*\d+@\}|\{#--[^#]*#\}')
ABBREV = {
    'N.': 'Name', 'ind.': 'indeclinable', 'a.': 'adj.', 'm.': 'm.', 'f.': 'f.', 'n.': 'n.',
}


def clean_sense(s: str) -> str:
    s = re.sub(r'<lbinfo[^>]*/>', '', s)
    s = re.sub(r'\{c\w*c\}', '', s)                        # conjugation class
    s = re.sub(r'--\s*(?:Comp|m|f|n)\.\s*$', '', s.strip())
    s = re.sub(r'\[Page[^\]]*\]', '', s)
    s = re.sub(r'<ls[^>]*>.*?</ls>', '', s, flags=re.S)
    s = re.sub(r'\{#.*?#\}', '', s, flags=re.S)           # Sanskrit citations
    s = re.sub(r'\[[^\]]*\]', '', s, flags=re.S)           # etymology / notes
    s = re.sub(r'<ab>(.*?)</ab>', lambda m: ABBREV.get(m.group(1), m.group(1)), s)
    s = re.sub(r'\{%(.*?)%\}', r'\1', s, flags=re.S)
    s = re.sub(r'\{@(.*?)@\}', r'\1', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('¦', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    # A sense runs "Definition, synonym; quotation; quotation": keep the part
    # before the first quotation.
    s = s.split(';')[0].strip()
    s = re.sub(r'^[\s,.:()\-–—]+|[\s,:(\-–—]+$', '', s)
    s = re.sub(r'\(\s*[,.]?\s*\)', '', s).strip()
    s = re.sub(r'\(\s*[,.]\s*', '(', s)
    s = re.sub(r'\s*--\s*(?:Comp|m|f|n)\.$', '', s)
    s = re.sub(r'\s+([,.])', r'\1', s)
    if len(s) > MAX_SENSE_CHARS:
        s = s[:MAX_SENSE_CHARS].rsplit(' ', 1)[0].rstrip(',;') + '…'
    return s


GRAMMAR = r'(?:adj|pron|indeclinable|ind|nom|acc|instr|dat|abl|gen|loc|voc|sing|du|pl|m|f|n|a|comp|compar|superl|pot|p\. p|caus|desid|Atm|P|U|Ā)\.'


def strip_grammar(s: str) -> str:
    """Drop the part-of-speech labels, "(f. )" gender notes and "a)" sense
    letters that lead a sense, which are noise in a one-line meaning."""
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r'^\s*(?:' + GRAMMAR + r'|[a-z]\)|\((?:\s*' + GRAMMAR + r'\s*[,;]?)*\s*\)?)\s*', '', s)
    s = re.sub(r'\((?:\s*' + GRAMMAR + r'\s*[,;]?)+\s*\)', '', s)
    return re.sub(r'\s+', ' ', s).strip(' ,;')


NASAL_FOR = {**dict.fromkeys('kKgG', 'N'), **dict.fromkeys('cCjJ', 'Y'), **dict.fromkeys('wWqQ', 'R'),
             **dict.fromkeys('tTdD', 'n'), **dict.fromkeys('pPbB', 'm')}


def canonical_nasals(key: str) -> str:
    """Apte writes a nasal before a stop as anusvāra ("aMtara"); Prabhupāda's
    books write the class nasal ("antara"). The app canonicalises input the
    same way (utils/sanskritLexicon.ts), so both spellings meet here."""
    return re.sub(r'M(?=[kKgGcCjJwWqQtTdDpPbB])', lambda m: NASAL_FOR[key[m.end()]], key)


def stem_of(key: str) -> str:
    """AP90 lists nouns in the nominative ("DarmaH", "kzetraM", "BaktiH");
    the app's splitter works on stems, so strip that ending back off."""
    if len(key) > 2 and key.endswith('H') and key[-2] in 'aiuf':
        return key[:-1]
    if len(key) > 2 and key.endswith('M') and key[-2] == 'a':
        return key[:-1]
    return key


# Senses in this voice are the secular-scholarly framing the app must not
# present as the meaning of a devotional word; drop them outright.
UNFIT = re.compile(r'mytholog|amour|mistress|legend|\bfabl|wanton|\blust(?:ful)?\b|superstit', re.I)


def senses_of(body: str, split=SENSE_SPLIT, limit=MAX_SENSES) -> list:
    out = []
    for raw in split.split(body):
        if 'Ved.' in raw[:40]:
            continue
        s = clean_sense(raw)
        if UNFIT.search(s):
            continue
        # Verb-root headers ("{vI.v} P. (rarely Ā.)") before the first meaning.
        s = re.sub(r'\{[^}]*\}', '', s).strip()
        if re.match(r'(?:[PUĀ]|Atm|desid|caus|freq)\.', s):
            s = re.sub(r'^(?:(?:[PUĀ]|Atm|desid|caus|freq)\.\s*|\([^)]*\)?\s*)+', '', s)
        s = strip_grammar(re.sub(r'\(\s*opp\.\s*\)', '', s))
        # Grammarians' notes, not meanings.
        if re.search(r'\b(?:substituted|terminations?|affix|declined only)\b', s):
            continue
        # Grammar-only fragments ("adj.", "m.", "P. Atm.") carry no meaning.
        if not re.search(r'[a-z]{3}', s):
            continue
        if s not in out:
            out.append(s)
        if len(out) >= limit:
            break
    return out


# ── Compounds ────────────────────────────────────────────────────────────────
# Apte lists compounds under their first member, after "{@--Comp.@}", as
# "{#--laBa#} {1} hard to get …" (under dus: durlabha). Keys are rebuilt by
# joining the two with sandhi, the way the verses write them.

COMP_MARK = '{@--Comp.@}'
COMP_MEMBER = re.compile(r'\{#--([^#]*)#\}')
COMP_SENSE_SPLIT = re.compile(r'\{\d+\}')
MAX_COMPOUND_SENSES = 2
VOWELS = 'aAiIuUfFeEoO'
VOICED = VOWELS + 'gGNjJYqQRdDnbBmyrlvh'
JOIN = {
    **{a + b: 'A' for a in 'aA' for b in 'aA'}, **{a + b: 'e' for a in 'aA' for b in 'iI'},
    **{a + b: 'o' for a in 'aA' for b in 'uU'}, **{a + b: 'E' for a in 'aA' for b in 'eE'},
    **{a + b: 'O' for a in 'aA' for b in 'oO'}, **{a + 'f': 'ar' for a in 'aA'},
    **{a + b: 'I' for a in 'iI' for b in 'iI'}, **{a + b: 'U' for a in 'uU' for b in 'uU'},
}


def join(left: str, right: str) -> str:
    """First member + second member with the sandhi a compound shows."""
    if not left or not right:
        return left + right
    a, b = left[-1], right[0]
    if a + b in JOIN:
        return left[:-1] + JOIN[a + b] + right[1:]
    if a in 'iI' and b in VOWELS:
        return left[:-1] + 'y' + right
    if a in 'uU' and b in VOWELS:
        return left[:-1] + 'v' + right
    if a == 's' or a == 'H':
        before = left[-2] if len(left) > 1 else ''
        stem = left[:-1]
        if before == 'a' and b in VOICED and b not in VOWELS:
            return stem[:-1] + 'o' + right                 # manas + ratha → manoratha
        if before in 'iuIU' and b in VOICED:
            return stem + 'r' + right                      # dus + laBa → durlaBa
        if b in 'cC':
            return stem + 'S' + right
        if b in 'tT':
            return stem + 's' + right
        if b in 'kKpP':
            return stem + ('z' if before in 'iuIU' else 'H') + right
        return stem + 'H' + right
    if a == 't':
        if b in 'cC':
            return left[:-1] + 'c' + right
        if b in 'jJ':
            return left[:-1] + 'j' + right
        if b == 'S':
            return left[:-1] + 'cC' + right[1:]
        if b in 'nm':
            return left[:-1] + 'n' + right
        if b in VOICED:
            return left[:-1] + 'd' + right
    if a == 'k' and b in VOICED:
        return left[:-1] + ('N' if b in 'nm' else 'g') + right
    if a == 'm' and b not in VOWELS:
        return left[:-1] + 'M' + right
    return left + right


def compound_head(key: str) -> str:
    """The form a word takes as a compound's first member: n-stems drop the
    n (Atman → Atma-, rAjan → rAja-)."""
    return key[:-1] if key.endswith('an') and len(key) > 3 else key


def compounds_of(head: str, comp_text: str):
    marks = list(COMP_MEMBER.finditer(comp_text))
    for i, m in enumerate(marks):
        member = m.group(1).split(',')[0].strip()
        if not re.fullmatch(r'[a-zA-Z]+', member):
            continue                                        # "(raM)": a gender form
        end = marks[i + 1].start() if i + 1 < len(marks) else len(comp_text)
        senses = senses_of(comp_text[m.end():end], COMP_SENSE_SPLIT, MAX_COMPOUND_SENSES)
        if senses:
            yield canonical_nasals(join(compound_head(head), stem_of(member))), senses


def kind_of(k1: str, body: str) -> str:
    """m / f / n / a (adjective), or '' when Apte doesn't say."""
    head = body[:220]
    if re.search(r'\{%<ab>(?:a|p\. p|pot\. p|pres\. p)\.</ab>%\}', head):
        # An adjective often also has noun uses listed as "--yaM" (neuter),
        # "--yaH" (masculine), "--yA" (feminine): indriya is "a." and n.
        nouns = ''
        for form in re.findall(r'\{#--([^#]{1,12})#\}', body[:700]):
            form = form.strip().split(',')[0]
            g = 'n' if form.endswith('aM') else 'm' if form.endswith('aH') else 'f' if form.endswith('A') else ''
            if g and g not in nouns:
                nouns += g
        return 'a' + nouns
    stated = re.findall(r'\{%<ab>([mfn])\.</ab>%\}', head)
    if stated:
        return ''.join(dict.fromkeys(stated))
    if k1.endswith('aH'):
        return 'm'
    if k1.endswith('aM'):
        return 'n'
    if k1.endswith('A') or k1.endswith('I'):
        return 'f'
    return ''


KINDS = {}


def add(merged: dict, key: str, senses: list, kind: str = ''):
    if kind:
        KINDS[key] = ''.join(dict.fromkeys(KINDS.get(key, '') + kind))
    if not senses:
        return
    have = merged.setdefault(key, [])
    for s in senses:
        if len(have) < MAX_SENSES and s not in have:
            have.append(s)


def main(src: str):
    text = open(src, encoding='utf-8').read()
    merged = {}
    for key, body in ENTRY_RE.findall(text):
        key = key.strip()
        if not re.fullmatch(r'[a-zA-Z]+', key):
            continue
        raw_key = key
        key = canonical_nasals(stem_of(key))
        main_text, _, comp_text = body.partition(COMP_MARK)
        add(merged, key, senses_of(main_text), kind_of(raw_key, main_text))
        if comp_text:
            for ckey, senses in compounds_of(key, comp_text):
                add(merged, ckey, senses)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('# V. S. Apte, The Practical Sanskrit-English Dictionary (1890), headwords in SLP1.\n')
        f.write('# Digitised by Cologne Digital Sanskrit Dictionaries (csl-orig AP90), CC BY-SA 4.0.\n')
        f.write('# This derived file is likewise CC BY-SA 4.0. Built by scripts/build-apte.py.\n')
        # Plain code-point order = JavaScript's string `<`, which the app's
        # binary search relies on.
        for key in sorted(merged):
            kind = KINDS.get(key, '')
            # An adjective that is also listed as a noun keeps both ("an" = both).
            f.write(f'{key}\t' + '\x1f'.join(merged[key]) + (f'\x1e{kind}' if kind else '') + '\n')
    print(f'{len(merged)} headwords -> {OUT} ({os.path.getsize(OUT) / 1e6:.1f} MB)')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
