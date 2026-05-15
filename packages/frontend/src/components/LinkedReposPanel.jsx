/**
 * LinkedReposPanel — список GitHub-репозиторіїв, прив'язаних до контент-сутності
 * (питання/стаття/гайд/сніпет/навчальний маршрут/найкраща практика/ЧаП), з можливістю додати/видалити
 * для аутентифікованого користувача.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { github } from '../services/api';
import { GitHubRepoPicker } from './GitHubRepoPicker';

function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function getUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function LinkedReposPanel({ targetType, targetId }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [repoInput, setRepoInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [showForm, setShowForm] = useState(false);

  const user = useMemo(() => getUser(), []);
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    if (!targetType || !targetId) return;
    setLoading(true);
    setError('');
    try {
      const r = await github.listLinks(targetType, targetId);
      setRepos(r.data?.data?.repos || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e?.preventDefault?.();
    if (!repoInput.trim()) return;
    setAdding(true);
    setError('');
    try {
      await github.addLink({
        targetType,
        targetId: Number(targetId),
        repo: repoInput.trim(),
        note: noteInput.trim() || undefined,
      });
      setRepoInput('');
      setNoteInput('');
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id) => {
    if (!confirm('Відв’язати цей репозиторій?')) return;
    setError('');
    try {
      await github.removeLink(id);
      setRepos((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--space-3)', fontSize: 13, opacity: 0.7 }}>
        Завантаження репозиторіїв…
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div className="stat-label">ПОВ'ЯЗАНІ РЕПОЗИТОРІЇ</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            GitHub-репозиторії, які стосуються цього матеріалу
          </div>
        </div>
        {user && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? '× Скасувати' : '+ Прив’язати репозиторій'}
          </button>
        )}
      </div>

      {showForm && user && (
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GitHubRepoPicker
            className="input"
            placeholder="owner/repo або https://github.com/owner/repo"
            value={repoInput}
            onChange={setRepoInput}
            disabled={adding}
            outputFormat="slug"
          />
          <input
            className="input"
            type="text"
            placeholder="Коротко: чим репозиторій корисний (макс. 280 симв.)"
            maxLength={280}
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            disabled={adding}
          />
          <button type="submit" className="btn btn-primary" disabled={adding || !repoInput.trim()}>
            {adding ? 'Прив’язую…' : 'Прив’язати'}
          </button>
        </form>
      )}

      {error && <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>}

      {repos.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
          Поки що жодного репозиторію.{user ? ' Будьте першим — прив’яжіть приклад чи бібліотеку.' : ''}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {repos.map((r) => {
            const canDelete = user && (isAdmin || r.added_by_user_id === user.id);
            return (
              <li
                key={r.id}
                style={{
                  border: '2px solid #000',
                  background: '#fff',
                  padding: 'var(--space-2) var(--space-3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href={r.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                  >
                    {r.full_name}
                  </a>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, fontFamily: 'var(--font-mono)', opacity: 0.75 }}>
                    {r.language && <span>{r.language}</span>}
                    <span title="Зірки">★ {formatNumber(r.stars)}</span>
                    <span title="Форки">⑃ {formatNumber(r.forks)}</span>
                    {r.is_archived ? <span style={{ color: '#b91c1c' }}>архів</span> : null}
                  </div>
                </div>
                {r.description && (
                  <div style={{ fontSize: 13, opacity: 0.85 }}>{r.description}</div>
                )}
                {r.added_note && (
                  <div style={{ fontSize: 12, opacity: 0.75, fontStyle: 'italic' }}>
                    “{r.added_note}”
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, opacity: 0.6 }}>
                  <span>
                    додав <strong>@{r.added_by_username}</strong>
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleRemove(r.id)}
                      title="Відв'язати"
                    >
                      Відв’язати
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default LinkedReposPanel;
