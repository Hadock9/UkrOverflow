/**
 * Жива стрічка: завантаження + інкрементальні оновлення з WebSocket.
 */

import { useCallback, useEffect, useState } from 'react';
import { activity as activityApi } from '../services/api';
import wsClient from '../services/websocket';
import { emptyLiveFeed, handleActivityWsPayload } from '../utils/liveActivityState';

export function useLiveActivity({ pollMs = 30000, eventLimit = 40 } = {}) {
  const [feed, setFeed] = useState(emptyLiveFeed);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await activityApi.getLive({ limit: eventLimit });
      setFeed(res.data.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [eventLimit]);

  useEffect(() => {
    load();
    const unsub = wsClient.on('activity', (payload) => {
      setFeed((prev) => handleActivityWsPayload(prev, payload));
      if (!payload?.type) load();
    });
    const interval = pollMs > 0 ? setInterval(load, pollMs) : null;
    return () => {
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [load, pollMs]);

  return { feed, loading, reload: load, totals: feed.totals || {} };
}
