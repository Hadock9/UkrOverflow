/**
 * Список сповіщень користувача
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notifications } from '../services/api';
import '../styles/brutalism.css';

function parseData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function linkFor(n) {
  const d = parseData(n.data);
  switch (n.type) {
    case 'community_join':
      return d.slug ? `/communities/${d.slug}` : '/communities';
    case 'community_new_post':
    case 'community_post_comment':
    case 'community_post_reply':
      return `/community-posts/${n.entity_id}`;
    case 'answer_accepted':
      return d.questionId ? `/questions/${d.questionId}` : '/';
    case 'question_answer':
    case 'question_bookmark':
    case 'vote':
      if (n.entity_type === 'question') return `/questions/${n.entity_id}`;
      if (n.entity_type === 'answer' && d.questionId) return `/questions/${d.questionId}`;
      return '/';
    default:
      return '/';
  }
}

function labelFor(n) {
  const who = n.actor_name || 'Користувач';
  const t = n.context_title || n.question_title;
  switch (n.type) {
    case 'question_answer':
      return `${who} відповів на ваше питання${t ? `: «${t}»` : ''}`;
    case 'answer_accepted':
      return `Вашу відповідь позначено як прийняту${t ? ` («${t}»)` : ''}`;
    case 'vote':
      return `${who} проголосував «за»${n.entity_type === 'answer' ? ' за відповідь' : ' за ваше питання'}${t ? `: «${t}»` : ''}`;
    case 'community_post_comment':
      return `${who} залишив коментар до вашого посту${t ? `: «${t}»` : ''}`;
    case 'community_post_reply':
      return `${who} відповів у треді коментарів${t ? ` («${t}»)` : ''}`;
    case 'community_new_post':
      return `${who} опублікував новий пост у вашій спільноті${t ? `: «${t}»` : ''}`;
    case 'community_join':
      return `${who} приєднався до спільноти${t ? ` «${t}»` : ''}`;
    case 'question_bookmark':
      return `${who} додав ваше питання в закладки${t ? `: «${t}»` : ''}`;
    default:
      return `Сповіщення (${n.type})`;
  }
}

export function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const r = await notifications.getAll({ limit: 80 });
        const list = r.data?.data?.notifications || r.data?.notifications || [];
        setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, navigate]);

  const markRead = async (id) => {
    try {
      await notifications.markAsRead(id);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: 1 } : x)));
    } catch (e) {
      console.error(e);
    }
  };

  const markAll = async () => {
    try {
      await notifications.markAllAsRead();
      setItems((prev) => prev.map((x) => ({ ...x, is_read: 1 })));
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
    <div className="container">
      <div className="page-header page-header-split">
        <div>
          <h1 className="page-title">СПОВІЩЕННЯ</h1>
          <p className="page-subtitle">Події щодо ваших питань, постів і спільнот</p>
        </div>
        {items.some((n) => !n.is_read) && (
          <button type="button" className="btn btn-secondary" onClick={markAll}>
            ПРОЧИТАТИ ВСЕ
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>Немає сповіщень</p>
          <Link to="/" className="btn btn-primary">НА ГОЛОВНУ</Link>
        </div>
      ) : (
        <div className="questions-list">
          {items.map((n) => {
            const href = linkFor(n);
            const unread = !n.is_read;
            return (
              <div
                key={n.id}
                className="question-card"
                style={{
                  opacity: unread ? 1 : 0.85,
                  borderLeft: unread ? '4px solid var(--color-success)' : undefined,
                }}
              >
                <div className="question-content" style={{ width: '100%' }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.45 }}>
                    {labelFor(n)}
                  </p>
                  <div className="question-meta" style={{ marginTop: 'var(--space-2)' }}>
                    <span className="date">
                      {n.created_at
                        ? new Date(n.created_at).toLocaleString('uk-UA')
                        : ''}
                    </span>
                    <div className="question-actions" style={{ marginLeft: 'auto', gap: 8 }}>
                      {unread && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => markRead(n.id)}>
                          OK
                        </button>
                      )}
                      <Link to={href} className="btn btn-primary btn-sm">
                        ВІДКРИТИ
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
