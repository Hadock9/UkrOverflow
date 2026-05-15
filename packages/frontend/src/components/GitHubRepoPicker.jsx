/**
 * GitHubRepoPicker — підказки репозиторіїв для користувачів з підключеним GitHub.
 * Підтягує кеш із GET /api/github/me/repos (або live sync, якщо кеш порожній).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { github } from '../services/api';

function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function repoValue(repo, outputFormat) {
  if (outputFormat === 'url') {
    return repo.html_url || `https://github.com/${repo.full_name}`;
  }
  return repo.full_name || repo.name || '';
}

function RepoOption({ repo, onPick }) {
  return (
    <button
      type="button"
      className="github-repo-picker__option"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(repo)}
    >
      <span className="github-repo-picker__option-name">{repo.full_name}</span>
      {repo.description && (
        <span className="github-repo-picker__option-desc">{repo.description}</span>
      )}
      <span className="github-repo-picker__option-meta">
        {repo.language && <span>{repo.language}</span>}
        <span>★ {formatNumber(repo.stars)}</span>
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          github.com
        </a>
      </span>
    </button>
  );
}

export function GitHubRepoPicker({
  value,
  onChange,
  placeholder = 'owner/repo або https://github.com/owner/repo',
  className = 'input',
  inputType = 'text',
  outputFormat = 'slug',
  disabled = false,
  id: idProp,
}) {
  const { user } = useAuth();
  const autoId = useId();
  const inputId = idProp || autoId;
  const wrapRef = useRef(null);

  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const loadedRef = useRef(false);

  const githubLinked = !!user?.github_connected;

  const loadRepos = useCallback(async (force = false) => {
    if (!githubLinked) return;
    if (loadedRef.current && !force) return;
    setLoading(true);
    setLoadError('');
    try {
      const r = await github.myRepos({ limit: 100, ...(force ? { refresh: '1' } : {}) });
      setRepos(r.data?.data?.repos || []);
      loadedRef.current = true;
    } catch (e) {
      setLoadError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [githubLinked]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = repos.filter((r) => !r.is_archived);
    if (!q) return list.slice(0, 15);
    return list
      .filter(
        (r) =>
          (r.full_name || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [repos, value]);

  const pickRepo = (repo) => {
    onChange(repoValue(repo, outputFormat));
    setSuggestOpen(false);
    setPickerOpen(false);
  };

  const handleFocus = () => {
    if (!githubLinked || disabled) return;
    setSuggestOpen(true);
    loadRepos();
  };

  useEffect(() => {
    if (pickerOpen && githubLinked) loadRepos();
  }, [pickerOpen, githubLinked, loadRepos]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const showDropdown =
    githubLinked && suggestOpen && !disabled && (loading || filtered.length > 0 || loadError);

  return (
    <div className="github-repo-picker" ref={wrapRef}>
      {user && !githubLinked && (
        <p className="github-repo-picker__hint">
          Підключіть GitHub у <Link to="/profile">профілі</Link>.
        </p>
      )}

      {githubLinked && (
        <div className="github-repo-picker__toolbar">
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onClick={() => {
              setPickerOpen((o) => !o);
              if (!pickerOpen) loadRepos();
            }}
          >
            {pickerOpen ? '× Закрити' : 'Обрати з GitHub'}
          </button>
          {loading && <span className="github-repo-picker__loading">Завантаження…</span>}
        </div>
      )}

      {pickerOpen && githubLinked && (
        <div className="github-repo-picker__panel">
          <div className="github-repo-picker__panel-title">Ваші репозиторії з GitHub</div>
          {loadError && <div className="alert alert-error" style={{ fontSize: 12 }}>{loadError}</div>}
          {!loadError && repos.length === 0 && !loading && (
            <p className="github-repo-picker__empty">
              Репозиторіїв поки немає. Синхронізуйте GitHub у{' '}
              <Link to="/profile">профілі</Link>.
            </p>
          )}
          <div className="github-repo-picker__list" role="listbox" aria-label="Обрати репозиторій">
            {repos
              .filter((r) => !r.is_archived)
              .slice(0, 30)
              .map((repo) => (
                <RepoOption key={repo.id || repo.github_repo_id || repo.full_name} repo={repo} onPick={pickRepo} />
              ))}
          </div>
        </div>
      )}

      <div className="github-repo-picker__input-wrap">
        <input
          id={inputId}
          type={inputType}
          className={className}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          disabled={disabled}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={`${inputId}-suggestions`}
        />
        {showDropdown && (
          <div
            id={`${inputId}-suggestions`}
            className="github-repo-picker__dropdown"
            role="listbox"
            aria-label="Підказки репозиторіїв"
          >
            {loading && filtered.length === 0 && (
              <div className="github-repo-picker__dropdown-status">Завантаження репозиторіїв…</div>
            )}
            {loadError && (
              <div className="github-repo-picker__dropdown-status">{loadError}</div>
            )}
            {!loading &&
              filtered.map((repo) => (
                <RepoOption
                  key={repo.id || repo.github_repo_id || repo.full_name}
                  repo={repo}
                  onPick={pickRepo}
                />
              ))}
            {!loading && !loadError && filtered.length === 0 && value.trim() && (
              <div className="github-repo-picker__dropdown-status">
                Нічого не знайдено — введіть owner/repo вручну
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .github-repo-picker { display: flex; flex-direction: column; gap: 8px; }
        .github-repo-picker__hint { margin: 0 0 4px; font-size: 12px; opacity: 0.85; }
        .github-repo-picker__hint a { font-weight: 700; color: inherit; }
        .github-repo-picker__toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .github-repo-picker__loading { font-size: 12px; opacity: 0.65; font-family: var(--font-mono); }
        .github-repo-picker__panel {
          border: 2px solid #000;
          background: #f5f5f5;
          padding: var(--space-2);
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 280px;
          overflow: auto;
        }
        .github-repo-picker__panel-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .github-repo-picker__empty { margin: 0; font-size: 12px; opacity: 0.75; }
        .github-repo-picker__list { display: flex; flex-direction: column; gap: 4px; }
        .github-repo-picker__input-wrap { position: relative; }
        .github-repo-picker__dropdown {
          position: absolute;
          z-index: 40;
          left: 0;
          right: 0;
          top: calc(100% + 4px);
          max-height: 240px;
          overflow: auto;
          border: 2px solid #000;
          background: #fff;
          box-shadow: 4px 4px 0 #000;
        }
        .github-repo-picker__dropdown-status {
          padding: 10px 12px;
          font-size: 12px;
          opacity: 0.75;
        }
        .github-repo-picker__option {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border: none;
          border-bottom: 1px solid #ddd;
          background: #fff;
          cursor: pointer;
          font: inherit;
        }
        .github-repo-picker__option:last-child { border-bottom: none; }
        .github-repo-picker__option:hover,
        .github-repo-picker__option:focus-visible {
          background: #f5d142;
          outline: none;
        }
        .github-repo-picker__option-name {
          font-weight: 700;
          font-family: var(--font-mono);
          font-size: 13px;
        }
        .github-repo-picker__option-desc {
          font-size: 12px;
          opacity: 0.85;
          line-height: 1.35;
        }
        .github-repo-picker__option-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 11px;
          font-family: var(--font-mono);
          opacity: 0.7;
        }
        .github-repo-picker__option-meta a { color: inherit; font-weight: 700; }
      `}</style>
    </div>
  );
}

export default GitHubRepoPicker;
