/**
 * Панель результатів live-пошуку (dropdown або inline).
 */

import { Link } from 'react-router-dom';
import { CONTENT_TYPES, getContentDetailPath } from '../constants/contentTypes';

const TYPE_LABELS = {
  [CONTENT_TYPES.QUESTION]: 'Питання',
  [CONTENT_TYPES.ARTICLE]: 'Стаття',
  [CONTENT_TYPES.GUIDE]: 'Гайд',
  [CONTENT_TYPES.SNIPPET]: 'Сніпет',
  [CONTENT_TYPES.ROADMAP]: 'Маршрут',
  [CONTENT_TYPES.BEST_PRACTICE]: 'Практика',
  [CONTENT_TYPES.FAQ]: 'ЧаП',
  [CONTENT_TYPES.COMMUNITY_POST]: 'Спільнота',
  news: 'Новина',
};

function hitPath(hit) {
  if (hit.type === 'news') {
    return hit.slug ? `/news/${hit.slug}` : `/news/${hit.id}`;
  }
  const t = hit.type === 'community_post' ? CONTENT_TYPES.COMMUNITY_POST : hit.type;
  return getContentDetailPath(t, hit.id);
}

export function LiveSearchResults({
  loading,
  error,
  hits = [],
  tags = [],
  news = [],
  active,
  isEmpty,
  debouncedQ,
  onPick,
  variant = 'dropdown',
  showViewAll = true,
}) {
  if (!active) return null;

  const panelClass = variant === 'dropdown' ? 'live-search-panel' : 'live-search-panel live-search-panel--inline';

  return (
    <div className={panelClass} role="listbox" aria-label="Результати пошуку">
      {loading && (
        <p className="live-search-status">Пошук…</p>
      )}

      {error && !loading && (
        <p className="live-search-status live-search-status--error">{error}</p>
      )}

      {!loading && !error && isEmpty && (
        <p className="live-search-status">Нічого не знайдено</p>
      )}

      {!loading && tags.length > 0 && (
        <section className="live-search-group">
          <h4 className="live-search-group-title">Теги</h4>
          <ul className="live-search-list">
            {tags.map((t) => (
              <li key={t.name}>
                <Link
                  to={`/tags/${encodeURIComponent(t.name)}`}
                  className="live-search-tag"
                  onClick={onPick}
                >
                  #{t.name}
                  {t.count != null && <span className="live-search-meta"> ({t.count})</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && news.length > 0 && (
        <section className="live-search-group">
          <h4 className="live-search-group-title">Новини</h4>
          <ul className="live-search-list">
            {news.map((item) => (
              <li key={`news-${item.id}`}>
                <Link to={hitPath(item)} className="live-search-hit" onClick={onPick}>
                  <span className="live-search-hit-type">{TYPE_LABELS.news}</span>
                  <span className="live-search-hit-title">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && hits.length > 0 && (
        <section className="live-search-group">
          <h4 className="live-search-group-title">Матеріали</h4>
          <ul className="live-search-list">
            {hits.map((hit) => (
              <li key={`${hit.type}-${hit.id}`}>
                <Link to={hitPath(hit)} className="live-search-hit" onClick={onPick}>
                  <span className="live-search-hit-type">
                    {TYPE_LABELS[hit.type] || hit.type}
                  </span>
                  <span className="live-search-hit-title">{hit.title}</span>
                  {hit.excerpt && (
                    <span className="live-search-hit-excerpt">{hit.excerpt}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showViewAll && debouncedQ && !loading && (
        <Link
          to={`/search?q=${encodeURIComponent(debouncedQ)}&page=1`}
          className="live-search-view-all"
          onClick={onPick}
        >
          Усі результати →
        </Link>
      )}
    </div>
  );
}

export default LiveSearchResults;
