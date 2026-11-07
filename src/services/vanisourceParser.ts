// Vanisource (MediaWiki) adapter — pure URL + content-extraction helpers.
// Vanisource book pages are reached via the MediaWiki API (the /wiki/ HTML is
// Cloudflare-protected, but the API responds). Each chapter is a page whose
// title is its pageId; content is prose extracted from the rendered HTML.
export const VS_BASE = 'https://vanisource.org';

// Slugs of books sourced from vanisource (kept in sync with vanisourceData.ts).
// Hardcoded so this module stays dependency-free (Node-testable, no path alias).
const VANISOURCE_SLUGS = new Set([
  'ej', 'ekc', 'tys', 'mg', 'nbs', 'ttpm', 'otk', 'pop', 'poy', 'mms',
  'lfl', 'josd', 'asc', 'dwt', 'cat', 'rtw', 'lon', 'qfe', 'bid', 'tmg',
]);

// `lec-*`, `let-*` and `conv-*` are the lecture / letter / conversation sections
// generated into vanisourceExtras.ts. Matched by prefix so this module stays
// dependency-free (Node-testable, no path alias) as the catalog grows.
const EXTRA_SLUG_RE = /^(lec|let|conv)-/;

export function isVanisourceBook(slug: string): boolean {
  return VANISOURCE_SLUGS.has(slug) || EXTRA_SLUG_RE.test(slug);
}

// MediaWiki API: render a page to HTML.
export function buildVanisourceUrl(pageTitle: string): string {
  return `${VS_BASE}/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&formatversion=2&redirects=1`;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\[edit\]/gi, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// Extract readable prose from a MediaWiki action=parse JSON response.
// Skips the nav (float) divs, figures, tables, footnotes — keeps paragraphs
// and headings in document order.
export function extractVanisourceProse(jsonOrObj: string | any): string {
  let obj: any;
  try {
    obj = typeof jsonOrObj === 'string' ? JSON.parse(jsonOrObj) : jsonOrObj;
  } catch {
    return '';
  }
  // formatversion=2 → parse.text is a string; v1 → parse.text['*'].
  let html: string = obj?.parse?.text;
  if (html && typeof html === 'object') html = html['*'];
  if (!html || typeof html !== 'string') return '';

  // Remove non-prose blocks.
  html = html
    .replace(/<(script|style|table|figure|sup)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<div[^>]*style="float[^"]*"[\s\S]*?<\/div>/gi, ''); // prev/next nav

  const blocks: string[] = [];
  const re = /<(p|h2|h3|h4|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[2]);
    if (text && text.length > 1) blocks.push(text);
  }
  return blocks.join('\n\n');
}
