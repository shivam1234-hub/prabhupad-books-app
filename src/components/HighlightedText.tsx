import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import type { TextRun } from '@/utils/searchSections';

interface Props {
  runs: TextRun[];
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

// Renders pre-split search-snippet runs with the matched words highlighted.
export function HighlightedText({ runs, style, highlightStyle, numberOfLines }: Props) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {runs.map((r, i) => (r.hit ? <Text key={i} style={highlightStyle}>{r.text}</Text> : r.text))}
    </Text>
  );
}
