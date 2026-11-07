// Node ESM resolution hook so plain `node --import ./scripts/ts-node-loader.mjs`
// can run test scripts that import app source using the babel `@/` alias and
// extensionless relative specifiers, without pulling in Metro/babel at all.
// Node's built-in TS type-stripping (>=22.6) handles the TS syntax itself —
// this hook only teaches the resolver two tricks the app's bundler normally
// does for us: `@/x` -> `src/x`, and appending a `.ts`/`.tsx` extension when
// a specifier has none.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS = ['.ts', '.tsx', '.mts'];

register(pathToFileURL(path.join(ROOT, 'scripts', 'ts-node-hooks.mjs')).href, import.meta.url);
