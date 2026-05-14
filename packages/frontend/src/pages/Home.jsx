/**
 * Головна сторінка — knowledge hub лента.
 * Один уніфікований фід /api/content із фільтрацією за типом контенту.
 */

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import { CONTENT_TYPE_DEFINITIONS, CONTENT_TYPES, getContentTypeMeta } from '../constants/contentTypes';
import '../styles/brutalism.css';

const TYPE_BADGE_STYLE = {
  [CONTENT_TYPES.QUESTION]: { background: '#fff', border: '2px solid #000' },
  [CONTENT_TYPES.ARTICLE]: { background: '#f5d142', border: '2px solid #000' },
  [CONTENT_TYPES.GUIDE]: { background: '#9ee6a0', border: '2px solid #000' },
  [CONTENT_TYPES.SNIPPET]: { background: '#9bd3ff', border: '2px solid #000' },
  [CONTENT_TYPES.ROADMAP]: { background: '#ffb3c7', border: '2px solid #000' },
  [CONTENT_TYPES.BEST_PRACTICE]: { background: '#c9b8ff', border: '2px solid #000' },
  [CONTENT_TYPES.FAQ]: { background: '#ffd699', border: '2px solid #000' },
};

function detailHrefFor(item) {
  switch (item.type) {
    case CONTENT_TYPES.ARTICLE: return `/articles/${item.id}`;
    case CONTENT_TYPES.GUIDE: return `/guides/${item.id}`;
    case CONTENT_TYPES.SNIPPET: return `/snippets/${item.id}`;
    case CONTENT_TYPES.ROADMAP: return `/roadmaps/${item.id}`;
    case CONTENT_TYPES.BEST_PRACTICE: return `/best-practices/${item.id}`;
    case CONTENT_TYPES.FAQ: return `/faqs/${item.id}`;
    default: return `/questions/${item.id}`;
  }
}

export function Home() {
  const { tag } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');
  const [contentType, setContentType] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const mediator = useMediator();

  useEffect(() => {
    mediator.emit(EventTypes.PAGE_VIEW, { page: 'home', tag, contentType }, 'Home');
    loadFeed();
  }, [sortBy, page, tag, contentType]);

  useEffect(() => {
    setPage(1);
  }, [contentType, tag, sortBy]);

  const loadFeed = async () => {
    setLoading(true);
    try {
      mediator.emit(EventTypes.API_REQUEST, { endpoint: '/content', tag, contentType }, 'Home');

      const response = await api.get('/content', {
        params: { sortBy, page, limit: 20, tag, contentType },
      });

      const { items: feedItems, pagination } = response.data.data || response.data;

      setItems(feedItems || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotal(pagination?.total || 0);

      mediator.emit(EventTypes.API_SUCCESS, {
        endpoint: '/content',
        count: feedItems?.length || 0,
      }, 'Home');
    } catch (error) {
      mediator.emit(EventTypes.API_ERROR, {
        endpoint: '/content',
        error: error.message,
      }, 'Home');
      console.error('Помилка завантаження ленти:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff} сек тому`;
    if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} год тому`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} дн тому`;
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const currentMeta = getContentTypeMeta(contentType);
  const pageHeading = tag
    ? `КОНТЕНТ З ТЕГОМ: ${tag}`
    : contentType === 'all'
      ? 'KNOWLEDGE HUB'
      : (currentMeta?.label || 'KNOWLEDGE HUB');

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{pageHeading}</h1>
          <p className="page-subtitle">
            {tag && total === 0 ? 'Записів з цим тегом не знайдено' : `Всього записів: ${total}`}
          </p>
        </div>
        <Link to="/questions/new" className="btn btn-primary">
          + НОВЕ ПИТАННЯ
        </Link>
      </div>

      <div className="filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        {CONTENT_TYPE_DEFINITIONS.filter((t) => t.available).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`filter-btn ${contentType === t.id ? 'active' : ''}`}
            onClick={() => setContentType(t.id)}
            title={t.description}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="filters" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={`filter-btn ${sortBy === 'created_at' ? 'active' : ''}`}
          onClick={() => setSortBy('created_at')}
        >
          НОВІ
        </button>
        <button
          type="button"
          className={`filter-btn ${sortBy === 'votes' ? 'active' : ''}`}
          onClick={() => setSortBy('votes')}
        >
          ПОПУЛЯРНІ
        </button>
        <button
          type="button"
          className={`filter-btn ${sortBy === 'views' ? 'active' : ''}`}
          onClick={() => setSortBy('views')}
          title="Сортування за загальною кількістю переглядів усіх користувачів"
        >
          ТОП ПЕРЕГЛЯДІВ
        </button>
      </div>

      {loading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>ЗАПИСІВ ПОКИ НЕМАЄ</p>
          <Link to="/questions/new" className="btn btn-primary">
            СТВОРИТИ ПЕРШЕ ПИТАННЯ
          </Link>
        </div>
      ) : (
        <div className="questions-list">
          {items.map((item) => {
            const meta = getContentTypeMeta(item.type);
            const badgeStyle = TYPE_BADGE_STYLE[item.type] || TYPE_BADGE_STYLE[CONTENT_TYPES.QUESTION];
            const excerpt = (item.excerpt || item.body || item.description || '').toString();
            return (
              <div key={`${item.type}-${item.id}`} className="question-card">
                <div className="question-stats">
                  <div className="stat">
                    <div className="stat-value">{item.votes || 0}</div>
                    <div className="stat-label">ГОЛОСИ</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{item.answers_count || 0}</div>
                    <div className="stat-label">ВІДПОВІДІ</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{item.views || 0}</div>
                    <div className="stat-label">ПЕРЕГЛЯДИ</div>
                  </div>
                </div>

                <div className="question-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        ...badgeStyle,
                      }}
                    >
                      {meta?.shortLabel || item.type}
                    </span>
                  </div>
                  <Link to={detailHrefFor(item)} className="question-title">
                    {item.title}
                  </Link>
                  <p className="question-excerpt">
                    {excerpt.substring(0, 200)}
                    {excerpt.length > 200 ? '...' : ''}
                  </p>

                  <div className="question-tags">
                    {Array.isArray(item.tags) && item.tags.map((tg, index) => (
                      <Link key={index} to={`/tags/${tg}`} className="tag">
                        {tg}
                      </Link>
                    ))}
                  </div>

                  <div className="question-meta">
                    <Link to={`/users/${item.author_id}`} className="author">
                      {item.author_name}
                    </Link>
                    <span className="separator">•</span>
                    <span className="date">{formatDate(item.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ← ПОПЕРЕДНЯ
          </button>
          <span className="page-info">
            СТОРІНКА {page} З {totalPages}
          </span>
          <button
            className="btn btn-secondary"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            НАСТУПНА →
          </button>
        </div>
      )}
    </div>
  );
}
