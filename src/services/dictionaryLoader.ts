import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

export type DictionaryName = 'wordnet' | 'apte' | 'forms' | 'verbtables';

// Literal requires so Metro bundles both files as assets.
const ASSETS: Record<DictionaryName, () => number> = {
  wordnet: () => require('../../assets/dictionary/wordnet.dict'),
  apte: () => require('../../assets/dictionary/apte.dict'),
  forms: () => require('../../assets/dictionary/forms.dict'),
  verbtables: () => require('../../assets/dictionary/verbtables.dict'),
};

/**
 * Read a bundled dictionary file (assets/dictionary/*.dict) as text: WordNet
 * for English, Apte (scripts/build-apte.py) for the Sanskrit sandhi splitter.
 *
 * It is an asset inside the app binary, so this works with no connection. In a
 * dev build `downloadAsync` pulls it from Metro once; in a release build it
 * resolves the copy packaged in the APK. The web/desktop side is in
 * dictionaryLoader.web.ts.
 */
export async function loadDictionaryText(name: DictionaryName = 'wordnet'): Promise<string> {
  const asset = Asset.fromModule(ASSETS[name]());
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Dictionary asset has no local file');
  return new File(asset.localUri).text();
}
