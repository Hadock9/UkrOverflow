/**
 * Допомога при типовій помилці GitHub «redirect_uri is not associated»
 * — GitHub її показує на github.com до редіректу на наш callback, тому
 * ми не можемо перехопити її через API після переходу; показуємо очікуваний redirect_uri завчасно.
 */

import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function GitHubOAuthHint() {
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/github/status')
      .then((r) => {
        const d = r.data?.data ?? r.data ?? {};
        if (!cancelled && d.enabled) {
          setPayload({
            redirectUri: d.redirect_uri ?? null,
            redirectUriError: d.redirect_uri_error ?? null,
            oauthAppsUrl: d.oauth_apps_url ?? 'https://github.com/settings/developers',
            oauthDocsUrl: d.oauth_docs_url ?? '',
          });
        }
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!payload?.redirectUri) return null;

  return (
    <details
      className="auth-github-oauth-hint"
      style={{
        marginTop: 'var(--space-2)',
        padding: 'var(--space-2)',
        border: '2px solid var(--border-color)',
        borderRadius: 0,
        fontSize: '0.8rem',
        textAlign: 'left',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
        Якщо на GitHub: «redirect_uri is not associated with this application»
      </summary>
      <div style={{ marginTop: 'var(--space-2)', lineHeight: 1.45 }}>
        <p style={{ margin: '0 0 var(--space-2)' }}>
          Це налаштовується лише на стороні{' '}
          <a href={payload.oauthAppsUrl} target="_blank" rel="noreferrer">
            GitHub → Settings → Developer settings → OAuth Apps
          </a>
          . Поле{' '}
          <strong>Authorization callback URL</strong> має збігатися з рядком нижче (включно з{' '}
          <code>http</code> або <code>https</code>).
        </p>
        <code
          style={{
            display: 'block',
            wordBreak: 'break-word',
            padding: 'var(--space-2)',
            background: 'var(--color-gray-100)',
            border: 'var(--border-width) solid var(--border-color)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.75rem',
          }}
        >
          {payload.redirectUri}
        </code>
        {payload.redirectUriError ? (
          <p className="form-error" style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Діагностика API: {payload.redirectUriError}
          </p>
        ) : null}
        {payload.oauthDocsUrl ? (
          <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            <a href={payload.oauthDocsUrl} target="_blank" rel="noreferrer">
              Документація GitHub про redirect URIs
            </a>
          </p>
        ) : null}
      </div>
    </details>
  );
}

