/**
 * Обговорення під новиною (як коментарі на DOU).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { news } from '../services/api';
import { VoteButtons } from './VoteButtons';

function formatDate(dateString) {
  return new Date(dateString).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NewsComments({ newsId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const res = await news.getComments(newsId);
      setComments(res.data?.data?.comments || []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (newsId) load();
  }, [newsId]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!user || !body.trim()) return;
    setSubmitting(true);
    try {
      await news.addComment(newsId, body.trim());
      setBody('');
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Не вдалося додати коментар');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="news-comments" aria-label="Обговорення">
      <h2 className="section-title">
        ОБГОВОРЕННЯ {comments.length > 0 ? `(${comments.length})` : ''}
      </h2>

      {loading ? (
        <p className="news-sidebar-muted">Завантаження коментарів…</p>
      ) : comments.length === 0 ? (
        <p className="news-sidebar-muted">Поки немає коментарів — будьте першими.</p>
      ) : (
        <ul className="news-comments-list">
          {comments.map((c) => (
            <li key={c.id} className="news-comment-item">
              <div className="news-comment-head">
                <Link to={`/users/${c.author_id}`} className="author-name">
                  {c.author_name}
                </Link>
                <span className="news-sidebar-meta">{formatDate(c.created_at)}</span>
                <VoteButtons
                  entityType="news_comment"
                  entityId={c.id}
                  votes={c.votes}
                  upvotes={c.upvotes}
                  downvotes={c.downvotes}
                  userVote={c.user_vote}
                  compact
                />
              </div>
              <p className="news-comment-body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <form onSubmit={onSubmit} className="news-comment-form">
          <textarea
            className="form-input"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ваша думка щодо новини…"
            maxLength={5000}
          />
          <button type="submit" className="btn btn-primary" disabled={submitting || !body.trim()}>
            {submitting ? 'НАДСИЛАННЯ…' : 'ДОДАТИ КОМЕНТАР'}
          </button>
        </form>
      ) : (
        <p className="news-sidebar-muted">
          <Link to="/login">Увійдіть</Link>, щоб коментувати.
        </p>
      )}
    </section>
  );
}

export default NewsComments;
