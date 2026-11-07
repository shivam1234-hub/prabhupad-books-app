// Word-for-word synonyms come as "word – meaning; word – meaning; …".
// Split into pairs so the Sanskrit word can be colored apart from its meaning.
// The word/meaning divider is a spaced dash (– — or -); the intra-word hyphen
// in e.g. "ananta-vijayam" has no surrounding spaces, so it isn't split.
export function parseSynonyms(s: string): { word: string; meaning: string }[] {
  return s
    .split(';')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const m = seg.match(/^([\s\S]*?)\s[–—-]\s([\s\S]*)$/);
      return m ? { word: m[1].trim(), meaning: m[2].trim() } : { word: seg, meaning: '' };
    });
}
