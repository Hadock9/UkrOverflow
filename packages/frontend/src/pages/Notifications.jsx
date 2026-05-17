/**
 * Список сповіщень користувача
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notifications as notificationsApi } from '../services/api';
import {
  isNotificationUnread,
  notificationIcon,
  notificationLabel,
  notificationLink,
  notificationTypeName,
  notifyNotificationsUpdated,
} from '../utils/notificationUi';
import '../styles/brutalism.css';
import './Notifications.css';

export function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const r = await notificationsApi.getAll({ limit: 100 });
      const payload = r.data?.data || r.data || {};
      const list = payload.notifications || [];
      setItems(Array.isArray(list) ? list : []);
      const apiUnread = Number(payload.unreadCount);
      const listUnread = (Array.isArray(list) ? list : []).filter(isNotificationUnread).length;
      setUnreadCount(Number.isFinite(apiUnread) ? apiUnread : listUnread);
    } catch (e) {
      console.error(e);
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    loadNotifications();
  }, [user, authLoading, navigate, loadNotifications]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter(isNotificationUnread);
    return items;
  }, [items, filter]);

  const markRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, is_read: true } : x))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      notifyNotificationsUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
      setUnreadCount(0);
      notifyNotificationsUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container">
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      </div>
    );
  }

  return (
    <div className="container notifications-page">
      <div className="page-header page-header-split">
        <div>
          <h1 className="page-title">СПОВІЩЕННЯ</h1>
          <p className="page-subtitle">
            Відповіді, голоси, коментарі, спільноти, новини та активність у тредах
          </p>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="btn btn-secondary" onClick={markAll}>
            ПРОЧИТАТИ ВСЕ ({unreadCount})
          </button>
        )}
      </div>

      <div className="notifications-filters">
        <button
          type="button"
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
        >
          УСІ ({items.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('unread')}
        >
          НЕПРОЧИТАНІ ({unreadCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{filter === 'unread' ? 'Немає непрочитаних' : 'Немає сповіщень'}</p>
          <p className="notifications-hint">
            Сповіщення з’являться, коли хтось відповість, проголосує, прокоментує або приєднається до
            вашої спільноти.
          </p>
          <Link to="/hub" className="btn btn-primary">
            ВІДКРИТИ ХАБ
          </Link>
        </div>
      ) : (
        <div className="notifications-list">
          {filtered.map((n) => {
            const href = notificationLink(n);
            const unread = isNotificationUnread(n);
            return (
              <article
                key={n.id}
                className={`notification-card ${unread ? 'notification-card--unread' : ''}`}
              >
                <span className="notification-card__icon" aria-hidden>
                  {notificationIcon(n.type)}
                </span>
                <div className="notification-card__body">
                  <span className="notification-card__type">
                    {notificationTypeName(n.type)}
                  </span>
                  <p className="notification-card__text">{notificationLabel(n)}</p>
                  <time className="notification-card__time">
                    {n.created_at
                      ? new Date(n.created_at).toLocaleString('uk-UA')
                      : ''}
                  </time>
                </div>
                <div className="notification-card__actions">
                  {unread && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => markRead(n.id)}
                    >
                      OK
                    </button>
                  )}
                  <Link
                    to={href}
                    className="btn btn-primary btn-sm"
                    onClick={() => unread && markRead(n.id)}
                  >
                    ВІДКРИТИ
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
