/**
 * Каталог тегів — hub, новини, спільноти (глобальна агрегація).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LiveSearchBox } from '../components/LiveSearchBox';
import { tagsCatalog } from '../services/api';
import '../styles/brutalism.css';
import '../components/LiveSearchBox.css';

const SOURCE_FILTERS = [
  { id: 'all', label: 'Усі' },
  { id: 'hub', label: 'Хаб знань' },
  { id: 'news', label: 'Новини' },
  { id: 'question', label: 'Питання' },
  { id: 'article', label: 'Статті' },
  { id: 'community', label: "Спільноти" },
];

const SOURCE_LABELS = {
  question: 'Питання',
  article: 'Статті',
  guide: 'Гайди',
  snippet: 'Сніпети',
  roadmap: 'Маршрути',
  best_practice: 'Практики',
  faq: 'ЧаП',
  news: 'Новини',
  community: "Спільноти",
};

function cloudSize(count, max) {
  if (!max) return 1;
  const ratio = count / max;
  if (ratio > 0.7) return 1.45;
  if (ratio > 0.4) return 1.2;
  if (ratio > 0.2) return 1.05;
  return 0.92;
}

export function Tags() {
  const [searchParams] = useSearchParams();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [source, setSource] = useState('all');
  const [sortBy, setSortBy] = useState('count');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await tagsCatalog.list({
          search: search || undefined,
          source: source || 'all',
          sortBy,
        });
        if (!cancelled) {
          const list = res.data?.data?.tags ?? res.data?.tags ?? [];
          setTags(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || 'Не вдалося завантажити теги');
          setTags([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, source, sortBy]);

  const maxCount = useMemo(
    () => (tags.length ? Math.max(...tags.map((t) => t.count)) : 0),
    [tags],
  );

  const cloudTags = useMemo(() => tags.slice(0, 36), [tags]);

  return (
    <div className="container tags-page">
      <div className="page-header page-header-split">
        <div>
          <h1 className="page-title">ТЕГИ ПЛАТФОРМИ</h1>
          <p className="page-subtitle">
            Теми з хабу знань, новин і спільнот — як хмара тегів на DOU, але для всього DevFlow.
          </p>
        </div>
        <Link to="/hub" className="btn btn-primary">
          ВІДКРИТИ ХАБ →
        </Link>
      </div>

      <div className="tags-toolbar">
        <LiveSearchBox
          className="tags-live-search"
          value={searchInput}
          onChange={setSearchInput}
          onSubmitQuery={(q) => {
            const trimmed = q.trim();
            setSearch(trimmed);
            setSearchInput(trimmed);
          }}
          scope="tags"
          variant="filter"
          placeholder="Знайти тег (react, salary, docker…)"
          ariaLabel="Пошук тегів"
          showViewAll={false}
        />

        <div className="tags-sort" role="group" aria-label="Сортування">
          <button
            type="button"
            className={`filter-btn ${sortBy === 'count' ? 'active' : ''}`}
            onClick={() => setSortBy('count')}
          >
            ЗА ПОПУЛЯРНІСТЮ
          </button>
          <button
            type="button"
            className={`filter-btn ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => setSortBy('name')}
          >
            А-Я
          </button>
        </div>
      </div>

      <div className="tags-source-filters" role="group" aria-label="Джерело тегів">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`news-category-chip ${source === f.id ? 'news-category-chip--active' : ''}`}
            onClick={() => setSource(f.id)}
            aria-pressed={source === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : tags.length === 0 ? (
        <div className="empty-state">
          <p>ТЕГІВ НЕ ЗНАЙДЕНО</p>
          <p style={{ fontSize: '0.9rem', marginTop: 8 }}>
            Спробуйте інший фільтр або запустіть сіди на сервері.
          </p>
        </div>
      ) : (
        <>
          <section className="tags-cloud-section" aria-label="Хмара тегів">
            <h2 className="tags-section-title">ХМАРА ТЕГІВ</h2>
            <div className="tags-cloud">
              {cloudTags.map((tag) => (
                <Link
                  key={tag.name}
                  to={`/tags/${encodeURIComponent(tag.name)}`}
                  className="tags-cloud-item"
                  style={{ fontSize: `${cloudSize(tag.count, maxCount)}rem` }}
                  title={`${tag.count} згадувань`}
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </section>

          <section className="tags-catalog-section" aria-label="Каталог тегів">
            <h2 className="tags-section-title">
              КАТАЛОГ ({tags.length})
            </h2>
            <div className="tags-catalog-grid">
              {tags.map((tag) => (
                <TagCard key={tag.name} tag={tag} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function TagCard({ tag }) {
  const sources = Object.entries(tag.bySource || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <article className="tags-catalog-card">
      <Link to={`/tags/${encodeURIComponent(tag.name)}`} className="tags-catalog-name">
        #{tag.name}
      </Link>
      <p className="tags-catalog-count">
        <strong>{tag.count}</strong> згадувань
        {tag.hubCount > 0 && tag.hubCount !== tag.count && (
          <span> · хаб: {tag.hubCount}</span>
        )}
      </p>
      {sources.length > 0 && (
        <ul className="tags-catalog-sources">
          {sources.map(([key, n]) => (
            <li key={key}>
              <span>{SOURCE_LABELS[key] || key}</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="tags-catalog-actions">
        {(tag.hubCount || 0) > 0 && (
          <Link to={`/tags/${encodeURIComponent(tag.name)}`} className="btn btn-sm">
            ХАБ →
          </Link>
        )}
        {(tag.bySource?.news || 0) > 0 && (
          <Link to={`/news?tag=${encodeURIComponent(tag.name)}`} className="btn btn-sm">
            НОВИНИ →
          </Link>
        )}
        <Link to={`/search?q=${encodeURIComponent(tag.name)}`} className="btn btn-sm btn-secondary">
          ПОШУК
        </Link>
      </div>
    </article>
  );
}

export default Tags;
