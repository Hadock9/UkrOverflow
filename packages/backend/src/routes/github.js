/**
 * GitHub data routes.
 *
 *   POST /api/github/sync                                — синхронізувати власні repos/stack/contributions (auth)
 *   GET  /api/github/me/repos                            — список власних кешованих repos (auth)
 *   POST /api/github/me/pin                              — встановити pinned (масив id) (auth)
 *   GET  /api/github/users/:userId/profile               — публічний GitHub-профіль
 *   GET  /api/github/users/:userId/repos                 — публічні repos користувача
 *
 *   POST /api/github/links                               — прив'язати repo до контенту (auth)
 *   DELETE /api/github/links/:id                         — відв'язати (auth, тільки автор лінку або admin)
 *   GET  /api/github/links/:targetType/:targetId         — список linked repos
 */

import express from 'express';
import { body, param, query as qv } from 'express-validator';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { User } from '../models/User.js';
import { UserRepository } from '../models/UserRepository.js';
import { ContentLinkedRepo } from '../models/ContentLinkedRepo.js';
import {
  fetchAuthenticatedUser,
  fetchUserRepos,
  fetchContributionCalendar,
  fetchPublicRepoMetadata,
  computeStack,
  computeBadges,
  fetchPublicEventStats,
  pickPublicProfile,
} from '../services/githubService.js';

const router = express.Router();

router.post('/sync', authenticateToken, async (req, res, next) => {
  try {
    const token = await User.getGithubAccessToken(req.user.id);
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub не підключено для цього акаунта. Спершу пройдіть OAuth.',
      });
    }

    const [ghUser, repos] = await Promise.all([
      fetchAuthenticatedUser(token),
      fetchUserRepos(token, { perPage: 100, maxPages: 3 }),
    ]);

    const stack = computeStack(repos);
    const profile = pickPublicProfile(ghUser);

    // Contributions (GraphQL) — best-effort, не валимо весь sync при помилці
    let contributions = null;
    try {
      contributions = await fetchContributionCalendar(token);
    } catch (e) {
      console.warn('[github/sync] contributions skipped:', e.message);
    }

    // Activity (best-effort)
    let activity = null;
    try {
      activity = await fetchPublicEventStats(ghUser.login);
    } catch (e) {
      activity = null;
    }

    const badges = computeBadges({ stack, activity, contributions });

    await UserRepository.upsertMany(req.user.id, repos);
    await UserRepository.removeMissing(req.user.id, repos.map((r) => r.id));
    const updated = await User.updateGithubSync(req.user.id, {
      profile,
      stack,
      contributions,
      badges,
    });

    const ownedRepos = await UserRepository.listByUser(req.user.id, { limit: 50 });

    res.json({
      success: true,
      message: 'GitHub-дані синхронізовано',
      data: {
        user: updated,
        stack,
        contributions,
        badges,
        activity,
        repos: ownedRepos,
        synced: repos.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me/repos', authenticateToken, async (req, res, next) => {
  try {
    const onlyPinned = String(req.query.pinned || '') === '1';
    const repos = await UserRepository.listByUser(req.user.id, {
      onlyPinned,
      limit: parseInt(req.query.limit, 10) || 50,
    });
    res.json({ success: true, data: { repos } });
  } catch (err) { next(err); }
});

router.post(
  '/me/pin',
  authenticateToken,
  [body('repoIds').isArray({ max: 6 }).withMessage('repoIds має бути масивом до 6 ID')],
  validate,
  async (req, res, next) => {
    try {
      const ids = (req.body.repoIds || []).map((x) => Number(x)).filter(Number.isFinite);
      const pinned = await UserRepository.setPinned(req.user.id, ids);
      const repos = await UserRepository.listByUser(req.user.id, { limit: 50 });
      res.json({ success: true, data: { pinnedIds: pinned, repos } });
    } catch (err) { next(err); }
  }
);

router.get(
  '/users/:userId/profile',
  [param('userId').isInt().withMessage('userId має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'Користувача не знайдено' });
      if (!user.github_connected) {
        return res.json({ success: true, data: { connected: false } });
      }

      const repos = await UserRepository.listByUser(userId, { onlyPinned: false, limit: 50 });

      // Спроба підтягнути актуальні events (best-effort)
      let activity = null;
      try {
        activity = await fetchPublicEventStats(user.github_login);
      } catch {
        activity = null;
      }

      const pinned = repos.filter((r) => r.is_pinned);

      res.json({
        success: true,
        data: {
          connected: true,
          profile: user.github_profile,
          stack: user.github_stack,
          contributions: user.github_contributions,
          badges: user.github_badges || [],
          synced_at: user.github_synced_at,
          repos,
          pinned,
          activity,
        },
      });
    } catch (err) { next(err); }
  }
);

router.get(
  '/users/:userId/repos',
  [param('userId').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const onlyPinned = String(req.query.pinned || '') === '1';
      const repos = await UserRepository.listByUser(userId, { onlyPinned, limit: 50 });
      res.json({ success: true, data: { repos } });
    } catch (err) { next(err); }
  }
);

