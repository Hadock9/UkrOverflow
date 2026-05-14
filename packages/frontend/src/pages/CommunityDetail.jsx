/**
 * Сторінка деталей спільноти: банер + таби + список постів + учасники.
 */

import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { communities, communityPosts } from '../services/api';
import '../styles/brutalism.css';

const POST_TYPE_BADGE = {
  discussion: { bg: '#fff', label: 'ОБГОВОРЕННЯ' },
  pet_project: { bg: '#9ee6a0', label: 'ПЕТ-ПРОЄКТ' },
  code_review: { bg: '#9bd3ff', label: 'ПЕРЕГЛЯД КОДУ' },
  mentor_request: { bg: '#f5d142', label: 'МЕНТОР' },
  roadmap_request: { bg: '#ffb3c7', label: 'МАРШРУТ' },
  team_search: { bg: '#c9b8ff', label: 'КОМАНДА' },
  event: { bg: '#ffd699', label: 'ПОДІЯ' },
  announcement: { bg: '#ffaaaa', label: 'АНОНС' },
};

const TABS = [
  { id: 'feed', label: 'СТРІЧКА', type: null },
  { id: 'pet_project', label: 'ПЕТ-ПРОЄКТИ', type: 'pet_project' },
  { id: 'code_review', label: 'ПЕРЕГЛЯД КОДУ', type: 'code_review' },
  { id: 'mentor_request', label: 'МЕНТОРСТВО', type: 'mentor_request' },
  { id: 'roadmap_request', label: 'МАРШРУТИ', type: 'roadmap_request' },
  { id: 'team_search', label: 'КОМАНДНІ', type: 'team_search' },
  { id: 'event', label: 'ПОДІЇ', type: 'event' },
  { id: 'members', label: 'УЧАСНИКИ', type: null },
];

