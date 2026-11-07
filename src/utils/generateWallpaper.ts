import { Verse } from '@/types';
import { parseSynonyms } from './parseSynonyms';

export interface WallpaperOptions {
  verse: Verse;
  isDark: boolean;
  accent: string;
}

// Compact verse number for the wallpaper label: "BG 2.13", "SB 2.3.2", "CC 2.3.1".
export function shortVerseRef(verse: Verse): string {
  const num = verse.canto
    ? `${verse.canto}.${verse.chapter}.${verse.verse}`
    : `${verse.chapter}.${verse.verse}`;
  return `${verse.bookSlug.toUpperCase()} ${num}`;
}

interface Piece { w: string; color: string; bold: boolean }

// ─── Web-only: HTML Canvas wallpaper download ─────────────────────────────────
// Native (Android) wallpaper is generated in Kotlin via wallpaper-setter module.
// Contains exactly three things — transliteration, word-for-word, translation —
// with font sizes scaled dynamically so the content always fills and fits.

interface Block {
  label: string;
  text: string;
  baseSize: number;     // px at scale 1.0
  align: 'center' | 'left';
  italic: boolean;
  color: string;
  pieces?: Piece[];     // when set, drawn as multi-color runs (word-for-word)
}

export async function generateAndDownloadWallpaper(opts: WallpaperOptions): Promise<void> {
  const { verse, isDark, accent } = opts;

  const W = 1080, H = 2340, pad = 96;
  const inner = W - pad * 2;
  const topMargin = H * 0.10;
  const bottomMargin = H * 0.07;
  const availableH = H - topMargin - bottomMargin;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const bg        = isDark ? '#0E0B07' : '#F5F0E8';
  const textClr   = isDark ? '#EEE4D0' : '#1E140A';
  const secondClr = isDark ? '#C4A870' : '#6B4F28';
  const mutedClr  = isDark ? '#7A6A54' : '#9A8A74';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Word-for-word as multi-color runs: accent word, body-text meaning.
  const synPieces = (s: string): Piece[] => {
    const out: Piece[] = [];
    const pairs = parseSynonyms(s);
    pairs.forEach((p, i) => {
      p.word.split(/\s+/).filter(Boolean).forEach(w => out.push({ w, color: accent, bold: true }));
      if (p.meaning) {
        out.push({ w: '—', color: textClr, bold: false });
        p.meaning.split(/\s+/).filter(Boolean).forEach(w => out.push({ w, color: textClr, bold: false }));
      }
      if (i < pairs.length - 1) out.push({ w: ';', color: mutedClr, bold: false });
    });
    return out;
  };

  const refLabel = shortVerseRef(verse);

  const blocks: Block[] = [];
  if (verse.transliteration) blocks.push({ label: refLabel, text: verse.transliteration.trim(), baseSize: 40, align: 'center', italic: true, color: secondClr });
  if (verse.synonyms)        blocks.push({ label: 'WORD FOR WORD', text: verse.synonyms.trim(), baseSize: 34, align: 'left', italic: false, color: secondClr, pieces: synPieces(verse.synonyms.trim()) });
  if (verse.translation)     blocks.push({ label: 'TRANSLATION', text: verse.translation.trim(), baseSize: 50, align: 'left', italic: false, color: textClr });

  const labelSize = 26;
  const labelGap = 18;
  const blockGap = 56;

  const fontFor = (b: Block, scale: number) =>
    `${b.italic ? 'italic ' : ''}400 ${Math.round(b.baseSize * scale)}px Georgia, serif`;
  const lineHeightFor = (b: Block, scale: number) => Math.round(b.baseSize * scale * 1.35);

  // Total height of the whole stack at a given font scale.
  const stackHeight = (scale: number): number => {
    let total = 0;
    blocks.forEach((b, i) => {
      const lh = lineHeightFor(b, scale);
      let bodyH: number;
      if (b.pieces) {
        bodyH = layoutPieces(ctx, b.pieces, pad, inner, Math.round(b.baseSize * scale), lh, 0, false).lines * lh;
      } else {
        ctx.font = fontFor(b, scale);
        bodyH = measureH(ctx, b.text, inner, lh);
      }
      total += Math.round(labelSize * scale) + labelGap + bodyH;
      if (i < blocks.length - 1) total += blockGap;
    });
    return total;
  };

  let scale = 1.0;
  while (stackHeight(scale) > availableH && scale > 0.35) scale *= 0.93;

  let y = topMargin + Math.max(0, (availableH - stackHeight(scale)) / 2);

  for (const b of blocks) {
    const lh = lineHeightFor(b, scale);
    // Section label.
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(labelSize * scale)}px -apple-system, sans-serif`;
    ctx.textAlign = b.align === 'center' ? 'center' : 'left';
    const labelX = b.align === 'center' ? W / 2 : pad;
    y += Math.round(labelSize * scale);
    ctx.fillText(b.label, labelX, y, inner); // maxWidth squeezes a long verse-reference label
    y += labelGap;

    // Body text.
    if (b.pieces) {
      const r = layoutPieces(ctx, b.pieces, pad, inner, Math.round(b.baseSize * scale), lh, y + lh, true);
      y = r.endY + lh;
    } else {
      ctx.fillStyle = b.color;
      ctx.font = fontFor(b, scale);
      const x = b.align === 'center' ? W / 2 : pad;
      y = wrapCanvas(ctx, b.text, x, inner, lh, y + lh); // first baseline at y+lh
    }
    y += blockGap;
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sloka-wallpaper-${verse.bookSlug}-${verse.chapter}-${verse.verse}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function wrapCanvas(ctx: CanvasRenderingContext2D, text: string, x: number, maxW: number, lh: number, startY: number): number {
  let y = startY;
  for (const rawLine of text.split('\n')) {
    let line = '';
    for (const word of rawLine.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y); y += lh; line = word;
      } else { line = test; }
    }
    if (line) { ctx.fillText(line, x, y); y += lh; }
  }
  return y;
}

// Word-wraps multi-color pieces (each its own font/color). Measures when
// draw=false (returns line count) and renders when draw=true.
function layoutPieces(
  ctx: CanvasRenderingContext2D, pieces: Piece[], x: number, maxW: number,
  sizePx: number, lh: number, startBaseline: number, draw: boolean,
): { lines: number; endY: number } {
  let y = startBaseline, cursor = 0, lines = 1;
  const fontOf = (p: Piece) => `${p.bold ? '700' : '400'} ${sizePx}px Georgia, serif`;
  for (const p of pieces) {
    ctx.font = fontOf(p);
    const wW = ctx.measureText(p.w).width;
    const spaceW = ctx.measureText(' ').width;
    const sp = cursor > 0 ? spaceW : 0;
    if (cursor > 0 && cursor + sp + wW > maxW) { y += lh; cursor = 0; lines++; }
    if (draw) {
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(p.w, x + cursor + (cursor > 0 ? spaceW : 0), y);
    }
    cursor += (cursor > 0 ? spaceW : 0) + wW;
  }
  return { lines, endY: y };
}

function measureH(ctx: CanvasRenderingContext2D, text: string, maxW: number, lh: number): number {
  let lines = 0;
  for (const rawLine of text.split('\n')) {
    let line = '';
    for (const word of rawLine.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { lines++; line = word; } else { line = test; }
    }
    if (line) lines++;
  }
  return lines * lh;
}
