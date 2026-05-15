/**
 * Сторінка перегляду новини.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAuth } from '../contexts/AuthContext';
import { news } from '../services/api';
import { NewsComments } from '../components/NewsComments';
import { VoteButtons } from '../components/VoteButtons';
import '../styles/brutalism.css';

const CATEGORY_LABELS = {
  salary: 'Зарплати',
  career: 'Карʼєра',
  tech: 'Технології',
  community: 'Спільнота',
  events: 'Події',
  ai: 'ШІ / ML',
};

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NewsDetail() {
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNews();
  }, [idOrSlug]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const response = await news.get(idOrSlug, {
        headers: { 'X-Record-View': '1' },
      });
      const data = response.data?.data?.news || response.data?.news;
      setItem(data);
    } catch (error) {
      console.error('Помилка завантаження новини:', error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Видалити цю новину?')) return;
    try {
      await news.delete(item.id);
      navigate('/news');
    } catch (error) {
      alert(error.response?.data?.message || 'Помилка видалення');
    }
  };

  const renderBody = (text) => {
    if (!text || typeof text !== 'string') return { __html: '' };
    const rawHtml = marked(text);
    return { __html: DOMPurify.sanitize(rawHtml) };
  };

  if (loading) {
    return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  }

  if (!item) {
    return (
      <div className="container">
        <div className="error">НОВИНУ НЕ ЗНАЙДЕНО</div>
        <Link to="/news" className="btn" style={{ marginTop: 16 }}>← ДО СТРІЧКИ</Link>
      </div>
    );
  }

  const canManage = user && (user.role === 'admin' || user.role === 'moderator');
  const tags = Array.isArray(item.tags) ? item.tags : [];

  return (
    <div className="container">
      <Link to="/news" className="btn" style={{ marginBottom: 16 }}>← СТРІЧКА НОВИН</Link>

      <div className="question-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            {item.is_pinned && <span className="news-pin-badge" style={{ marginBottom: 8, display: 'inline-block' }}>📌 ЗАКРІПЛЕНО</span>}
            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="tag">Новина</span>
              {item.category && CATEGORY_LABELS[item.category] && (
                <span className="news-category-badge">{CATEGORY_LABELS[item.category]}</span>
              )}
            </div>
            <h1 className="question-detail-title">{item.title}</h1>
            <div className="question-info">
              <span>{formatDate(item.published_at || item.created_at)}</span>
              <span>•</span>
              <span>{item.author_name}</span>
              <span>•</span>
              <span>{item.views ?? 0} переглядів</span>
            </div>
          </div>

          {canManage && (
            <div className="question-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Link to={`/news/${item.id}/edit`} className="btn btn-secondary">
                РЕДАГУВАТИ
              </Link>
              <button type="button" className="btn" onClick={handleDelete}>
                ВИДАЛИТИ
              </button>
            </div>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="tags" style={{ marginBottom: 'var(--space-3)' }}>
          {tags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}

      <div className="question-detail-card" style={{ marginBottom: 'var(--space-4)' }}>
        <VoteButtons
          entityType="news_post"
          entityId={item.id}
          votes={item.votes}
          upvotes={item.upvotes}
          downvotes={item.downvotes}
          userVote={item.user_vote}
        />
        <div className="question-detail-content">
          <div
            className="question-body markdown-content news-detail-body"
            dangerouslySetInnerHTML={renderBody(item.body)}
          />
        </div>
      </div>

      <NewsComments newsId={item.id} />
    </div>
  );
}

export default NewsDetail;
