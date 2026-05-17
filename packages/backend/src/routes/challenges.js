/**
 * Routes /api/challenges — тижневі челенджі та рейтинг.
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import Challenge from '../models/Challenge.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { logActivity } from '../services/activityService.js';

const router = express.Router();

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('status').optional().isIn(['active', 'closed', 'draft']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await Challenge.list({
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        status: req.query.status || null,
      });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.get('/current', async (req, res, next) => {
  try {
    const challenges = await Challenge.getCurrent();
    const weekBounds = Challenge.getWeekBounds();
    const leaderboard = await Challenge.getWeeklyLeaderboard({ limit: 15 });
    res.json({
      success: true,
      data: { challenges, weekBounds, leaderboard },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/leaderboard/weekly', async (req, res, next) => {
  try {
    const leaderboard = await Challenge.getWeeklyLeaderboard({
      limit: parseInt(req.query.limit, 10) || 20,
    });
    res.json({ success: true, data: { leaderboard } });
  } catch (e) {
    next(e);
  }
});

router.get(
  '/:slug',
  optionalAuth,
  [param('slug').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const challenge = await Challenge.findBySlug(req.params.slug);
      if (!challenge) {
        return res.status(404).json({ success: false, message: 'Челендж не знайдено' });
      }

      const leaderboard = await Challenge.getLeaderboard(challenge.id, { limit: 30 });
      let mySubmission = null;
      if (req.user?.id) {
        mySubmission = await Challenge.getUserSubmission(challenge.id, req.user.id);
      }

      res.json({
        success: true,
        data: { challenge, leaderboard, mySubmission },
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/:id/leaderboard',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const challengeId = parseInt(req.params.id, 10);
      const leaderboard = await Challenge.getLeaderboard(challengeId, {
        limit: parseInt(req.query.limit, 10) || 30,
      });
      res.json({ success: true, data: { leaderboard } });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id/submit',
  authenticateToken,
  [
    param('id').isInt(),
    body('solutionUrl').optional({ values: 'falsy' }).isURL().withMessage('Невалідне посилання'),
    body('solutionText').trim().isLength({ min: 10, max: 8000 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const challengeId = parseInt(req.params.id, 10);
      const result = await Challenge.submit({
        challengeId,
        userId: req.user.id,
        solutionUrl: req.body.solutionUrl || null,
        solutionText: req.body.solutionText,
        score: req.body.score ?? null,
      });

      if (result?.error === 'not_found') {
        return res.status(404).json({ success: false, message: 'Челендж не знайдено' });
      }
      if (result?.error === 'closed') {
        return res.status(410).json({ success: false, message: 'Челендж завершено' });
      }

      const challenge = await Challenge.findById(challengeId);
      await logActivity({
        actorId: req.user.id,
        verb: 'challenge_submit',
        entityType: 'challenge',
        entityId: challengeId,
        title: challenge?.title,
        meta: { score: result.score },
      });

      if (typeof global.broadcast === 'function') {
        global.broadcast('challenges', {
          type: 'submission',
          challengeId,
          submission: result,
        });
      }

      res.status(201).json({ success: true, data: { submission: result } });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
