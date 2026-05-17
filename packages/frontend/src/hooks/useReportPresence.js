/**
 * Глобальна присутність: статус за маршрутом + явний override (кімната, форма).
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { activity as activityApi } from '../services/api';

const STATUSES = ['asking', 'answering', 'learning', 'in_room'];

/** Явний статус (наприклад, у кімнаті після join) — має пріоритет над маршрутом. */
let explicitPresence = null;

export function setExplicitPresence(presence) {
  explicitPresence = presence;
  if (presence?.status) {
    activityApi.setPresence(presence).catch(() => {});
  }
}

export function clearExplicitPresence({ fallbackStatus = 'learning', context = {} } = {}) {
  explicitPresence = null;
  activityApi
    .setPresence({ status: fallbackStatus, context })
    .catch(() => {});
}

function statusFromPath(pathname) {
  if (/^\/questions\/new$|^\/ask$/.test(pathname)) {
    return { status: 'asking', context: { page: 'new_question' } };
  }
  if (/^\/questions\/\d+$/.test(pathname)) {
    return { status: 'answering', context: { page: 'question' } };
  }
  if (/^\/pair-rooms\/[^/]+$/.test(pathname)) {
    return null;
  }
  if (/^\/challenges$/.test(pathname)) {
    return { status: 'learning', context: { page: 'challenges' } };
  }
  if (/^\/activity$/.test(pathname)) {
    return { status: 'learning', context: { page: 'activity' } };
  }
  if (/^\/hub|^\/articles|^\/guides|^\/snippets|^\/roadmaps|^\/best-practices|^\/faqs/.test(pathname)) {
    return { status: 'learning', context: { page: 'hub' } };
  }
  return { status: 'learning', context: { page: 'browse' } };
}

function resolvePresence(pathname) {
  if (explicitPresence?.status && STATUSES.includes(explicitPresence.status)) {
    return explicitPresence;
  }
  return statusFromPath(pathname);
}

export function useReportPresence() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const lastSent = useRef('');

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const send = () => {
      const p = resolvePresence(location.pathname);
      if (!p?.status) return;
      const key = JSON.stringify(p);
      if (key === lastSent.current) return;
      lastSent.current = key;
      activityApi.setPresence(p).catch(() => {});
    };

    send();
    const interval = setInterval(send, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, location.pathname]);
}
