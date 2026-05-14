/**
 * Головна сторінка — knowledge hub лента.
 * Один уніфікований фід /api/content із фільтрацією за типом контенту.
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import { CONTENT_TYPE_DEFINITIONS, CONTENT_TYPES, getContentTypeMeta, getContentDetailPath } from '../constants/contentTypes';
import '../styles/brutalism.css';

const TYPE_BADGE_STYLE = {
  [CONTENT_TYPES.QUESTION]: { background: '#fff', border: '2px solid #000' },
  [CONTENT_TYPES.ARTICLE]: { background: '#f5d142', border: '2px solid #000' },
  [CONTENT_TYPES.GUIDE]: { background: '#9ee6a0', border: '2px solid #000' },
  [CONTENT_TYPES.SNIPPET]: { background: '#9bd3ff', border: '2px solid #000' },
  [CONTENT_TYPES.ROADMAP]: { background: '#ffb3c7', border: '2px solid #000' },
  [CONTENT_TYPES.BEST_PRACTICE]: { background: '#c9b8ff', border: '2px solid #000' },
  [CONTENT_TYPES.FAQ]: { background: '#ffd699', border: '2px solid #000' },
  [CONTENT_TYPES.COMMUNITY_POST]: { background: '#b8f4e8', border: '2px solid #000' },
};

// Куди веде кожен пункт dropdown "+ СТВОРИТИ ▾".
const CREATE_LINKS = {
  [CONTENT_TYPES.QUESTION]: '/questions/new',
  [CONTENT_TYPES.ARTICLE]: '/articles/new',
  [CONTENT_TYPES.GUIDE]: '/guides/new',
  [CONTENT_TYPES.SNIPPET]: '/snippets/new',
  [CONTENT_TYPES.ROADMAP]: '/roadmaps/new',
  [CONTENT_TYPES.BEST_PRACTICE]: '/best-practices/new',
  [CONTENT_TYPES.FAQ]: '/faqs/new',
};

// Більш дружні короткі підписи в dropdown (винесено окремо щоб не плутати з фільтрами).
const CREATE_ITEM_LABEL = {
  [CONTENT_TYPES.QUESTION]: 'Питання',
  [CONTENT_TYPES.ARTICLE]: 'Статтю',
  [CONTENT_TYPES.GUIDE]: 'Міні-гайд',
  [CONTENT_TYPES.SNIPPET]: 'Сніпет',
  [CONTENT_TYPES.ROADMAP]: 'Маршрут',
  [CONTENT_TYPES.BEST_PRACTICE]: 'Практику',
  [CONTENT_TYPES.FAQ]: 'ЧаП',
};

const CREATE_MENU_ITEMS = [
  ...CONTENT_TYPE_DEFINITIONS
    .filter((item) => item.id !== CONTENT_TYPES.ALL && CREATE_LINKS[item.id])
    .map((item) => ({
      id: item.id,
      label: CREATE_ITEM_LABEL[item.id] || item.shortLabel,
      description: item.description,
      href: CREATE_LINKS[item.id],
    })),
  {
    id: 'community',
    label: 'СПІЛЬНОТУ',
    description: 'Локальна, університетська або онлайн-спільнота',
    href: '/communities/new',
  },
  {
    id: 'community_post',
    label: 'ПОСТ У СПІЛЬНОТІ',
    description: 'Оберіть спільноту й опублікуйте пост: пет-проєкт, перегляд коду, пошук ментора тощо.',
    href: '/communities',
  },
];

function detailHrefFor(item) {
  return getContentDetailPath(item.type, item.id);
}

export function Home() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');
  const [contentType, setContentType] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef(null);
  const mediator = useMediator();

  // Закриваємо dropdown по кліку поза ним або по Escape.
  useEffect(() => {
    if (!createMenuOpen) return undefined;

    const handleDocumentClick = (event) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
        setCreateMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setCreateMenuOpen(false);
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [createMenuOpen]);

  const handleCreateItemClick = (href) => {
    setCreateMenuOpen(false);
    navigate(href);
  };

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
      ? 'DEVFLOW · ХАБ'
      : (currentMeta?.label || 'DEVFLOW · ХАБ');

  return (
    <div className="container">
      <div className="page-header page-header-split">
        <div>
          <h1 className="page-title">{pageHeading}</h1>
          <p className="page-subtitle">
            {tag && total === 0 ? 'Записів з цим тегом не знайдено' : `Всього записів: ${total}`}
          </p>
        </div>
        <div ref={createMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
          >
            + СТВОРИТИ {createMenuOpen ? '▴' : '▾'}
          </button>

          {createMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 280,
                background: '#fff',
                border: '4px solid #000',
                boxShadow: '8px 8px 0 #000',
                zIndex: 50,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {CREATE_MENU_ITEMS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleCreateItemClick(item.href)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    background: '#fff',
                    color: '#000',
                    border: 'none',
                    borderTop: index === 0 ? 'none' : '2px solid #000',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5d142'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.3 }}>
                    {item.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
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
            const excerptRaw = (item.excerpt || item.body || item.description || '').toString();
            const isCommunityPost = item.type === CONTENT_TYPES.COMMUNITY_POST;
            const middleStat = isCommunityPost ? (item.comment_count ?? 0) : (item.answers_count || 0);
            return (
              <div key={`${item.type}-${item.id}`} className="question-card">
                <div className="question-stats">
                  <div className="stat">
                    <div className="stat-value">{item.votes || 0}</div>
                    <div className="stat-label">ГОЛОСИ</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{middleStat}</div>
                    <div className="stat-label">{isCommunityPost ? 'КОМЕНТАРІ' : 'ВІДПОВІДІ'}</div>
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
                  {isCommunityPost && item.community_slug && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <Link to={`/communities/${item.community_slug}`} className="tag">
                        {item.community_name || item.community_slug}
                      </Link>
                    </div>
                  )}
                  <p className="question-excerpt">
                    {excerptRaw.substring(0, 200)}
                    {excerptRaw.length > 200 ? '...' : ''}
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
