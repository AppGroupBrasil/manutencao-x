import { useState, useEffect, useCallback, useRef } from 'react';

interface CrudApi<T> {
  list: () => Promise<T[]>;
  create: (data: Partial<T>) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<any>;
}

interface UseApiResourceReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  add: (item: Partial<T>) => Promise<T>;
  edit: (id: string, item: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export function useApiResource<T extends { id: string }>(
  api: CrudApi<T>,
  autoLoad = true
): UseApiResourceReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list();
      const rows = Array.isArray(result) ? result : (result as any)?.data ?? [];
      if (mounted.current) setData(rows);
    } catch (e: any) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (autoLoad) reload();
  }, [autoLoad, reload]);

  const add = useCallback(async (item: Partial<T>): Promise<T> => {
    const created = await api.create(item);
    if (mounted.current) setData(prev => [created, ...prev]);
    return created;
  }, [api]);

  const edit = useCallback(async (id: string, item: Partial<T>): Promise<T> => {
    const updated = await api.update(id, item);
    if (mounted.current) setData(prev => prev.map(d => d.id === id ? updated : d));
    return updated;
  }, [api]);

  const remove = useCallback(async (id: string): Promise<void> => {
    await api.remove(id);
    if (mounted.current) setData(prev => prev.filter(d => d.id !== id));
  }, [api]);

  return { data, loading, error, reload, add, edit, remove };
}