const CREATE_TYPES = [
  { value: 'discussion', label: 'Обговорення' },
  { value: 'pet_project', label: 'Пет-проєкт' },
  { value: 'code_review', label: 'Перегляд коду' },
  { value: 'mentor_request', label: 'Шукаю ментора' },
  { value: 'roadmap_request', label: 'Шукаю навчальний маршрут' },
  { value: 'team_search', label: 'Шукаю команду' },
  { value: 'event', label: 'Подія' },
  { value: 'announcement', label: 'Анонс' },
];

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff} сек тому`;
  if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} год тому`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн тому`;
  return date.toLocaleDateString('uk-UA');
}

function excerpt(text, n = 180) {
  if (!text) return '';
  const t = String(text);
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
}

export function CommunityDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('feed');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const { data: communityData, isLoading: cLoading } = useQuery({
    queryKey: ['community', slug],
    queryFn: async () => (await communities.get(slug)).data.data.community,
    enabled: !!slug,
  });

  const community = communityData;

  const currentType = TABS.find((t) => t.id === tab)?.type || null;

  const { data: postsData, isLoading: pLoading } = useQuery({
    queryKey: ['communityPosts', community?.id, currentType],
    queryFn: async () => {
      const params = { communityId: community.id, limit: 50 };
      if (currentType) params.type = currentType;
      return (await communityPosts.list(params)).data.data;
    },
    enabled: !!community?.id && tab !== 'members',
  });

  const { data: membersData, isLoading: mLoading } = useQuery({
    queryKey: ['communityMembers', community?.id],
    queryFn: async () => (await communities.members(community.id, { limit: 100 })).data.data,
    enabled: !!community?.id && tab === 'members',
  });

  const joinMutation = useMutation({
    mutationFn: () => communities.join(community.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', slug] }),
  });
  const leaveMutation = useMutation({
    mutationFn: () => communities.leave(community.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', slug] }),
  });

  if (cLoading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  if (!community) return <div className="container"><div className="error">СПІЛЬНОТУ НЕ ЗНАЙДЕНО</div></div>;

  const isMember = !!community.myRole;
  const isOwner = community.myRole === 'owner' || community.owner_id === user?.id;

  return (
    <div className="container">
      <div
        style={{
          border: '4px solid #000',
          background: '#fff',
          boxShadow: '8px 8px 0 #000',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '2px 8px',
                  background: '#f5d142',
                  border: '2px solid #000',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {community.type}
              </span>
              {community.location && (
                <span>📍 {community.location}</span>
              )}
              {community.website && (
                <a href={community.website} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                  🌐 {community.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
            <h1 style={{ fontSize: 28, margin: 0, marginBottom: 8 }}>{community.name}</h1>
            <p style={{ margin: 0, marginBottom: 12, fontSize: 14, lineHeight: 1.45 }}>
              {community.description}
            </p>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span><strong>{community.member_count || 0}</strong> учасників</span>
              <span><strong>{community.post_count || 0}</strong> постів</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!user ? (
              <button className="btn btn-primary" onClick={() => navigate('/login')}>УВІЙТИ ЩОБ ПРИЄДНАТИСЯ</button>
            ) : isOwner ? (
              <span className="tag" style={{ background: '#f5d142' }}>ВИ ВЛАСНИК</span>
            ) : isMember ? (
              <button className="btn btn-secondary" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
                ВИЙТИ
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
                ПРИЄДНАТИСЯ
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreateMenuOpen((x) => !x)}
                disabled={!user}
              >
                + НОВИЙ ПОСТ {createMenuOpen ? '▴' : '▾'}
              </button>
              {createMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    minWidth: 240,
                    background: '#fff',
                    border: '4px solid #000',
                    boxShadow: '8px 8px 0 #000',
                    zIndex: 30,
                  }}
                >
                  {CREATE_TYPES.map((ct, i) => (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => {
                        setCreateMenuOpen(false);
                        navigate(`/communities/${slug}/new?type=${ct.value}`);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        background: '#fff',
                        border: 'none',
                        borderTop: i === 0 ? 'none' : '2px solid #000',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5d142'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {Array.isArray(community.tags) && community.tags.length > 0 && (
          <div className="question-tags" style={{ marginTop: 12 }}>
            {community.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`filter-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        mLoading ? (
          <div className="loading">ЗАВАНТАЖЕННЯ...</div>
        ) : (
          <div className="questions-list">
            {(membersData?.members || []).map((m) => (
              <div key={m.id} className="question-card">
                <div className="question-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tag">{m.role}</span>
                    <Link to={`/users/${m.user_id}`} className="question-title" style={{ fontSize: 16 }}>
                      {m.username}
                    </Link>
                    {m.github_login && (
                      <a href={`https://github.com/${m.github_login}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                        @{m.github_login}
                      </a>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 12 }}>★ {m.reputation || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : pLoading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : (postsData?.posts || []).length === 0 ? (
        <div className="empty-state">
          <p>ПОСТІВ ПОКИ НЕМАЄ</p>
          {user && (
            <button className="btn btn-primary" onClick={() => navigate(`/communities/${slug}/new?type=discussion`)}>
              СТВОРИТИ ПЕРШИЙ
            </button>
          )}
        </div>
      ) : (
        <div className="questions-list">
          {(postsData?.posts || []).map((p) => {
            const badge = POST_TYPE_BADGE[p.type] || POST_TYPE_BADGE.discussion;
            return (
              <div key={p.id} className="question-card">
                <div className="question-stats">
                  <div className="stat">
                    <div className="stat-value">{p.votes || 0}</div>
                    <div className="stat-label">ГОЛОСИ</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{p.comment_count || 0}</div>
                    <div className="stat-label">КОМЕНТ</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{p.views || 0}</div>
                    <div className="stat-label">ПЕРЕГЛ</div>
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
                        background: badge.bg,
                        border: '2px solid #000',
                      }}
                    >
                      {badge.label}
                    </span>
                    {p.status !== 'open' && (
                      <span className="tag" style={{ background: '#ddd' }}>{p.status}</span>
                    )}
                  </div>
                  <Link to={`/community-posts/${p.id}`} className="question-title">
                    {p.title}
                  </Link>
                  <p className="question-excerpt">{excerpt(p.body)}</p>
                  {Array.isArray(p.stack) && p.stack.length > 0 && (
                    <div className="question-tags">
                      {p.stack.slice(0, 6).map((s) => (
                        <span key={s} className="tag">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="question-meta">
                    <Link to={`/users/${p.author_id}`} className="author">{p.author_name}</Link>
                    <span className="separator">•</span>
                    <span className="date">{formatDate(p.created_at)}</span>
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

export default CommunityDetail;
