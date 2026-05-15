/**
 * Стрічка новин — brutalism cards.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NewsSidebar } from '../components/NewsSidebar';
import { useAuth } from '../contexts/AuthContext';
import { news } from '../services/api';
import '../styles/brutalism.css';

const NEWS_CATEGORIES = [
  { id: '', label: 'Усі' },
  { id: 'salary', label: 'Зарплати' },
  { id: 'career', label: 'Карʼєра' },
  { id: 'tech', label: 'Технології' },
  { id: 'community', label: 'Спільнота' },
  { id: 'events', label: 'Події' },
  { id: 'ai', label: 'ШІ / ML' },
];

const CATEGORY_LABELS = Object.fromEntries(
  NEWS_CATEGORIES.filter((c) => c.id).map((c) => [c.id, c.label])
);

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function newsDetailPath(item) {
  return item.slug ? `/news/${item.slug}` : `/news/${item.id}`;
}

export function NewsFeed() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tagFilter = searchParams.get('tag') || '';
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canCreate = user && (user.role === 'admin' || user.role === 'moderator');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await news.list({
          page,
          limit: 12,
          search: search || undefined,
          category: category || undefined,
          tag: tagFilter || undefined,
        });
        if (cancelled) return;
        const data = res.data?.data || {};
        setItems(data.news || []);
        setPagination(data.pagination || { page: 1, totalPages: 1 });
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || 'Не вдалося завантажити новини');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, search, category, tagFilter]);

  const onCategoryChange = (next) => {
    setCategory(next);
    setPage(1);
  };

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const pinned = items.filter((n) => n.is_pinned);
  const regular = items.filter((n) => !n.is_pinned);

  return (
    <div className="container news-feed-page">
      <div className="page-header page-header-split">
        <div>
          <h1 className="page-title">СТРІЧКА НОВИН</h1>
          <p className="page-subtitle">
            Огляд українського IT: інструменти, спільноти, безпека та карʼєра.
          </p>
        </div>
        {canCreate && (
          <Link to="/news/new" className="btn btn-primary">
            + ДОДАТИ НОВИНУ
          </Link>
        )}
      </div>

      <div className="news-category-filters" role="group" aria-label="Категорії новин">
        {NEWS_CATEGORIES.map((cat) => (
          <button
            key={cat.id || 'all'}
            type="button"
            className={`news-category-chip ${category === cat.id ? 'news-category-chip--active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
            aria-pressed={category === cat.id}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {tagFilter && (
        <p className="news-tag-filter-hint">
          Фільтр за тегом: <strong>{tagFilter}</strong>
          {' '}
          <Link to="/news">скинути</Link>
        </p>
      )}

      <div className="news-feed-layout">
      <div className="news-feed-main">
      <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Пошук у новинах…"
          className="form-input"
          style={{ flex: 1 }}
          aria-label="Пошук новин"
        />
        <button type="submit" className="btn btn-secondary">ШУКАТИ</button>
      </form>

      {loading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>НОВИН ПОКИ НЕМАЄ</p>
          <p style={{ fontSize: '0.9rem', marginTop: 8 }}>
            Запустіть npm run migrate та npm run seed:news:large
          </p>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="news-pinned-section" aria-label="Закріплені новини">
              <h2 className="news-section-title">ЗАКРІПЛЕНО</h2>
              <div className="news-card-grid">
                {pinned.map((item) => (
                  <NewsCard key={item.id} item={item} pinned />
                ))}
              </div>
            </section>
          )}

          <section aria-label="Усі новини">
            {pinned.length > 0 && regular.length > 0 && (
              <h2 className="news-section-title">ОСТАННІ</h2>
            )}
            <div className="news-card-grid">
              {(pinned.length > 0 ? regular : items).map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          {pagination.totalPages > 1 && (
            <div className="pagination" style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                type="button"
                className="btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← НАЗАД
              </button>
              <span style={{ alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>
                {page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                className="btn"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ДАЛІ →
              </button>
            </div>
          )}
        </>
      )}
      </div>
      <NewsSidebar />
      </div>
    </div>
  );
}

function NewsCard({ item, pinned = false }) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const categoryLabel = item.category ? CATEGORY_LABELS[item.category] : null;
  return (
    <article
      className={`news-card ${pinned ? 'news-card--pinned' : ''}`}
      style={pinned ? { background: '#f5d142' } : undefined}
    >
      {categoryLabel && (
        <span className="news-category-badge">{categoryLabel}</span>
      )}
      {pinned && <span className="news-pin-badge">📌 ЗАКРІПЛЕНО</span>}
      <h3 className="news-card-title">
        <Link to={newsDetailPath(item)}>{item.title}</Link>
      </h3>
      <p className="news-card-summary">{item.summary}</p>
      <div className="news-card-meta">
        <span>{formatDate(item.published_at || item.created_at)}</span>
        <span> • </span>
        <span>{item.author_name}</span>
        <span> • </span>
        <span>{item.views ?? 0} переглядів</span>
      </div>
      {tags.length > 0 && (
        <div className="tags" style={{ marginTop: 10 }}>
          {tags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}
      <Link to={newsDetailPath(item)} className="btn" style={{ marginTop: 12 }}>
        ЧИТАТИ →
      </Link>
    </article>
  );
}

export default NewsFeed;
