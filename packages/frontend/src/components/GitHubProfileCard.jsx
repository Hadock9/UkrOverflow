/**
 * GitHub-секція профілю користувача.
 *
 * Якщо це власний профіль (`isOwn`) — показує кнопки Connect/Sync/Disconnect.
 * Якщо профіль чужий — лише публічну інформацію.
 *
 * Очікує `userId` (число) і опційно `token` для линкування (для власного профілю).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { github, githubLoginUrl } from '../services/api';
import { ContributionHeatmap } from './ContributionHeatmap';
import { GitHubBadges } from './GitHubBadges';

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function StackBar({ items, max }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.slice(0, 8).map((it) => {
        const pct = Math.max(8, Math.round((it.count / max) * 100));
        return (
          <div key={it.name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{it.name}</span>
            <div style={{ height: 14, background: '#eee', border: '2px solid #000' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#0d1117' }} />
            </div>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {it.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RepoCard({ repo, isOwn, isPinned, onTogglePin, pinDisabled }) {
  return (
    <div style={{ border: '2px solid #000', padding: 12, background: '#fff', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 700, textDecoration: 'underline', wordBreak: 'break-all' }}
        >
          {repo.full_name || repo.name}
        </a>
        {repo.language && (
          <span style={{ fontSize: 11, padding: '2px 6px', border: '2px solid #000', background: '#f5d142' }}>
            {repo.language}
          </span>
        )}
      </div>
      {repo.description && (
        <p style={{ margin: 0, fontSize: 13 }}>{repo.description}</p>
      )}
      <div style={{ display: 'flex', gap: 12, fontSize: 12, fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
        <span>★ {formatNumber(repo.stars)}</span>
        <span>⑂ {formatNumber(repo.forks)}</span>
        {repo.open_issues ? <span>● {formatNumber(repo.open_issues)} issues</span> : null}
        {repo.pushed_at && (
          <span style={{ opacity: 0.6 }}>
            {new Date(repo.pushed_at).toLocaleDateString('uk-UA')}
          </span>
        )}
      </div>
      {isOwn && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onTogglePin(repo.id)}
          disabled={pinDisabled && !isPinned}
          style={{ alignSelf: 'flex-start' }}
        >
          {isPinned ? '★ ВІДКРІПИТИ' : '☆ ЗАКРІПИТИ'}
        </button>
      )}
    </div>
  );
}

export function GitHubProfileCard({ userId, isOwn, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showAllRepos, setShowAllRepos] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await github.userProfile(userId);
      setData(r.data?.data || null);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    github.status()
      .then((r) => setEnabled(!!r.data?.data?.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => { if (userId) fetchData(); }, [fetchData, userId]);

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const r = await github.sync();
      const payload = r.data?.data || {};
      const user = payload.user;
      setData((prev) => ({
        ...(prev || {}),
        connected: true,
        stack: payload.stack ?? prev?.stack,
        repos: payload.repos ?? prev?.repos,
        pinned: (payload.repos || []).filter((x) => x.is_pinned),
        contributions: payload.contributions ?? prev?.contributions,
        badges: payload.badges ?? prev?.badges,
        activity: payload.activity ?? prev?.activity,
        profile: user?.github_profile || prev?.profile,
        synced_at: user?.github_synced_at || new Date().toISOString(),
      }));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Відв’язати GitHub від цього акаунта?')) return;
    try {
      await github.unlink();
      await fetchData();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const handleTogglePin = async (repoLocalId) => {
    if (!data?.repos) return;
    const current = data.repos.filter((r) => r.is_pinned).map((r) => r.id);
    const next = current.includes(repoLocalId)
      ? current.filter((id) => id !== repoLocalId)
      : [...current, repoLocalId];
    if (next.length > 6) {
      setError('Максимум 6 закріплених репозиторіїв');
      return;
    }
    try {
      const r = await github.pin(next);
      setData((prev) => ({
        ...(prev || {}),
        repos: r.data?.data?.repos || prev?.repos,
        pinned: (r.data?.data?.repos || []).filter((x) => x.is_pinned),
      }));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const totalLangCount = useMemo(() => {
    return (data?.stack?.languages || []).reduce((acc, l) => acc + l.count, 0);
  }, [data]);

  const visibleRepos = useMemo(() => {
    const all = data?.repos || [];
    if (!all.length) return [];
    if (showAllRepos) return all;
    const pinnedFirst = all.filter((r) => r.is_pinned);
    if (pinnedFirst.length > 0) return pinnedFirst.slice(0, 6);
    return all.slice(0, 6);
  }, [data, showAllRepos]);

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="loading">ЗАВАНТАЖЕННЯ GITHUB...</div>
      </div>
    );
  }

  const profile = data?.profile;
  const connected = !!data?.connected;

  if (!connected) {
    if (!isOwn) {
      return null;
    }
    return (
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>GITHUB</h2>
        <p style={{ marginTop: 'var(--space-2)' }}>
          Підключіть GitHub, щоб автоматично підтягнути стек, репозиторії та статистику контрибуцій.
        </p>
        {!enabled && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-2)' }}>
            GitHub OAuth не налаштовано на сервері. Задайте GITHUB_CLIENT_ID та GITHUB_CLIENT_SECRET у .env і перезапустіть API. Callback має збігатися з полем Authorization callback URL у OAuth App (перевірте GET /api/auth/github/status).
          </div>
        )}
        <a
          href={githubLoginUrl({ link: true, token })}
          className="btn"
          style={{ background: '#0d1117', color: '#fff', borderColor: '#0d1117', textDecoration: 'none' }}
        >
          ПІДКЛЮЧИТИ GITHUB
        </a>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {profile?.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.login}
            style={{ width: 96, height: 96, border: '3px solid #000' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{profile?.name || profile?.login || 'GitHub'}</h2>
            {profile?.login && (
              <a href={profile.html_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                @{profile.login}
              </a>
            )}
          </div>
          {profile?.bio && <p style={{ margin: '4px 0' }}>{profile.bio}</p>}
          <div style={{ display: 'flex', gap: 12, fontSize: 13, fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
            {profile?.company && <span>🏢 {profile.company}</span>}
            {profile?.location && <span>📍 {profile.location}</span>}
            {profile?.blog && (
              <a href={/^https?:/.test(profile.blog) ? profile.blog : `https://${profile.blog}`} target="_blank" rel="noopener noreferrer">
                🔗 {profile.blog}
              </a>
            )}
            {profile?.followers !== undefined && <span>👥 {profile.followers} підписників</span>}
            {profile?.public_repos !== undefined && <span>📦 {profile.public_repos} репозиторіїв</span>}
          </div>
        </div>

        {isOwn && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? 'СИНХРОНІЗАЦІЯ...' : '⟳ СИНХРОНІЗУВАТИ GITHUB'}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleUnlink}>
              ВІДВ’ЯЗАТИ
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {(data?.badges?.length > 0 || isOwn) && (
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>БЕЙДЖІ</div>
          <GitHubBadges badges={data?.badges || []} />
        </div>
      )}

      {(data?.contributions || isOwn) && (
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>КОНТРИБУЦІЇ ЗА РІК</div>
          {data?.contributions ? (
            <ContributionHeatmap data={data.contributions} />
          ) : (
            <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
              {isOwn ? 'Натисніть «Синхронізувати GitHub», щоб підтягнути сітку контрибуцій.' : 'Дані ще не синхронізовані.'}
            </p>
          )}
        </div>
      )}

      {data?.stack && (
        <div className="grid grid-3" style={{ gap: 'var(--space-3)' }}>
          <div className="card" style={{ padding: 'var(--space-3)' }}>
            <div className="stat-label" style={{ marginBottom: 4 }}>СТЕК (МОВИ)</div>
            {(data.stack.languages || []).length > 0 ? (
              <StackBar items={data.stack.languages} max={totalLangCount || 1} />
            ) : (
              <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
                Поки немає даних. {isOwn ? 'Натисніть «Синхронізувати GitHub».' : ''}
              </p>
            )}
          </div>
          <div className="card" style={{ padding: 'var(--space-3)' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>СТАТИСТИКА</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 14 }}>
              <div>📦 публічних репозиторіїв: <strong>{formatNumber(data.stack.publicRepoCount)}</strong></div>
              <div>★ суми зірок: <strong>{formatNumber(data.stack.totalStars)}</strong></div>
              <div>⑂ форків: <strong>{formatNumber(data.stack.totalForks)}</strong></div>
              {data?.activity && (
                <>
                  <div style={{ marginTop: 8, opacity: 0.6 }}>Останні 30 днів:</div>
                  <div>● подій: <strong>{data.activity.events}</strong></div>
                  <div>↑ комітів: <strong>{data.activity.commits}</strong></div>
                </>
              )}
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--space-3)' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>ТЕМИ / ТЕГИ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(data.stack.topics || []).slice(0, 16).map((t) => (
                <span key={t.name} className="tag">{t.name}</span>
              ))}
              {(data.stack.topics || []).length === 0 && (
                <span style={{ fontSize: 13, opacity: 0.7 }}>Немає тем на репозиторіях.</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{showAllRepos ? 'УСІ РЕПОЗИТОРІЇ' : 'ЗАКРІПЛЕНІ / ТОП РЕПОЗИТОРІЇВ'}</h3>
          {(data?.repos?.length || 0) > 6 && (
            <button type="button" className="btn btn-sm" onClick={() => setShowAllRepos((v) => !v)}>
              {showAllRepos ? 'ПОКАЗАТИ МЕНШЕ' : `ПОКАЗАТИ ВСІ (${data.repos.length})`}
            </button>
          )}
        </div>
        {visibleRepos.length === 0 ? (
          <p style={{ opacity: 0.7 }}>
            Репозиторії ще не закешовані. {isOwn ? 'Натисніть «Синхронізувати GitHub» вище.' : ''}
          </p>
        ) : (
          <div className="grid grid-2" style={{ gap: 'var(--space-2)' }}>
            {visibleRepos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                isOwn={isOwn}
                isPinned={repo.is_pinned}
                pinDisabled={(data.repos.filter((r) => r.is_pinned).length >= 6)}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        )}
      </div>

      {data?.synced_at && (
        <p style={{ margin: 0, fontSize: 11, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
          Остання синхронізація: {new Date(data.synced_at).toLocaleString('uk-UA')}
        </p>
      )}
    </div>
  );
}

export default GitHubProfileCard;
