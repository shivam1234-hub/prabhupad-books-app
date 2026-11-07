// Network layer for the desktop build.
//
// This replaces cors-proxy.js: in the browser, the renderer cannot fetch
// vedabase.io cross-origin, so `npm run web:dev` needs a local Express proxy.
// In Electron the main process has no CORS restriction, so the renderer asks
// main to fetch and gets the raw HTML/JSON back over IPC — no proxy to start,
// nothing extra to install on the user's machine.
const { net } = require('electron');

const TIMEOUT_MS = 20000;

// Same header set cors-proxy.js sends via curl — vedabase.io serves a bot
// challenge page instead of content to requests that don't look like a browser.
const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

const ALLOWED_HOSTS = new Set(['vedabase.io', 'www.vedabase.io', 'vanisource.org', 'www.vanisource.org']);

// Returns the response body as text, or null on any failure. Null means "could
// not reach it" — the renderer already treats that as a network error and falls
// back to cached/offline content, exactly as on mobile.
async function fetchText(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  // The renderer is only ever allowed to drive this at the two content hosts —
  // it must not become a general-purpose proxy reachable from page script.
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await net.fetch(url.toString(), {
      method: 'GET',
      headers: HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchText };
