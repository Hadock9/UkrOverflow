/**
 * Google OAuth: вхід + лінкування до існуючого акаунта.
 *
 * GET  /api/auth/google          → редірект на Google (?link=1&as=<jwt>)
 * GET  /api/auth/google/callback → JWT → /auth/callback
 * POST /api/auth/google/unlink   → відв’язати Google
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  isGoogleConfigured,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGoogleUser,
  pickGoogleProfile,
  resolveGoogleCallbackUrlFromRequest,
} from '../services/googleService.js';
import { resolveFrontendBaseUrl } from '../utils/frontendOrigin.js';

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

router.get('/status', (req, res) => {
  let redirect_uri = null;
  let redirect_uri_error = null;
  try {
    redirect_uri = resolveGoogleCallbackUrlFromRequest(req);
  } catch (e) {
    redirect_uri_error = e?.message ?? String(e);
  }
  res.json({
    success: true,
    data: {
      enabled: isGoogleConfigured(),
      redirect_uri,
      ...(redirect_uri_error ? { redirect_uri_error } : {}),
      console_url: 'https://console.cloud.google.com/apis/credentials',
    },
  });
});

router.get('/', (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(503).json({
      success: false,
      message:
        'Google OAuth не налаштовано. Задайте GOOGLE_CLIENT_ID і GOOGLE_CLIENT_SECRET (див. .env.example).',
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

  const state = makeState({
    link: !!linkUserId,
    userId: linkUserId,
    nonce: Math.random().toString(36).slice(2),
  });

  try {
    res.redirect(buildAuthorizeUrl({ state, req }));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/callback', async (req, res) => {
  const { code, state, error: oauthError, error_description: oauthDescription } = req.query;

  const fail = (msg) => {
    const url = new URL(resolveFrontendBaseUrl(req));
    url.pathname = '/auth/callback';
    url.searchParams.set('error', msg);
    url.searchParams.set('provider', 'google');
    return res.redirect(url.toString());
  };

  if (oauthError) return fail(oauthDescription || oauthError);
  if (!code) return fail('Відсутній code від Google');
  if (!isGoogleConfigured()) return fail('Google OAuth не налаштовано');

  const parsedState = state ? readState(state) : null;

  try {
    const { accessToken } = await exchangeCodeForToken(code, req);
    const googleUser = await fetchGoogleUser(accessToken);
    if (!googleUser.email_verified) {
      return fail('Email Google не підтверджено. Увійдіть з підтвердженим акаунтом.');
    }
    const profile = pickGoogleProfile(googleUser);

    let user;
    if (parsedState?.link && parsedState?.userId) {
      const owned = await User.findByGoogleId(googleUser.sub);
      if (owned && owned.id !== parsedState.userId) {
        return fail('Цей Google-акаунт вже прив’язаний до іншого користувача');
      }
      user = await User.linkGoogle(parsedState.userId, { googleUser, profile });
    } else {
      user = await User.loginOrRegisterFromGoogle({ googleUser, profile });
    }

    const token = issueAppToken(user);
    if (user.password) delete user.password;

    const url = new URL(resolveFrontendBaseUrl(req));
    url.pathname = '/auth/callback';
    url.searchParams.set('token', token);
    url.searchParams.set('provider', 'google');
    url.searchParams.set(
      'user',
      JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        reputation: user.reputation,
        avatar_url: user.avatar_url,
        google_connected: !!user.google_id,
        github_login: user.github_login,
      })
    );

    return res.redirect(url.toString());
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    if (err.code === 'ER_DUP_ENTRY' && String(err.message || '').includes('users.email')) {
      return fail(
        'Акаунт з цим email уже існує. Увійдіть паролем або прив’яжіть Google у профілі після входу.'
      );
    }
    if (err.code === 'GOOGLE_EMAIL_CONFLICT') {
      return fail(err.message);
    }
    return fail(err.message || 'Google OAuth callback failed');
  }
});

router.post('/unlink', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.unlinkGoogle(req.user.id);
    res.json({ success: true, message: 'Google відв’язано', data: { user } });
  } catch (e) {
    next(e);
  }
});

export default router;
