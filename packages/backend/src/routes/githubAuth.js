/**
 * GitHub OAuth: вхід через GitHub + лінкування до існуючого акаунта.
 *
 * GET  /api/auth/github          → редірект на GitHub authorize (?link=1, ?as=<jwt> для лінкування)
 * GET  /api/auth/github/callback → обмін code → user upsert → редірект на фронт із JWT
 * POST /api/auth/github/unlink   → відключити GitHub від акаунта
 *
 * Параметри середовища:
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (обов’язково)
 *   GITHUB_OAUTH_REDIRECT_URI — повний callback URL як у GitHub OAuth App (найнадійніше).
 *   GITHUB_CALLBACK_URL або PUBLIC_API_URL або FRONTEND_URL / GITHUB_OAUTH_PUBLIC_ORIGIN — інакше.
 *   FRONTEND_URL (для post-callback редіректу та CORS)
 *
 * Поля OAuth App на GitHub (Homepage, Authorization callback) — повні URL із http:// або https://.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  isGitHubConfigured,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchAuthenticatedUser,
  fetchUserEmails,
  pickPublicProfile,
  resolveGithubCallbackUrlFromRequest,
} from '../services/githubService.js';
import { resolveFrontendBaseUrl, parseFrontendOrigins } from '../utils/frontendOrigin.js';

const router = express.Router();

function makeState(payload) {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: '10m' });
}

function readState(state) {
  try {
    return jwt.verify(state, jwtConfig.secret);
  } catch {
    return null;
  }
}

function issueAppToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
}

function pickPrimaryEmail(emails) {
  if (!Array.isArray(emails)) return null;
  const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
  return primary?.email || null;
}

router.get('/status', (req, res) => {
  let redirect_uri = null;
  let redirect_uri_error = null;
  try {
    redirect_uri = resolveGithubCallbackUrlFromRequest(req);
  } catch (e) {
    redirect_uri_error = e?.message ?? String(e);
  }
  res.json({
    success: true,
    data: {
      enabled: isGitHubConfigured(),
      redirect_uri,
      ...(redirect_uri_error ? { redirect_uri_error } : {}),
      oauth_apps_url: 'https://github.com/settings/developers',
      oauth_docs_url:
        'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#redirect-urls-and-loopback',
    },
  });
});

/** GET /api/auth/github/resolved-callback — діагностика redirect_uri для GitHub (без секретів). */
router.get('/resolved-callback', (req, res) => {
  try {
    const redirect_uri = resolveGithubCallbackUrlFromRequest(req);
    res.json({
      success: true,
      data: {
        redirect_uri,
        node_env: process.env.NODE_ENV ?? null,
        has_github_oauth_redirect_uri: Boolean(process.env.GITHUB_OAUTH_REDIRECT_URI?.trim()),
        has_github_callback_url: Boolean(process.env.GITHUB_CALLBACK_URL?.trim()),
        has_oauth_public_origin: Boolean(process.env.GITHUB_OAUTH_PUBLIC_ORIGIN?.trim()),
        frontend_origin_count: parseFrontendOrigins().length,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/', (req, res) => {
  if (!isGitHubConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'GitHub OAuth не налаштовано на сервері. Задайте GITHUB_CLIENT_ID і GITHUB_CLIENT_SECRET (див. .env.example). Callback URL за замовчуванням будується з FRONTEND_URL / PUBLIC_API_URL / dev localhost.',
    });
  }

  const isLink = String(req.query.link || '') === '1';
  const asToken = typeof req.query.as === 'string' ? req.query.as : null;

  let linkUserId = null;
  if (isLink && asToken) {
    try {
      const decoded = jwt.verify(asToken, jwtConfig.secret);
      if (decoded?.id) linkUserId = Number(decoded.id);
    } catch {
      return res.status(401).json({ success: false, message: 'Недійсний токен для лінкування' });
    }
  }

  const state = makeState({ link: !!linkUserId, userId: linkUserId, nonce: Math.random().toString(36).slice(2) });

  try {
    const url = buildAuthorizeUrl({ state, req });
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/callback', async (req, res, next) => {
  const { code, state, error: oauthError, error_description: oauthDescription } = req.query;

  const fail = (msg) => {
    const url = new URL(resolveFrontendBaseUrl(req));
    url.pathname = '/auth/callback';
    url.searchParams.set('error', msg);
    url.searchParams.set('provider', 'github');
    return res.redirect(url.toString());
  };

  if (oauthError) {
    return fail(oauthDescription || oauthError);
  }
  if (!code) return fail('Відсутній code від GitHub');
  if (!isGitHubConfigured()) return fail('GitHub OAuth не налаштовано');

  const parsedState = state ? readState(state) : null;

  try {
    const { accessToken } = await exchangeCodeForToken(code, req);
    const ghUser = await fetchAuthenticatedUser(accessToken);
    const emails = await fetchUserEmails(accessToken);
    const primaryEmail = pickPrimaryEmail(emails);
    const profile = pickPublicProfile(ghUser);

    let user;
    if (parsedState?.link && parsedState?.userId) {
      // Лінкування до існуючого акаунта
      const owned = await User.findByGithubId(ghUser.id);
      if (owned && owned.id !== parsedState.userId) {
        return fail('Цей GitHub-акаунт вже прив’язаний до іншого користувача');
      }
      user = await User.linkGithub(parsedState.userId, { ghUser, accessToken, profile });
    } else {
      user = await User.loginOrRegisterFromGithub({
        ghUser,
        primaryEmail,
        accessToken,
        profile,
      });
    }

    const token = issueAppToken(user);

    // Видаляємо чутливі поля
    if (user.github_access_token) delete user.github_access_token;
    if (user.password) delete user.password;

    const url = new URL(resolveFrontendBaseUrl(req));
    url.pathname = '/auth/callback';
    url.searchParams.set('token', token);
    url.searchParams.set('user', JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      reputation: user.reputation,
      avatar_url: user.avatar_url,
      github_login: user.github_login,
    }));

    return res.redirect(url.toString());
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    if (err.code === 'ER_DUP_ENTRY' && String(err.message || '').includes('users.email')) {
      return fail(
        'Акаунт з цим email уже існує. Увійдіть паролем або прив’яжіть GitHub у профілі після входу.'
      );
    }
    if (err.code === 'GITHUB_EMAIL_CONFLICT') {
      return fail(err.message);
    }
    return fail(err.message || 'GitHub OAuth callback failed');
  }
});

router.post('/unlink', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.unlinkGithub(req.user.id);
    res.json({ success: true, message: 'GitHub відв’язано', data: { user } });
  } catch (e) { next(e); }
});

export default router;
