/**
 * Каталог розробників: пошук людей по стеку, локації та тексту.
 */

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LiveSearchBox } from '../components/LiveSearchBox';
import { usersSearch } from '../services/api';
import '../styles/brutalism.css';
import '../components/LiveSearchBox.css';
import './DevCatalog.css';

const POPULAR_STACKS = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C#', 'PHP', 'Ruby', 'C++', 'Swift', 'Kotlin'];

function excerpt(text, n = 160) {
  if (!text) return '';
  const t = String(text);
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
}

export function DevCatalog() {
  const [searchParams] = useSearchParams();
  const [activeStacks, setActiveStacks] = useState([]);
  const [location, setLocation] = useState('');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');

  const { data, isLoading } = useQuery({
    queryKey: ['devs', { activeStacks, location, search }],
    queryFn: async () => {
      const params = { limit: 50 };
      if (activeStacks.length) params.stack = activeStacks.join(',');
      if (location) params.location = location;
      if (search) params.q = search;
      return (await usersSearch(params)).data.data;
    },
  });

  const list = data?.users || [];

  const toggleStack = (s) => {
    setActiveStacks((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  return (
    <div className="container dev-catalog-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">РОЗРОБНИКИ</h1>
          <p className="page-subtitle">
            Шукайте людей по стеку, локації, текстовій ознаці. Дані стеку — з GitHub-профілю.
          </p>
        </div>
      </div>

      <div className="devs-toolbar">
        <LiveSearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmitQuery={(q) => setSearch(q.trim())}
          scope="users"
          variant="filter"
          placeholder="Пошук: нік, опис, GitHub…"
          ariaLabel="Пошук розробників"
          showViewAll={false}
          showSubmitButton={false}
          className="devs-search-wrap"
        />
        <div className="devs-toolbar-actions">
          <input
            type="text"
            className="form-input devs-location-input"
            placeholder="локація"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            onClick={() => setSearch(searchInput.trim())}
          >
            ШУКАТИ
          </button>
        </div>
      </div>

      <div className="filters devs-filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        {POPULAR_STACKS.map((s) => (
          <button
            key={s}
            type="button"
            className={`filter-btn ${activeStacks.includes(s) ? 'active' : ''}`}
            onClick={() => toggleStack(s)}
          >
            {s}
          </button>
        ))}
        {activeStacks.length > 0 && (
          <button type="button" className="filter-btn" onClick={() => setActiveStacks([])}>
            СКИНУТИ
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <p>РОЗРОБНИКІВ НЕ ЗНАЙДЕНО</p>
        </div>
      ) : (
        <div className="questions-list">
          {list.map((u) => {
            const top3 = Array.isArray(u.github_stack_top) ? u.github_stack_top : (u.github_stack || []).slice(0, 3);
            return (
              <div key={u.id} className="question-card">
                <div className="question-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username} width={48} height={48} style={{ border: '3px solid #000' }} />
                    ) : (
                      <div style={{ width: 48, height: 48, border: '3px solid #000', background: '#f5d142', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {(u.username || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-mono)' }}>{u.username}</div>
                      {u.github_login && (
                        <a href={`https://github.com/${u.github_login}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                          @{u.github_login}
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      ★ {u.reputation || 0}
                    </div>
                  </div>

                  {top3.length > 0 && (
                    <div className="question-tags" style={{ marginBottom: 8 }}>
                      {top3.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}

                  {u.bio && <p className="question-excerpt">{excerpt(u.bio, 160)}</p>}

                  <div className="devs-card-footer">
                    {u.location && <span className="devs-card-location">📍 {u.location}</span>}
                    <Link to={`/users/${u.id}`} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                      ПРОФІЛЬ →
                    </Link>
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

export default DevCatalog;
