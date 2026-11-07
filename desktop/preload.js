// The only bridge between the Expo web bundle (renderer) and Node/Electron.
//
// contextIsolation stays on and nodeIntegration stays off: page script gets a
// small, fixed surface — a named database call, a fetch restricted to the two
// content hosts, and desktop notifications — never `require` or raw IPC.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vedabaseDesktop', {
  platform: process.platform,
  version: process.versions.electron,

  // Named call into desktop/db.js's dispatch table (SQLite, FTS5).
  db: (method, args = []) => ipcRenderer.invoke('vedabase:db', method, args),

  // Fetch a vedabase.io / vanisource.org URL through the main process.
  fetchText: (url) => ipcRenderer.invoke('vedabase:fetch', url),

  // Native OS notification — the desktop stand-in for the phone's lock-screen sloka.
  notify: (title, body) => ipcRenderer.invoke('vedabase:notify', title, body),

  // Ask main to (re)arm the daily sloka notification at HH:mm local time.
  scheduleDailySloka: (time, enabled) =>
    ipcRenderer.invoke('vedabase:schedule-sloka', time, enabled),

  // Main asks the renderer for today's sloka text when the timer fires — the
  // book/verse-picking logic lives in the shared app code, not duplicated here.
  onSlokaDue: (handler) => {
    ipcRenderer.on('vedabase:sloka-due', () => handler());
  },

  // Where the offline library lives + how big it is (Settings screen).
  storageInfo: () => ipcRenderer.invoke('vedabase:storage-info'),
  revealStorage: () => ipcRenderer.invoke('vedabase:reveal-storage'),
});
