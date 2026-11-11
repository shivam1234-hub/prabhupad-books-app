// Electron main process for the Vedabase desktop app (Windows / macOS / Linux).
//
// The renderer is the *same* Expo web bundle the mobile app compiles to, exported
// with `expo export --platform web`. Nothing about the screens, navigation or
// styling is re-implemented here; this process only supplies the three things a
// browser cannot: a real SQLite database (desktop/db.js), cross-origin fetches
// to vedabase.io (desktop/net.js), and OS notifications.
const path = require('path');
const fs = require('fs');
const {
  app, BrowserWindow, protocol, net, ipcMain, shell, Menu, Notification, dialog, nativeTheme,
} = require('electron');

const db = require('./db');
const { fetchText } = require('./net');

// Exported web bundle, produced by `npm run desktop:bundle`. The env override
// exists so a bundle can be swapped in for testing without a rebuild.
const BUNDLE_DIR = process.env.VEDABASE_BUNDLE_DIR
  || path.join(__dirname, '..', 'dist-desktop');
// Set by `npm run desktop:dev` to point at the live Metro dev server instead.
const DEV_URL = process.env.VEDABASE_DEV_URL || null;

// The bundle's index.html references assets by absolute path (/_expo/..., /favicon.ico).
// Serving it over a custom standard scheme rather than file:// makes those
// resolve, and gives the renderer a stable origin so localStorage (settings,
// history, favourites cache) persists across launches.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// Pin the app name before anything resolves userData. Without this the name
// comes from package.json (Expo's "prabhupad-books-app") when run unpackaged but
// from productName ("Vedabase") once installed, so a dev run and an installed
// run would read two different offline libraries.
app.setName('Vedabase');

// Local testing only (both OFF unless the env var is set, never in a shipped
// build's defaults): a separate profile directory, and accepting a
// TLS-intercepting corporate proxy's certificates.
if (process.env.VEDABASE_USER_DATA) app.setPath('userData', process.env.VEDABASE_USER_DATA);
if (process.env.VEDABASE_INSECURE_TLS === '1') app.commandLine.appendSwitch('ignore-certificate-errors');
// Screenshot mode (desktop/capture.js): render pages and save PNGs, then quit.
const CAPTURE_PLAN = process.env.VEDABASE_CAPTURE_PLAN || null;

let mainWindow = null;

// --- Window bounds, remembered between launches -----------------------------

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (typeof s.width === 'number' && typeof s.height === 'number') return s;
  } catch { /* first launch, or unreadable — fall through to defaults */ }
  return { width: 1360, height: 860 };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const b = mainWindow.getNormalBounds();
    fs.writeFileSync(
      stateFile(),
      JSON.stringify({ ...b, maximized: mainWindow.isMaximized() })
    );
  } catch { /* best-effort */ }
}

// --- Serving the exported bundle -------------------------------------------

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '');

    // Resolve inside BUNDLE_DIR and reject anything that escapes it.
    const target = path.resolve(BUNDLE_DIR, rel);
    const root = path.resolve(BUNDLE_DIR);
    if (target !== root && !target.startsWith(root + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    // SPA fallback: expo-router owns client-side routing, so any path that
    // isn't a real file (/verse, /book/bg, …) must still serve index.html.
    const file = fs.existsSync(target) && fs.statSync(target).isFile()
      ? target
      : path.join(root, 'index.html');

    return net.fetch(`file://${file.split(path.sep).join('/')}`);
  });
}

// --- Daily sloka notification ----------------------------------------------
// The phone schedules this through expo-notifications. Here main just holds a
// timer and pings the renderer, which picks the verse using the same shared
// pickDailySloka() logic and calls back with the text to show.

let slokaTimer = null;

function scheduleDailySloka(time, enabled) {
  if (slokaTimer) { clearTimeout(slokaTimer); slokaTimer = null; }
  if (!enabled) return;

  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || '06:00'));
  if (!m) return;
  const hour = Math.min(23, parseInt(m[1], 10));
  const minute = Math.min(59, parseInt(m[2], 10));

  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  slokaTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vedabase:sloka-due');
    }
    scheduleDailySloka(time, enabled); // re-arm for tomorrow
  }, next.getTime() - now.getTime());
}

// --- IPC --------------------------------------------------------------------

function registerIpc() {
  ipcMain.handle('vedabase:db', (_e, method, args) => {
    const fn = db.api[method];
    // Only the names defined in db.js's table are callable — a renderer can't
    // reach arbitrary properties (constructor, __proto__, …).
    if (typeof fn !== 'function' || !Object.prototype.hasOwnProperty.call(db.api, method)) {
      throw new Error(`Unknown db method: ${method}`);
    }
    return fn(...(Array.isArray(args) ? args : []));
  });

  ipcMain.handle('vedabase:fetch', (_e, url) => fetchText(url));

  ipcMain.handle('vedabase:notify', (_e, title, body) => {
    if (!Notification.isSupported()) return false;
    new Notification({ title: String(title), body: String(body) }).show();
    return true;
  });

  ipcMain.handle('vedabase:schedule-sloka', (_e, time, enabled) => {
    scheduleDailySloka(time, enabled);
    return true;
  });

  ipcMain.handle('vedabase:storage-info', () => {
    const file = db.dbFile(app.getPath('userData'));
    let bytes = 0;
    try { bytes = fs.statSync(file).size; } catch { /* not created yet */ }
    return { path: file, bytes, ...db.api.stats() };
  });

  ipcMain.handle('vedabase:dialog', async (_e, opts = {}) => {
    const buttons = Array.isArray(opts.buttons) && opts.buttons.length ? opts.buttons.map(String) : ['OK'];
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'none',
      title: 'Vedabase',
      message: String(opts.title || ''),
      detail: opts.message ? String(opts.message) : undefined,
      buttons,
      defaultId: Number.isInteger(opts.defaultId) ? opts.defaultId : 0,
      cancelId: Number.isInteger(opts.cancelId) ? opts.cancelId : buttons.length - 1,
      noLink: true,
    });
    return response;
  });

  ipcMain.handle('vedabase:open-external', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) { shell.openExternal(url); return true; }
    return false;
  });

  ipcMain.on('vedabase:app-version', (e) => {
    // Unpackaged, app.getVersion() is Electron's own version; the app's is in package.json.
    let v = app.getVersion();
    if (!app.isPackaged) { try { v = require('../package.json').version; } catch { /* keep */ } }
    e.returnValue = v;
  });

  ipcMain.handle('vedabase:reveal-storage', () => {
    shell.showItemInFolder(db.dbFile(app.getPath('userData')));
    return true;
  });
}

