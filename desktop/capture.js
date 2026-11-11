// Screenshot harness for developing the desktop UI — only runs when
// VEDABASE_CAPTURE_PLAN points at a JSON plan; never in normal use.
//
// Plan: [{ "name": "verse-light", "route": "/verse?book=bg&chapter=2&verse=13",
//          "theme": "light", "w": 1440, "h": 900, "wait": 4000,
//          "js": "optional script run after load", "jsWait": 800 }]
// PNGs (and a console log) go to VEDABASE_CAPTURE_DIR.
const fs = require('fs');
const path = require('path');
const { app, powerSaveBlocker } = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(win, { plan, base }) {
  const shots = JSON.parse(fs.readFileSync(plan, 'utf8'));
  powerSaveBlocker.start('prevent-display-sleep');
  const outDir = process.env.VEDABASE_CAPTURE_DIR || path.dirname(plan);
  fs.mkdirSync(outDir, { recursive: true });
  const log = fs.createWriteStream(path.join(outDir, 'console.log'), { flags: 'a' });
  win.webContents.on('console-message', (e) => {
    const lvl = e.level ?? '';
    log.write(`[${lvl}] ${e.message} (${e.sourceId ?? ''}:${e.lineNumber ?? ''})\n`);
  });

  const load = async (url) => {
    await win.loadURL(url).catch(() => {});
  };

  await load(`${base}/`);
  await sleep(1500);

  for (const shot of shots) {
    try {
      win.setContentSize(shot.w || 1440, shot.h || 900);
      if (shot.theme) {
        await win.webContents.executeJavaScript(`(() => {
          const k = 'vedabase_settings';
          let s = {}; try { s = JSON.parse(localStorage.getItem(k) || '{}'); } catch {}
          s.themeMode = ${JSON.stringify(shot.theme)}; s.tourSeen = s.tourSeen ?? true;
          localStorage.setItem(k, JSON.stringify(s));
        })()`);
      }
      log.write(`--- ${shot.name} ${shot.route}\n`);
      await load(`${base}${shot.route}`);
      await sleep(shot.wait ?? 3500);
      if (shot.js) {
        const r = await win.webContents.executeJavaScript(shot.js).catch((e) => `ERR ${e}`);
        if (r !== undefined) log.write(`js -> ${JSON.stringify(r)}\n`);
        await sleep(shot.jsWait ?? 800);
      }
      let img;
      for (let attempt = 0; attempt < 4 && !img; attempt++) {
        try { img = await win.webContents.capturePage(); }
        catch (e) { log.write(`capture retry ${attempt}: ${e}\n`); win.showInactive(); win.webContents.invalidate(); await sleep(1500); }
      }
      if (!img) throw new Error('capture failed');
      fs.writeFileSync(path.join(outDir, `${shot.name}.png`), img.toPNG());
      log.write(`saved ${shot.name}.png\n`);
    } catch (e) {
      log.write(`FAILED ${shot.name}: ${e}\n`);
    }
  }
  log.end();
  app.quit();
}

module.exports = { run };
