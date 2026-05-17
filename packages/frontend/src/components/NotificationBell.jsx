/**
 * Notification Bell Component
 * Показує іконку дзвінка з кількістю непрочитаних сповіщень
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notifications } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { NOTIFICATIONS_UPDATED_EVENT } from '../utils/notificationUi';
import './NotificationBell.css';

function parseUnreadCount(payload) {
  const raw = payload?.data?.count ?? payload?.count ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await notifications.getUnreadCount();
      setUnreadCount(parseUnreadCount(response.data));
    } catch (error) {
      console.error('Error loading notifications count:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return undefined;
    }
    queueMicrotask(() => {
      loadUnreadCount();
    });
    const interval = setInterval(loadUnreadCount, 15000);
    const onUpdated = () => loadUnreadCount();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    const onFocus = () => loadUnreadCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, loadUnreadCount]);

  if (!user) return null;

  return (
    <Link to="/notifications" className="notification-bell">
      <span className="bell-icon">🔔</span>
      {unreadCount > 0 && (
        <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </Link>
  );
}
