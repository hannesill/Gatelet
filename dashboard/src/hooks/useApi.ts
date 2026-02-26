import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthError, dispatchAuthExpired } from '../api';

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const refetch = useCallback(() => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => { if (id === fetchIdRef.current) setData(result); })
      .catch((e) => {
        if (id !== fetchIdRef.current) return;
        if (e instanceof AuthError) {
          dispatchAuthExpired();
          return;
        }
        setError(e.message);
      })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
