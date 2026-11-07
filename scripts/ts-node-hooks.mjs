// Module customization hook (see ts-node-loader.mjs). Rewrites the babel
// `@/` alias to `src/`, and probes for `.ts`/`.tsx` when a specifier has no
// extension — the two things the app's Metro/babel setup normally does for
// source files, so test scripts can import them directly under plain Node.
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS = ['.ts', '.tsx', '.mts'];

function isFile(p) {
  try { return statSync(p).isFile(); } catch { return false; }
}

function withExtension(filePath) {
  if (isFile(filePath)) return filePath;
  for (const ext of EXTENSIONS) {
    if (isFile(filePath + ext)) return filePath + ext;
  }
  for (const ext of EXTENSIONS) {
    const indexPath = path.join(filePath, 'index' + ext);
    if (isFile(indexPath)) return indexPath;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const abs = withExtension(path.join(ROOT, 'src', specifier.slice(2)));
    if (abs) return nextResolve(pathToFileURL(abs).href, context);
  } else if (specifier.startsWith('.') && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const abs = withExtension(path.resolve(parentDir, specifier));
    if (abs) return nextResolve(pathToFileURL(abs).href, context);
  }
  return nextResolve(specifier, context);
}