// --- Menu -------------------------------------------------------------------

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Library Folder',
          click: () => shell.showItemInFolder(db.dbFile(app.getPath('userData'))),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        // Reload / DevTools are developer tools — only in an unpackaged run.
        ...(app.isPackaged ? [] : [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
        ]),
        // Reading app — text size matters, so keep zoom prominent.
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Keyboard Shortcuts',
            message: 'Keyboard shortcuts',
            detail: [
              'Ctrl+K  Search the library',
              'Ctrl+F  Find in this page (verse pages)',
              '← / →  Previous / next verse or chapter',
              'Alt+← / Alt+→  Back / forward',
              '[  Show / hide the contents sidebar',
              'Esc  Close a popup',
              'Ctrl + / Ctrl −  Zoom the whole window',
            ].join('\n'),
            buttons: ['OK'],
          }),
        },
        { type: 'separator' },
        {
          label: 'Vedabase.io',
          click: () => shell.openExternal('https://vedabase.io'),
        },
        {
          label: 'About Vedabase',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About Vedabase',
            message: 'Vedabase — Śrīla Prabhupāda\'s books',
            detail: `Version ${app.getVersion()}\n\nContent © Bhaktivedanta Book Trust, from vedabase.io.`,
            buttons: ['OK'],
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Startup ----------------------------------------------------------------

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1000,
    minHeight: 640,
    title: 'Vedabase',
    // Matches the page background so the window never flashes orange/white.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#100D08' : '#F7F3EC',
    show: false,
    autoHideMenuBar: process.platform === 'win32',
    icon: process.platform === 'darwin' ? undefined : path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  if (state.maximized && !CAPTURE_PLAN) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());

  for (const ev of ['resize', 'move', 'close']) {
    mainWindow.on(ev, saveWindowState);
  }
  mainWindow.on('closed', () => { mainWindow = null; });

  // External links (vedabase.io, audio sources) open in the real browser rather
  // than replacing the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://') && !(DEV_URL && url.startsWith(DEV_URL))) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  // Load the ROOT path, not /index.html: expo-router routes off location
  // pathname, and "/index.html" is itself an unmatched route that would land
  // the app on the not-found screen every launch.
  registerHistoryShortcuts(mainWindow);

  if (CAPTURE_PLAN) {
    require('./capture').run(mainWindow, { plan: CAPTURE_PLAN, base: DEV_URL || 'app://bundle', nativeTheme });
    return;
  }
  if (DEV_URL) mainWindow.loadURL(DEV_URL);
  else mainWindow.loadURL('app://bundle/');
}

// Desktop users reach for the mouse's side buttons and Alt+Left; neither exists
// on a phone. expo-router drives the browser History API, so delegating to
// history.back()/forward() moves the app stack exactly as the on-screen back
// button does.
function navigateHistory(win, delta) {
  win.webContents
    .executeJavaScript(`window.__vbNav ? window.__vbNav(${delta}) : window.history.go(${delta})`)
    .catch(() => { /* nothing to go back to */ });
}

function registerHistoryShortcuts(win) {
  // Windows/Linux mouse back & forward buttons.
  win.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward') { e.preventDefault(); navigateHistory(win, -1); }
    else if (cmd === 'browser-forward') { e.preventDefault(); navigateHistory(win, 1); }
  });

  // macOS trackpad two-finger swipe.
  win.on('swipe', (e, direction) => {
    if (direction === 'left') navigateHistory(win, -1);
    else if (direction === 'right') navigateHistory(win, 1);
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const back =
      (input.alt && input.key === 'ArrowLeft') ||            // Windows/Linux
      (input.meta && input.key === '[') ||                   // macOS
      (input.meta && input.key === 'ArrowLeft');
    const forward =
      (input.alt && input.key === 'ArrowRight') ||
      (input.meta && input.key === ']') ||
      (input.meta && input.key === 'ArrowRight');
    if (back) { event.preventDefault(); navigateHistory(win, -1); }
    else if (forward) { event.preventDefault(); navigateHistory(win, 1); }
  });
}

// Second launch focuses the running window instead of opening a duplicate that
// would fight over the same SQLite file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    db.open(app.getPath('userData'));
    registerAppProtocol();
    registerIpc();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Flush SQLite (WAL checkpoint happens on close) before the process exits.
  app.on('before-quit', () => { saveWindowState(); db.close(); });
}
