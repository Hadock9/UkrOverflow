/**
 * Notification Bell Component
 * Показує іконку дзвінка з кількістю непрочитаних сповіщень
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notifications } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './NotificationBell.css';

export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      // Оновлювати кожні 30 секунд
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUnreadCount = async () => {
    setLoading(true);
    try {
      const response = await notifications.getUnreadCount();
      setUnreadCount(response.data.data?.count || 0);
    } catch (error) {
      console.error('Error loading notifications count:', error);
    } finally {
      setLoading(false);
    }
  };

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
