/**
 * Глобальний пошук — результати оновлюються під час введення.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { search } from '../services/api';
import { LiveSearchBox } from '../components/LiveSearchBox';
import { CONTENT_TYPES, getContentDetailPath } from '../constants/contentTypes';
import '../components/LiveSearchBox.css';
import '../styles/brutalism.css';

const TYPE_LABELS = {
  [CONTENT_TYPES.QUESTION]: 'Питання',
  [CONTENT_TYPES.ARTICLE]: 'Стаття',
  [CONTENT_TYPES.GUIDE]: 'Гайд',
  [CONTENT_TYPES.SNIPPET]: 'Сніпет',
  [CONTENT_TYPES.ROADMAP]: 'Маршрут',
  [CONTENT_TYPES.BEST_PRACTICE]: 'Практика',
  [CONTENT_TYPES.FAQ]: 'ЧаП',
  [CONTENT_TYPES.COMMUNITY_POST]: 'Спільнота',
};

function hitHref(hit) {
  const t = hit.type === 'community_post' ? CONTENT_TYPES.COMMUNITY_POST : hit.type;
  return getContentDetailPath(t, hit.id);
}

export function GlobalSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q0 = searchParams.get('q') || '';
  const [input, setInput] = useState(q0);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [queryEcho, setQueryEcho] = useState('');

  useEffect(() => {
    setInput(q0);
  }, [q0]);

  useEffect(() => {
    if (!q0 || q0.length < 2) {
      setHits([]);
      setPagination(null);
      setQueryEcho('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const page = parseInt(searchParams.get('page') || '1', 10) || 1;
        const res = await search.global(q0, { page, limit: 20 });
        const root = res.data?.data || res.data;
        if (cancelled) return;
        setHits(root.hits || []);
        setPagination(root.pagination || null);
        setQueryEcho(root.query || q0);
      } catch {
        if (!cancelled) {
          setHits([]);
          setPagination(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [q0, searchParams]);

  useEffect(() => {
    if (input.trim().length < 2) return;
    const t = setTimeout(() => {
      const trimmed = input.trim();
      if (trimmed === q0) return;
      setSearchParams({ q: trimmed, page: '1' }, { replace: true });
    }, 450);
    return () => clearTimeout(t);
  }, [input, q0, setSearchParams]);

  const onSubmitQuery = (q) => {
    setSearchParams({ q, page: '1' });
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">ПОШУК</h1>
        <p className="page-subtitle">
          Результати зʼявляються під час введення — хаб, спільноти, новини, теги
        </p>
      </div>

      <LiveSearchBox
        value={input}
        onChange={setInput}
        onSubmitQuery={onSubmitQuery}
        variant="page"
        showSubmitButton
        inputClassName="form-input"
        className="live-search-page-box"
      />

      {loading && q0.length >= 2 && <div className="loading">ПОВНИЙ ПОШУК…</div>}

      {!loading && q0.length >= 2 && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 16 }}>
          Запит: <strong>{queryEcho || q0}</strong>
          {pagination ? ` · знайдено: ${pagination.total}` : ''}
        </p>
      )}

      {!loading && q0.length >= 2 && hits.length === 0 && (
        <div className="empty-state">НІЧОГО НЕ ЗНАЙДЕНО</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {hits.map((hit) => (
          <div key={`${hit.type}-${hit.id}`} className="question-card">
            <div className="question-content">
              <div style={{ marginBottom: 6 }}>
                <span className="tag" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                  {TYPE_LABELS[hit.type] || hit.type}
                </span>
                {hit.community_name && (
                  <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
                    {hit.community_name}
                  </span>
                )}
              </div>
              <Link to={hitHref(hit)} className="question-title">{hit.title}</Link>
              {hit.excerpt && <p className="question-excerpt">{hit.excerpt}</p>}
              <div className="question-meta">
                {hit.author_name && (
                  <>
                    <span>{hit.author_name}</span>
                    <span className="separator">•</span>
                  </>
                )}
                {hit.created_at && (
                  <span className="date">
                    {new Date(hit.created_at).toLocaleString('uk-UA')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="pagination" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() => setSearchParams({ q: q0, page: String(pagination.page - 1) })}
          >
            ← ПОПЕРЕДНЯ
          </button>
          <span className="page-info">
            СТОРІНКА {pagination.page} З {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setSearchParams({ q: q0, page: String(pagination.page + 1) })}
          >
            ДАЛІ →
          </button>
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
