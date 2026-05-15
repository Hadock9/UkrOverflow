/**
 * Debounced live search (GET /api/search/live).
 */

import { useEffect, useState } from 'react';
import { search } from '../services/api';

export function useLiveSearch(
  query,
  { debounceMs = 280, minChars = 2, enabled = true, scope = 'all' } = {},
) {
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
      .live(debouncedQ, { signal: controller.signal, params: { scope } })
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
  }, [debouncedQ, enabled, minChars, scope]);

  const active = debouncedQ.length >= minChars;
  const hits = data?.hits || [];
  const tags = data?.tags || [];
  const news = data?.news || [];
  const communities = data?.communities || [];
  const mentors = data?.mentors || [];
  const users = data?.users || [];
  const total =
    data?.total ??
    hits.length + tags.length + news.length + communities.length + mentors.length + users.length;
  const isEmpty =
    active &&
    !loading &&
    total === 0;

  return {
    debouncedQ,
    loading,
    error,
    hits,
    tags,
    news,
    communities,
    mentors,
    users,
    active,
    isEmpty,
    total,
    scope,
  };
}
