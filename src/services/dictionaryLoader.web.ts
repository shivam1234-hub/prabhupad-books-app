import { Asset } from 'expo-asset';

export type DictionaryName = 'wordnet' | 'apte' | 'forms' | 'verbtables';

const ASSETS: Record<DictionaryName, () => number> = {
  wordnet: () => require('../../assets/dictionary/wordnet.dict'),
  apte: () => require('../../assets/dictionary/apte.dict'),
  forms: () => require('../../assets/dictionary/forms.dict'),
  verbtables: () => require('../../assets/dictionary/verbtables.dict'),
};

/**
 * Web/desktop counterpart of dictionaryLoader.ts. The desktop app serves the
 * exported bundle (assets included) from its own app:// protocol handler
 * (desktop/main.js), so this fetch never leaves the machine.
 */
export async function loadDictionaryText(name: DictionaryName = 'wordnet'): Promise<string> {
  const asset = Asset.fromModule(ASSETS[name]());
  const res = await fetch(asset.uri);
  if (!res.ok) throw new Error(`Dictionary asset returned ${res.status}`);
  return res.text();
}
