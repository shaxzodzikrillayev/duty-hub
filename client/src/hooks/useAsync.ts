import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
}

/** Небольшой хук для загрузки данных с защитой от гонок и от размонтирования. */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = [], skip = false): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await run();
      if (alive.current && id === requestId.current) setData(result);
    } catch (err) {
      if (alive.current && id === requestId.current) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
      }
    } finally {
      if (alive.current && id === requestId.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }
    void reload();
  }, [reload, skip]);

  const update = useCallback((updater: T | ((prev: T | null) => T | null)) => {
    setData((prev) => (typeof updater === 'function' ? (updater as (p: T | null) => T | null)(prev) : updater));
  }, []);

  return { data, loading, error, reload, setData: update };
}
