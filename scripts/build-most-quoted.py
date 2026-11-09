#!/usr/bin/env python3
"""
Build src/data/mostQuotedVerses.json from the Bhaktivedanta Archives PDF
"Verses Most Quoted by Srila Prabhupada": the ranked list (times quoted),
the invocation prayers, and the full text of every verse (verse, word-for-word,
translation). The PDF uses the Balaram font encoding, converted here to IAST.

Lines are told apart by the PDF's fonts (pdftohtml -xml): bold red = work,
bold green = verse number, black italic = verse, navy = synonyms, bold maroon =
translation, plain = notes.

Needs poppler (pdftotext, pdftohtml).
Usage: python3 scripts/build-most-quoted.py Verses_most_Quoted.pdf src/data/mostQuotedVerses.json
"""
import json, re, subprocess, sys, tempfile, unicodedata
from pathlib import Path

PDF = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2])
_tmp = Path(tempfile.mkdtemp())
PDF_DIR = _tmp / 'pdf'
PDF_DIR.mkdir()
for _n in range(1, 449):
    subprocess.run(['pdftotext', '-layout', '-f', str(_n), '-l', str(_n), str(PDF), str(PDF_DIR / f'p{_n}.txt')], check=True)
subprocess.run(['pdftohtml', '-xml', '-i', '-q', str(PDF), str(_tmp / 'all')], check=True)

BALARAM = str.maketrans({
    'ä': 'ā', 'Ä': 'Ā', 'é': 'ī', 'É': 'Ī', 'ü': 'ū', 'Ü': 'Ū', 'å': 'ṛ', 'Å': 'Ṛ',
    'è': 'ṝ', 'ì': 'ṅ', 'Ì': 'Ṅ', 'ï': 'ñ', 'Ï': 'Ñ', 'ö': 'ṭ', 'Ö': 'Ṭ', 'ò': 'ḍ',
    'Ò': 'Ḍ', 'ë': 'ṇ', 'Ë': 'Ṇ', 'ç': 'ś', 'Ç': 'Ś', 'ñ': 'ṣ', 'Ñ': 'Ṣ', 'à': 'ṁ',
    'À': 'Ṁ', 'ù': 'ḥ', 'Ù': 'Ḥ', 'û': 'ṁ',
})


def iast(s: str) -> str:
    return s.translate(BALARAM)


def fold(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z]', '', s)


def page(n: int) -> list[str]:
    lines = (PDF_DIR / f'p{n}.txt').read_text().replace('\f', '').split('\n')
    while lines and not lines[-1].strip():
        lines.pop()
    if lines and re.fullmatch(r'\s*\d+\s*', lines[-1]):  # page number
        lines.pop()
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


# ---------------------------------------------------------------- ranked list
ranked = []
times = None
for n in range(1, 5):
    for ln in page(n):
        m = re.match(r'^\s+(?:(\d+\+)\s+)?(\d+)\s{3,}(.+?)\s{2,}(.+?)(?:\s{2,}(\d+))?\s*$', ln)
        if not m:
            continue
        if m.group(1):
            times = m.group(1)
        rank = int(m.group(2))
        if ranked and ranked[-1]['rank'] == rank:  # repeated across a page break
            continue
        ranked.append({'rank': rank, 'times': times, 'firstLine': m.group(3).strip(),
                       'source': m.group(4).strip()})

# ---------------------------------------------------------------- body (from pdftohtml -xml, by font role)
import html as _html
XML = (PDF_DIR.parent / 'all.xml').read_text()
fonts = {}
for m in re.finditer(r'<fontspec id="(\d+)" size="(\d+)" family="(?:[^+"]*\+)?([^"]+)" color="([^"]+)"', XML):
    fonts[m[1]] = (m[3], m[4])

def role(fam, color):
    if fam.startswith(('Tamal', 'Times', 'Courier')) or fam == 'ScaGoudy' and color == '#000000' and False:
        return None
    if color == '#000080':
        return 'syn'
    if color == '#004080':
        return 'section'
    if color == '#ffffff':
        return 'cover'
    if 'Bold' in fam and color == '#800000':
        return 'trans'
    if 'Bold' in fam and color == '#ff0000':
        return 'work'
    if 'Bold' in fam and color == '#008000':
        return 'number'
    if 'Italic' in fam and color == '#000000':
        return 'verse'
    if fam.startswith('Sca') and color in ('#000000', '#008000'):
        return 'note'
    return None

# Lines: (page, top) -> list of (left, role, text)
plines = []
for pm in re.finditer(r'<page number="(\d+)"(.*?)</page>', XML, re.S):
    pno = int(pm[1])
    if pno < 6:
        continue
    rows = {}
    for tm in re.finditer(r'<text top="(\d+)" left="(\d+)" width="\d+" height="(\d+)" font="(\d+)">(.*?)</text>', pm[2]):
        txt = _html.unescape(re.sub(r'<[^>]+>', '', tm[5]))
        if not txt.strip():
            continue
        r = role(*fonts[tm[4]])
        if r is None:
            continue
        top = int(tm[1])
        key = next((k for k in rows if abs(k - top) <= 4), top)
        rows.setdefault(key, []).append((int(tm[2]), r, txt))
    for top in sorted(rows):
        items = sorted(rows[top])
        text = re.sub(r'\s+', ' ', ''.join(t for _, _, t in items)).strip()
        weights = {}
        for _, r, t in items:
            weights[r] = weights.get(r, 0) + len(t.strip())
        r = max(weights, key=weights.get)
        if 'syn' in weights:
            r = 'syn'
        plines.append((pno, top, r, text))

