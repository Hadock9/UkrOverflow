/**
 * Каталог менторів DevFlow.
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { LiveSearchBox } from '../components/LiveSearchBox';
import { mentors } from '../services/api';
import '../styles/brutalism.css';
import '../components/LiveSearchBox.css';

const POPULAR_STACKS = ['react', 'typescript', 'nodejs', 'python', 'go', 'java', 'kubernetes', 'postgresql'];

function excerpt(text, n = 240) {
  if (!text) return '';
  const t = String(text);
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
}

export function Mentors() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeStacks, setActiveStacks] = useState([]);
  const [language, setLanguage] = useState('');
  const [topic, setTopic] = useState('');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');

  const { data, isLoading } = useQuery({
    queryKey: ['mentors-list', { activeStacks, language, topic, search }],
    queryFn: async () => {
      const params = { limit: 50 };
      if (activeStacks.length) params.stack = activeStacks.join(',');
      if (language) params.language = language;
      if (topic) params.topic = topic;
      if (search) params.search = search;
      return (await mentors.list(params)).data.data;
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ['mentors-me'],
    queryFn: async () => {
      const r = await mentors.me();
      return r.data.data.profile;
    },
    enabled: !!user,
  });

  const toggleStack = (s) => {
    setActiveStacks((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const list = data?.mentors || [];

  return (
    <div className="container">
      <div className="page-header page-header-split">
        <div>
          <h1 className="page-title">МЕНТОРИ</h1>
          <p className="page-subtitle">
            Українські розробники, які допомагають іншим рости. Знайдіть свого ментора або станьте ним самі.
          </p>
        </div>
        {user && (
          <Link to="/mentors/edit" className="btn btn-primary">
            {myProfile ? 'РЕДАГУВАТИ ПРОФІЛЬ' : 'СТАТИ МЕНТОРОМ'}
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <LiveSearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmitQuery={(q) => setSearch(q.trim())}
          scope="mentors"
          variant="filter"
          placeholder="Пошук: ім'я, опис профілю…"
          ariaLabel="Пошук менторів"
          showViewAll={false}
          className="mentors-search-live"
        />
        <input
          type="text"
          className="form-input"
          placeholder="мова (ua, en)"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{ width: 140 }}
        />
        <input
          type="text"
          className="form-input"
          placeholder="тема"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{ width: 160 }}
        />
      </div>

      <div className="filters" style={{ flexWrap: 'wrap', gap: 8 }}>
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
          <p>МЕНТОРІВ НЕ ЗНАЙДЕНО</p>
          {user && !myProfile && (
            <button className="btn btn-primary" onClick={() => navigate('/mentors/edit')}>
              СТАТИ ПЕРШИМ МЕНТОРОМ
            </button>
          )}
        </div>
      ) : (
        <div className="questions-list">
          {list.map((m) => {
            const top3 = (Array.isArray(m.stack) ? m.stack : []).slice(0, 3);
            return (
              <div key={m.user_id} className="question-card">
                <div className="question-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.username} width={48} height={48} style={{ border: '3px solid #000', borderRadius: 0 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, border: '3px solid #000', background: '#f5d142', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {(m.username || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <Link to={`/users/${m.user_id}`} className="question-title" style={{ fontSize: 18 }}>
                        {m.username}
                      </Link>
                      {m.github_login && (
                        <div style={{ fontSize: 12 }}>
                          <a href={`https://github.com/${m.github_login}`} target="_blank" rel="noreferrer">
                            @{m.github_login}
                          </a>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      ★ {m.reputation || 0}
                    </div>
                  </div>

                  {top3.length > 0 && (
                    <div className="question-tags" style={{ marginBottom: 8 }}>
                      {top3.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}

                  <p className="question-excerpt">{excerpt(m.bio, 240)}</p>

                  <div style={{ marginTop: 6 }}>
                    <Link to={`/users/${m.user_id}`} style={{ fontSize: 12, fontWeight: 700 }}>
                      Публікації в хабі →
                    </Link>
                  </div>

                  <div style={{ display: 'flex', gap: 14, fontSize: 12, fontFamily: 'var(--font-mono)', flexWrap: 'wrap', marginTop: 8 }}>
                    {m.availability_hours_week > 0 && (
                      <span>⏱ {m.availability_hours_week} год/тиж</span>
                    )}
                    {m.contact_method && (
                      <span>✉ {m.contact_method}</span>
                    )}
                    {m.price_note && (
                      <span>💰 {m.price_note}</span>
                    )}
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

export default Mentors;
