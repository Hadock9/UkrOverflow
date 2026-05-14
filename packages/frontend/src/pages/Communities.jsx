/**
 * Сторінка списку спільнот DevFlow.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { communities } from '../services/api';
import '../styles/brutalism.css';

const TYPE_FILTERS = [
  { id: 'all', label: 'ВСІ' },
  { id: 'city', label: 'МІСТО' },
  { id: 'university', label: 'УНІВЕРСИТЕТ' },
  { id: 'dev_club', label: 'КЛУБ РОЗРОБНИКІВ' },
  { id: 'project_team', label: 'КОМАНДА ПРОЄКТУ' },
  { id: 'study_group', label: 'НАВЧАЛЬНА ГРУПА' },
  { id: 'company', label: 'КОМПАНІЯ' },
  { id: 'online', label: 'ONLINE' },
];

const TYPE_BADGE_BG = {
  city: '#9ee6a0',
  university: '#9bd3ff',
  dev_club: '#f5d142',
  project_team: '#ffb3c7',
  study_group: '#c9b8ff',
  company: '#ffd699',
  online: '#fff',
};

function excerpt(text, n = 200) {
  if (!text) return '';
  const t = String(text);
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
}

export function Communities() {
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const queryKey = ['communities', { type, search }];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = { limit: 50 };
      if (type !== 'all') params.type = type;
      if (search) params.search = search;
      const r = await communities.list(params);
      return r.data.data;
    },
  });

  const list = data?.communities || [];

  const onSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  return (
    <div className="container">
      <div className="page-header page-header-split">
        <div>
          <h1 className="page-title">КОМ'ЮНІТІ</h1>
          <p className="page-subtitle">
            Локальні, університетські та онлайн-спільноти українських розробників.
          </p>
        </div>
        <Link to="/communities/new" className="btn btn-primary">
          + СТВОРИТИ СПІЛЬНОТУ
        </Link>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Пошук: назва або опис"
          className="form-input"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-secondary">ШУКАТИ</button>
      </form>

      <div className="filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`filter-btn ${type === t.id ? 'active' : ''}`}
            onClick={() => setType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : error ? (
        <div className="error">Помилка завантаження</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <p>СПІЛЬНОТ НЕ ЗНАЙДЕНО</p>
          <Link to="/communities/new" className="btn btn-primary">СТВОРИТИ ПЕРШУ</Link>
        </div>
      ) : (
        <div className="questions-list">
          {list.map((c) => (
            <div key={c.id} className="question-card">
              <div className="question-stats">
                <div className="stat">
                  <div className="stat-value">{c.member_count || 0}</div>
                  <div className="stat-label">ЛЮДЕЙ</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{c.post_count || 0}</div>
                  <div className="stat-label">ПОСТІВ</div>
                </div>
              </div>
              <div className="question-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      background: TYPE_BADGE_BG[c.type] || '#fff',
                      border: '2px solid #000',
                    }}
                  >
                    {c.type}
                  </span>
                  {c.location && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>📍 {c.location}</span>
                  )}
                </div>
                <Link to={`/communities/${c.slug}`} className="question-title">
                  {c.name}
                </Link>
                <p className="question-excerpt">{excerpt(c.description, 200)}</p>
                {Array.isArray(c.tags) && c.tags.length > 0 && (
                  <div className="question-tags">
                    {c.tags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Communities;
