# Desktop shell

Electron wrapper that turns the existing Expo app into a Windows/macOS/Linux
desktop application. See the "Desktop App" section of the root `README.md` for
build and run instructions — this file covers how it fits together.

## The idea

There is no second UI. `npm run desktop:bundle` runs `expo export --platform web`,
and the resulting bundle in `dist-desktop/` is what the Electron window renders.
Every screen, route, store and style is the shared app code, so a change to
`app/` or `src/` shows up on phone and desktop alike.

What the main process supplies is only what a browser cannot:

| File | Responsibility |
|---|---|
| `main.js` | Window, `app://` protocol that serves the bundle, menu, IPC wiring, daily-sloka timer |
| `preload.js` | The single `window.vedabaseDesktop` bridge (context-isolated) |
| `db.js` | SQLite + FTS5 — schema and SQL copied from `src/database/db.ts` / `queries.ts` |
| `net.js` | Fetches vedabase.io / vanisource.org from the main process (no CORS) |

## How the renderer reaches them

The web build already had `.web.ts` variants for the native-only modules. Those
now branch on whether the bridge exists:

```
src/database/queries.web.ts     dispatcher — picks one of:
  ├─ queries.desktop.ts         -> IPC -> desktop/db.js   (real SQLite, full offline library)
  └─ queries.browser.ts         -> localStorage           (plain browser, unchanged)
```

`src/database/desktopBridge.ts` is the single place that answers "are we in
Electron?". `src/services/vedabaseApi.web.ts` and `notifications.web.ts` branch the
same way, so `npm run web:dev` in a browser still behaves exactly as before.

Search ranking is deliberately *not* duplicated here: `db.js` only pulls an FTS5
candidate pool, and the shared `rankVerses()` scorer orders it in the renderer, so
desktop results match mobile.

## Notes and gotchas

- **No native modules.** SQLite is `node-sqlite3-wasm` (pure WASM, FTS5 compiled
  in). That is what lets a Windows installer be cross-built from macOS or Linux.
  Introducing a native dependency would break that — prefer a WASM equivalent.
- **The window loads `app://bundle/`, not `.../index.html`.** expo-router routes
  off the URL path, and `/index.html` is an unmatched route that lands on the
  not-found screen.
- **`app.setName('Vedabase')` runs before anything touches `userData`**, so a dev
  run and an installed run read the same offline library.
- **`electron-builder.yml` excludes `node_modules` and re-includes only
  `node-sqlite3-wasm`.** Without that, the whole React Native/Expo toolchain gets
  packaged.
- `VEDABASE_BUNDLE_DIR` overrides which exported bundle is served — useful for
  testing a build without re-exporting.