entries = []
section = 'Auspicious Invocation Mantras'
work = None      # red heading
number = None    # green heading
author = None
note_pending = []
cur = None
last_role = None
work_used = False
cover_base = None
last = None      # (page, top) of previous line, for gap detection

def flush():
    global cur
    if cur and cur['text']:
        entries.append(cur)
    cur = None

def title_now():
    if number and work and work_used and not number[0].isdigit():
        return number
    if number and work:
        w = fold(work.split()[0])
        return number if fold(number).startswith(w[:6]) else f'{work} {number}'
    return number or work

def gap(p, t):
    return last is None or last[0] != p or t - last[1] > 40

for p, top, r, text in plines:
    if r == 'section':
        t = iast(text)
        if t != section:
            flush(); section, work, number, author = t, None, None, None
    elif r == 'cover':
        if text.startswith('By'):
            author = iast(text[2:].strip())
        else:
            author, cover_base = None, re.sub(r'\s*\(\d+\)$', '', iast(text))
    elif r in ('work', 'number'):
        if cur and cur['text']:
            flush()
        if r == 'work':
            if text.endswith(')') and work and re.sub(r'\s*\(\d+\)$', '', iast(text)) == re.sub(r'\s*\(\d+\)$', '', work):
                pass
            base = re.sub(r'\s*\(\d+\)$', '', iast(text))
            if base != cover_base and (not work or base != re.sub(r'\s*\(\d+\)$', '', work)):
                author = None
            work, number, work_used = iast(text), None, False
        else:
            number = f'{number} {iast(text)}' if (number and last_role == 'number') else iast(text)
    elif r == 'verse' and text.startswith('(') and cur and (cur['synonyms'] or cur['translation']):
        t = iast(text)
        cur['attribution'] = (cur['attribution'] + ' ' + t) if cur['attribution'] else t
    elif r == 'verse':
        if cur is None or cur['synonyms'] or cur['translation']:
            flush()
            work_used_now = title_now()
            work_used = True
            cur = {'section': section, 'title': work_used_now, 'author': author, 'text': [], 'synonyms': [],
                   'translation': [], 'attribution': None, 'note': ' '.join(note_pending) or None}
            note_pending = []
        elif cur['text'] and gap(p, top) and last[0] == p:
            cur['text'].append('')
        cur['text'].append(iast(text))
    elif r == 'syn':
        if cur:
            cur['synonyms'].append(text)
    elif r == 'trans':
        if cur:
            if cur['translation'] and gap(p, top) and last[0] == p:
                cur['translation'].append('')
            cur['translation'].append(text)
    elif r == 'note':
        t = iast(text)
        if cur and cur['translation']:
            cur['attribution'] = (cur['attribution'] + ' ' + t) if cur['attribution'] and not cur['attribution'].endswith(')') else t
        else:
            note_pending.append(t)
    last = (p, top)
    last_role = r
flush()
for e in entries:
    if e['attribution']:
        e['attribution'] = re.sub(r'^\((.*)\)$', r'\1', e['attribution'].strip())


def para(ls: list[str]) -> str:
    """Join wrapped lines into paragraphs; blank '' separates paragraphs."""
    out, cur_p = [], []
    for l in ls:
        if l == '':
            if cur_p:
                out.append(' '.join(cur_p))
            cur_p = []
        else:
            cur_p.append(l)
    if cur_p:
        out.append(' '.join(cur_p))
    text = '\n\n'.join(out)
    return iast(re.sub(r'(\w)- (\w)', r'\1-\2', text))


def syn(ls: list[str]) -> str:
    s = ' '.join(ls)
    s = re.sub(r'(\S)- (\S)', r'\1-\2', s)  # word broken at a hyphen across lines
    return iast(s)


LILA = {'ādi': 1, 'madhya': 2, 'antya': 3}

