/**
 * Notification Bell Component
 * Показує іконку дзвінка з кількістю непрочитаних сповіщень
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notifications } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './NotificationBell.css';

export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await notifications.getUnreadCount();
      setUnreadCount(response.data.data?.count || 0);
    } catch (error) {
      console.error('Error loading notifications count:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      queueMicrotask(() => {
        loadUnreadCount();
      });
      const interval = setInterval(loadUnreadCount, 15000);
      return () => clearInterval(interval);
    }
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
