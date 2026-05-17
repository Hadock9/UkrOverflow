/**
 * Google OAuth 2.0 (OpenID Connect userinfo).
 *
 * Env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI — повний callback (рекомендовано)
 *   GOOGLE_CALLBACK_URL — альтернатива
 *   PUBLIC_API_URL / FRONTEND_URL — як у GitHub OAuth
 */

import {
  parseFrontendOrigins,
  pickOriginForGithubOAuthCallback,
  sanitizeHttpUrlDuplicates,
} from '../utils/frontendOrigin.js';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

function readEnvUrl(key) {
  return sanitizeHttpUrlDuplicates(process.env[key]);
}

export function normalizeRedirectUri(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!s) return s;
  try {
    const u = new URL(s);
    let p = u.pathname;
    while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    u.pathname = p;
    return u.toString();
  } catch {
    return s.replace(/\/+$/, '');
  }
}

function finalizeRedirectUri(candidate) {
  return normalizeRedirectUri(candidate);
}

export function resolveGoogleCallbackUrlFromRequest(req) {
  const strict = readEnvUrl('GOOGLE_OAUTH_REDIRECT_URI');
  if (strict) return finalizeRedirectUri(strict);

  const explicit = readEnvUrl('GOOGLE_CALLBACK_URL');
  if (explicit) return finalizeRedirectUri(explicit);

  const allowed = parseFrontendOrigins();
  const publicApi = readEnvUrl('PUBLIC_API_URL');
  if (publicApi) {
    return finalizeRedirectUri(`${publicApi.replace(/\/$/, '')}/api/auth/google/callback`);
  }

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.API_PORT || '3338';
    return finalizeRedirectUri(`http://localhost:${port}/api/auth/google/callback`);
  }

  if (allowed.length > 0) {
    const base = pickOriginForGithubOAuthCallback(allowed) ?? allowed[0];
    return finalizeRedirectUri(`${base.replace(/\/$/, '')}/api/auth/google/callback`);
  }

  const port = process.env.API_PORT || '3338';
  return finalizeRedirectUri(`http://localhost:${port}/api/auth/google/callback`);
}

export function resolveGoogleCallbackUrl() {
  return resolveGoogleCallbackUrlFromRequest(null);
}

export function logGoogleOAuthRedirectUriHint() {
  if (!isGoogleConfigured()) return;
  try {
    console.log(`[Google OAuth] redirect_uri → ${resolveGoogleCallbackUrl()}`);
  } catch (e) {
    console.warn('[Google OAuth] Callback URL:', e.message);
  }
}

function requireOAuth(req) {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const callback = resolveGoogleCallbackUrlFromRequest(req ?? null);
  if (!id || !secret) {
    throw new Error(
      'Google OAuth не налаштовано. Задайте GOOGLE_CLIENT_ID та GOOGLE_CLIENT_SECRET у .env.'
    );
  }
  return { id, secret, callback };
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function buildAuthorizeUrl({ state, req } = {}) {
  const { id, callback } = requireOAuth(req);
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: callback,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  if (state) params.set('state', state);
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeCodeForToken(code, req) {
  const { id, secret, callback } = requireOAuth(req);
  const body = new URLSearchParams({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: callback,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    const reason = data?.error_description || data?.error || res.statusText;
    throw new Error(`Google token exchange failed: ${reason}`);
  }
  return { accessToken: data.access_token };
}

export async function fetchGoogleUser(accessToken) {
  const res = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.sub) {
    throw new Error(data?.error_description || data?.error || 'Не вдалося отримати профіль Google');
  }
  return data;
}

export function pickGoogleProfile(googleUser) {
  return {
    sub: googleUser.sub,
    email: googleUser.email,
    email_verified: googleUser.email_verified,
    name: googleUser.name,
    given_name: googleUser.given_name,
    family_name: googleUser.family_name,
    picture: googleUser.picture,
    locale: googleUser.locale,
  };
}
