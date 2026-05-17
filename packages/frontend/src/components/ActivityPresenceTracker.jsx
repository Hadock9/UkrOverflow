/**
 * Невидимий компонент — оновлює статус «хто зараз онлайн» за маршрутом.
 */

import { useReportPresence } from '../hooks/useReportPresence';

export function ActivityPresenceTracker() {
  useReportPresence();
  return null;
}
