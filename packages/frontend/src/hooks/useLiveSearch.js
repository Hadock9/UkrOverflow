/**
 * Debounced live search (GET /api/search/live).
 */

import { useEffect, useState } from 'react';
import { search } from '../services/api';

export function useLiveSearch(query, { debounceMs = 280, minChars = 2, enabled = true } = {}) {
  const [debouncedQ, setDebouncedQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(String(query || '').trim()), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  useEffect(() => {
    if (!enabled || debouncedQ.length < minChars) {
      setData(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    search
      .live(debouncedQ, { signal: controller.signal })
      .then((res) => {
        setData(res.data?.data || null);
      })
      .catch((e) => {
        if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
        setError(e.response?.data?.message || 'Помилка пошуку');
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQ, enabled, minChars]);

  const active = debouncedQ.length >= minChars;
  const hits = data?.hits || [];
  const tags = data?.tags || [];
  const news = data?.news || [];
  const isEmpty = active && !loading && hits.length === 0 && tags.length === 0 && news.length === 0;

  return {
    debouncedQ,
    loading,
    error,
    hits,
    tags,
    news,
    active,
    isEmpty,
    total: data?.total ?? hits.length + tags.length + news.length,
  };
}