// === Linked repos на контенті ===

router.get(
  '/links/:targetType/:targetId',
  [
    param('targetType').isIn(['question', 'article', 'guide', 'snippet', 'roadmap', 'best_practice', 'faq', 'content']),
    param('targetId').isInt(),
    qv('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const repos = await ContentLinkedRepo.listByTarget(
        req.params.targetType,
        parseInt(req.params.targetId, 10),
        { limit: parseInt(req.query.limit, 10) || 25 }
      );
      res.json({ success: true, data: { repos } });
    } catch (err) { next(err); }
  }
);

router.post(
  '/links',
  authenticateToken,
  [
    body('targetType').isIn(['question', 'article', 'guide', 'snippet', 'roadmap', 'best_practice', 'faq', 'content']),
    body('targetId').isInt({ min: 1 }),
    body('repo').isString().trim().isLength({ min: 3, max: 200 }).withMessage('repo у форматі owner/name'),
    body('note').optional().isString().isLength({ max: 280 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { targetType, targetId, repo, note } = req.body;
      const fullName = repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
      if (!fullName.includes('/')) {
        return res.status(400).json({ success: false, message: 'Очікую формат owner/name або повний GitHub URL' });
      }

      const userToken = await User.getGithubAccessToken(req.user.id);
      const ghRepo = await fetchPublicRepoMetadata(fullName, userToken);

      try {
        const created = await ContentLinkedRepo.create({
          targetType,
          targetId,
          ghRepo,
          addedByUserId: req.user.id,
          note,
        });
        return res.status(201).json({ success: true, message: 'Repo прив’язано', data: { repo: created } });
      } catch (e) {
        if (e?.code === 'DUP_LINK') {
          return res.status(409).json({ success: false, message: e.message, data: { repo: e.existing } });
        }
        throw e;
      }
    } catch (err) {
      const status = String(err.message || '').includes('GitHub API 404') ? 404 : 500;
      if (status === 404) {
        return res.status(404).json({ success: false, message: 'Репозиторій GitHub не знайдено або приватний' });
      }
      next(err);
    }
  }
);

router.delete(
  '/links/:id',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      try {
        const removed = await ContentLinkedRepo.delete(id, {
          userId: req.user.id,
          isAdmin: req.user.role === 'admin',
        });
        if (!removed) return res.status(404).json({ success: false, message: 'Лінк не знайдено' });
        return res.json({ success: true, message: 'Лінк видалено' });
      } catch (e) {
        if (e?.code === 'FORBIDDEN') {
          return res.status(403).json({ success: false, message: e.message });
        }
        throw e;
      }
    } catch (err) { next(err); }
  }
);

export default router;
