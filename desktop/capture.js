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
      if (win.isFullScreen()) win.setFullScreen(false);
      if (win.isMaximized()) win.unmaximize();
      win.setContentSize(shot.w || 1440, shot.h || 900);
      win.webContents.setZoomFactor(shot.zoom || 1);
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
      // Real mouse clicks: each `clicks` entry is a script returning {x, y}
      // (CSS px, window coordinates) of the element to click.
      for (const c of shot.clicks || []) {
        if (c.type) {
          for (const ch of c.type) {
            if (ch === '\n') {
              win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
              win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
              win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
            } else {
              win.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch });
              win.webContents.sendInputEvent({ type: 'char', keyCode: ch });
              win.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch });
            }
            await sleep(60);
          }
          await sleep(c.wait ?? 800);
          const h = await win.webContents.executeJavaScript('location.pathname + location.search').catch(() => '?');
          log.write(`after typing -> ${h}\n`);
          continue;
        }
        const pt = await win.webContents.executeJavaScript(c.at).catch((e) => `ERR ${e}`);
        log.write(`click target -> ${JSON.stringify(pt)}\n`);
        if (pt && typeof pt.x === 'number' && c.hoverOnly) {
          win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(pt.x) - 30, y: Math.round(pt.y) });
          await sleep(80);
          win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(pt.x), y: Math.round(pt.y) });
        } else if (pt && typeof pt.x === 'number') {
          const x = Math.round(pt.x); const y = Math.round(pt.y);
          win.webContents.sendInputEvent({ type: 'mouseMove', x, y });
          await sleep(120);
          win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: c.button || 'left', clickCount: 1 });
          await sleep(c.hold ?? 60);
          const ux = x + (c.dx || 0); const uy = y + (c.dy || 0);
          if (c.dx || c.dy) { win.webContents.sendInputEvent({ type: 'mouseMove', x: x + Math.round((c.dx||0)/2), y: uy, modifiers: ['leftButtonDown'] }); await sleep(30); win.webContents.sendInputEvent({ type: 'mouseMove', x: ux, y: uy, modifiers: ['leftButtonDown'] }); await sleep(40); }
          win.webContents.sendInputEvent({ type: 'mouseUp', x: ux, y: uy, button: c.button || 'left', clickCount: 1 });
          if (c.double) {
            await sleep(60);
            win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 2 });
            await sleep(40);
            win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 2 });
          }
        }
        await sleep(c.wait ?? 1500);
        const href = await win.webContents.executeJavaScript('location.pathname + location.search').catch(() => '?');
        log.write(`after click -> ${href}\n`);
      }
      if (shot.jsAfter) {
        const r = await win.webContents.executeJavaScript(shot.jsAfter).catch((e) => `ERR ${e}`);
        log.write(`jsAfter -> ${JSON.stringify(r)}\n`);
        await sleep(shot.jsAfterWait ?? 800);
        const h = await win.webContents.executeJavaScript('location.pathname + location.search').catch(() => '?');
        log.write(`after jsAfter -> ${h}\n`);
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