def ref_from_title(t: str):
    if not t:
        return None
    m = re.match(r'^Bhagavad-gītā (\d+)\.(\d+(?:-\d+)?)$', t)
    if m:
        return {'bookSlug': 'bg', 'chapter': int(m[1]), 'verse': m[2]}
    m = re.match(r'^Śrīmad-Bhāgavatam (\d+)\.(\d+)\.(\d+(?:-\d+)?)$', t)
    if m:
        return {'bookSlug': 'sb', 'canto': int(m[1]), 'chapter': int(m[2]), 'verse': m[3]}
    m = re.match(r'^Caitanya-caritāmṛta (Ādi|Madhya|Antya) (\d+)\.(\d+(?:-\d+)?)$', t)
    if m:
        return {'bookSlug': 'cc', 'canto': LILA[m[1].lower()], 'chapter': int(m[2]), 'verse': m[3]}
    m = re.match(r'^Brahma-saṁhitā Text 5\.(\d+)$', t)
    if m:
        return {'bookSlug': 'bs', 'chapter': 5, 'verse': m[1]}
    m = re.match(r'^Īśopaniṣad Mantra (\d+)$', t)
    if m:
        return {'bookSlug': 'iso', 'chapter': 1, 'verse': m[1]}
    m = re.match(r'^Upadeśāmṛta (?:Text )?(\d+)$', t)
    if m:
        return {'bookSlug': 'noi', 'chapter': 1, 'verse': m[1]}
    return None


verses = []
for n, e in enumerate(entries):
    v = {
        'id': n + 1,
        'section': e['section'],
        'title': e['title'],
        'text': '\n'.join(e['text']),
        'synonyms': syn(e['synonyms']),
        'translation': para(e['translation']),
    }
    if e['author']:
        v['author'] = e['author']
    if e['attribution']:
        v['attribution'] = e['attribution']
    if e.get('note'):
        v['note'] = e['note']
    r = ref_from_title(e['title'])
    if r:
        v['ref'] = r
    verses.append(v)

# ---------------------------------------------------------------- prayers
PRAYER_SECTION = 'Auspicious Invocation Mantras'
prayers = []
for v in verses:
    if v['section'] != PRAYER_SECTION:
        continue
    t = re.sub(r'\s*\(\d+\)$', '', v['title'] or '')
    if not prayers or prayers[-1]['title'] != t:
        prayers.append({'title': t, 'verseIds': []})
        if v.get('author'):
            prayers[-1]['author'] = v['author']
    prayers[-1]['verseIds'].append(v['id'])

# ---------------------------------------------------------------- link ranks
SRC_LILA = {'Adi': 1, 'Mad': 2, 'Ant': 3}

def ref_from_source(src: str):
    src = src.split('/')[0].strip()
    m = re.match(r'^Bg (\d+)\.(\d+)$', src)
    if m:
        return {'bookSlug': 'bg', 'chapter': int(m[1]), 'verse': m[2]}
    m = re.match(r'^SB (\d+)\.(\d+)\.(\d+)$', src)
    if m:
        return {'bookSlug': 'sb', 'canto': int(m[1]), 'chapter': int(m[2]), 'verse': m[3]}
    m = re.match(r'^CC (Adi|Mad|Ant) (\d+)\.(\d+)$', src)
    if m:
        return {'bookSlug': 'cc', 'canto': SRC_LILA[m[1]], 'chapter': int(m[2]), 'verse': m[3]}
    m = re.match(r'^BSm 5\.(\d+)$', src)
    if m:
        return {'bookSlug': 'bs', 'chapter': 5, 'verse': m[1]}
    return None

by_fold = [(fold(v['text']), v) for v in verses]

def find_text(first: str, ref):
    if ref:
        for v in verses:
            vr = v.get('ref')
            if not vr or {k: x for k, x in vr.items() if k != 'verse'} != {k: x for k, x in ref.items() if k != 'verse'}:
                continue
            lo, _, hi = vr['verse'].partition('-')
            if int(lo) <= int(ref['verse']) <= int(hi or lo):
                return v
    f = fold(first)
    if len(f) < 6:
        return None
    for vf, v in by_fold:
        if vf.startswith(f):
            return v
    import difflib
    best = max(by_fold, key=lambda p: difflib.SequenceMatcher(None, f, p[0][:len(f)]).ratio())
    if difflib.SequenceMatcher(None, f, best[0][:len(f)]).ratio() > 0.85:
        return best[1]
    for vf, v in by_fold:  # first line may have a speaker line ("śrī bhagavān uvāca") before it
        if f in vf[:len(f) + 40]:
            return v
    for vf, v in by_fold:  # second half of a combined verse, or a phrase within one
        if f in vf:
            return v
    return None

unmatched = []
for r in ranked:
    ref = ref_from_source(r['source'])
    if ref:
        r['ref'] = ref
    v = find_text(r['firstLine'], ref)
    if v:
        r['verseId'] = v['id']
        if not ref and v.get('ref'):
            r['ref'] = v['ref']
    else:
        unmatched.append(r)

sections = []
for v in verses:
    if v['section'] not in sections:
        sections.append(v['section'])
    v['section'] = sections.index(v['section'])
out = {
    'sections': sections,
    'source': 'Verses Most Quoted by Srila Prabhupada — Bhaktivedanta Archives',
    'ranked': ranked,
    'prayers': prayers,
    'verses': verses,
}
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('ranked', len(ranked), 'matched', len(ranked) - len(unmatched))
print('verses', len(verses), 'prayers', len(prayers), 'prayer verses', sum(len(p['verseIds']) for p in prayers))
from collections import Counter
print('sections', Counter(v['section'] for v in verses).most_common())
print('unmatched:', [(r['rank'], r['firstLine'], r['source']) for r in unmatched])
