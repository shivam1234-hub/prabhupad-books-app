import { useState, useCallback, useRef } from 'react';
import { Verse } from '@/types';
import { searchVerses } from '@/database/queries';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((text: string, bookSlug?: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchVerses(text.trim(), bookSlug, 60);
        setResults(rows);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return { query, results, loading, search, clear };
}
