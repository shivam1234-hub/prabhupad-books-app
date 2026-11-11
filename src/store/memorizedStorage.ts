import * as SecureStore from 'expo-secure-store';

const KEY = 'memorized_slokas';

export async function loadMemorized(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function saveMemorized(value: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, value);
}
