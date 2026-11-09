const KEY = 'vedabase_memorized_slokas';

export async function loadMemorized(): Promise<string | null> {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export async function saveMemorized(value: string): Promise<void> {
  try { localStorage.setItem(KEY, value); } catch { /* storage unavailable */ }
}
