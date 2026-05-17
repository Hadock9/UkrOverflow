/**
 * Жива стрічка активності — хто задає питання, відповідає, вчиться.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { activity as activityApi } from '../services/api';
import wsClient from '../services/websocket';
import '../styles/brutalism.css';
import './SocialPages.css';

const STATUS_LABELS = {
  asking: { label: 'ЗАДАЄ ПИТАННЯ', color: '#f5d142' },
  answering: { label: 'ВІДПОВІДАЄ', color: '#9bd3ff' },
  learning: { label: 'ВЧИТЬСЯ', color: '#9ee6a0' },
  in_room: { label: 'У КІМНАТІ', color: '#c9b8ff' },
};

const VERB_LABELS = {
  question_asked: 'задав питання',
  answer_posted: 'відповів',
  room_created: 'створив кімнату',
  challenge_submit: 'надіслав рішення челенджу',
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'щойно';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} хв`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год`;
  return d.toLocaleDateString('uk-UA');
}

function PresenceColumn({ status, users }) {
  const meta = STATUS_LABELS[status] || { label: status, color: '#fff' };
  return (
    <div className="social-presence-col">
      <div className="social-presence-head" style={{ background: meta.color }}>
        {meta.label}
        <span className="social-count">{users.length}</span>
      </div>
      <ul className="social-presence-list">
        {users.length === 0 ? (
          <li className="social-muted">поки нікого</li>
        ) : (
          users.map((u) => (
            <li key={u.userId}>
              <Link to={`/users/${u.userId}`} className="social-user-link">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="social-avatar" />
                ) : (
                  <span className="social-avatar social-avatar-fallback">{u.username?.[0]?.toUpperCase()}</span>
                )}
                <span>{u.username}</span>
              </Link>
              {u.context?.title && <small>{u.context.title}</small>}
              {u.context?.roomTitle && <small>{u.context.roomTitle}</small>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function ActivityFeed() {
  const { isAuthenticated } = useAuth();
  const [feed, setFeed] = useState({ events: [], liveNow: {}, totals: {} });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await activityApi.getLive();
      setFeed(res.data.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = wsClient.on('activity', () => load());
    const interval = setInterval(load, 30000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    activityApi.heartbeat({ status: 'learning' }).catch(() => {});
    const hb = setInterval(() => {
      activityApi.heartbeat({ status: 'learning' }).catch(() => {});
    }, 120000);
    return () => clearInterval(hb);
  }, [isAuthenticated]);

  const live = feed.liveNow || {};

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">ЖИВА АКТИВНІСТЬ</h1>
        <p className="page-subtitle">
          Хто зараз на платформі: задає питання, відповідає, вчиться або кодить у кімнатах.
        </p>
      </div>

      <div className="social-live-grid">
        <PresenceColumn status="asking" users={live.asking || []} />
        <PresenceColumn status="answering" users={live.answering || []} />
        <PresenceColumn status="learning" users={live.learning || []} />
        <PresenceColumn status="in_room" users={live.in_room || []} />
      </div>

      <div className="social-section">
        <h2 className="social-section-title">ОСТАННІ ПОДІЇ</h2>
        {loading ? (
          <div className="loading">ЗАВАНТАЖЕННЯ...</div>
        ) : feed.events?.length === 0 ? (
          <p className="social-muted">Поки немає подій — будьте першими!</p>
        ) : (
          <ul className="social-events-list">
            {feed.events.map((ev) => (
              <li key={ev.id} className="social-event-item">
                <Link to={`/users/${ev.actorId}`} className="social-user-link">
                  <strong>{ev.username}</strong>
                </Link>
                <span> {VERB_LABELS[ev.verb] || ev.verb}</span>
                {ev.title && <span className="social-event-title"> — {ev.title}</span>}
                {ev.entityType === 'question' && ev.entityId && (
                  <Link to={`/questions/${ev.entityId}`} className="social-inline-link"> відкрити</Link>
                )}
                {ev.entityType === 'pair_room' && ev.entityId && (
                  <Link to="/pair-rooms" className="social-inline-link"> кімнати</Link>
                )}
                <time className="social-time">{formatTime(ev.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="social-quick-links">
        <Link to="/pair-rooms" className="btn">ПАРНЕ КОДУВАННЯ</Link>
        <Link to="/challenges" className="btn btn-primary">ЧЕЛЕНДЖІ ТИЖНЯ</Link>
      </div>
    </div>
  );
}
