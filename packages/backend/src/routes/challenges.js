/**
 * Routes /api/challenges — тижневі челенджі та рейтинг.
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import Challenge from '../models/Challenge.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { logActivity, setPresence } from '../services/activityService.js';
import Notification from '../models/Notification.js';
import aiService from '../services/aiService.js';
import { heuristicChallengeScore } from '../utils/challengeScoring.js';

const router = express.Router();

function isAiDisabled() {
  return process.env.AI_ENABLED === '0' || process.env.AI_ENABLED === 'false';
}

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

router.get('/history/weeks', async (req, res, next) => {
  try {
    const weeks = await Challenge.getRecentWeeks(parseInt(req.query.limit, 10) || 8);
    res.json({ success: true, data: { weeks } });
  } catch (e) {
    next(e);
  }
});

router.get('/current', optionalAuth, async (req, res, next) => {
  try {
    const challenges = await Challenge.getCurrent();
    const weekBounds = Challenge.getWeekBounds();
    const leaderboard = await Challenge.getWeeklyLeaderboard({ limit: 20 });
    const stats = await Challenge.getWeekStats(weekBounds.weekStart);

    let userProgress = null;
    if (req.user?.id) {
      userProgress = await Challenge.getUserWeekProgress(req.user.id, weekBounds.weekStart);
    }

    res.json({
      success: true,
      data: { challenges, weekBounds, leaderboard, stats, userProgress },
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
  '/:id/hint',
  authenticateToken,
  [param('id').isInt(), body('draftText').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const challengeId = parseInt(req.params.id, 10);
      const challenge = await Challenge.findById(challengeId);
      if (!challenge) {
        return res.status(404).json({ success: false, message: 'Челендж не знайдено' });
      }

      if (isAiDisabled()) {
        return res.json({
          success: true,
          data: {
            hint: 'Увімкніть AI (GEMINI_API_KEY) для персональних підказок. Поки що: розбийте задачу на кроки, додайте код і поясніть підхід.',
            checklist: ['Прочитайте умову', 'Напишіть чернетку рішення', 'Додайте посилання на репо'],
            pitfalls: [],
            aiDisabled: true,
          },
        });
      }

      const result = await aiService.getChallengeHint({
        challengeTitle: challenge.title,
        challengeDescription: challenge.description,
        challengeType: challenge.challengeType,
        draftText: req.body.draftText || '',
      });

      if (!result.success) {
        return res.status(503).json({
          success: false,
          message: 'Не вдалося отримати підказку',
          error: result.error,
        });
      }

      res.json({ success: true, data: result });
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
      const challenge = await Challenge.findById(challengeId);
      if (!challenge) {
        return res.status(404).json({ success: false, message: 'Челендж не знайдено' });
      }

      let score = null;
      let aiFeedback = null;
      let aiBreakdown = null;
      let scoredBy = 'heuristic';

      if (!isAiDisabled()) {
        const ai = await aiService.scoreChallengeSubmission({
          challengeTitle: challenge.title,
          challengeDescription: challenge.description,
          challengeType: challenge.challengeType,
          criteria: challenge.criteria,
          pointsMax: challenge.pointsMax,
          solutionText: req.body.solutionText,
          solutionUrl: req.body.solutionUrl || null,
        });
        if (ai.success && ai.score != null) {
          score = ai.score;
          aiFeedback = ai.feedback;
          aiBreakdown = ai.breakdown;
          scoredBy = 'gemini';
        }
      }

      if (score === null) {
        score = heuristicChallengeScore(
          req.body.solutionText,
          req.body.solutionUrl,
          challenge.pointsMax
        );
        if (!aiFeedback) {
          aiFeedback =
            'Оцінка евристична (Gemini тимчасово недоступний). Додайте код, пояснення та посилання на репо для вищого балу.';
        }
        if (scoredBy === 'heuristic' && !isAiDisabled()) {
          scoredBy = 'heuristic_fallback';
        }
      }

      const result = await Challenge.submit({
        challengeId,
        userId: req.user.id,
        solutionUrl: req.body.solutionUrl || null,
        solutionText: req.body.solutionText,
        score,
        aiFeedback,
        aiBreakdown,
      });

      if (result?.error === 'not_found') {
        return res.status(404).json({ success: false, message: 'Челендж не знайдено' });
      }
      if (result?.error === 'closed') {
        return res.status(410).json({ success: false, message: 'Челендж завершено' });
      }

      await logActivity({
        actorId: req.user.id,
        verb: 'challenge_submit',
        entityType: 'challenge',
        entityId: challengeId,
        title: challenge?.title,
        meta: { score: result.score },
      });
      await Notification.notifyChallengeSubmitted(req.user.id, challengeId, result.score);

      const progress = await Challenge.getUserWeekProgress(req.user.id);
      if (progress.completed === progress.total && progress.total > 0) {
        await Notification.notifyChallengeWeekComplete(
          req.user.id,
          progress.totalScore,
          progress.completed,
          progress.total
        );
      }

      await setPresence(req.user.id, {
        status: 'learning',
        context: { page: 'challenges', challengeTitle: challenge?.title },
        entityType: 'challenge',
        entityId: challengeId,
      });

      if (typeof global.broadcast === 'function') {
        global.broadcast('challenges', {
          type: 'submission',
          challengeId,
          submission: result,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          submission: result,
          scoring: {
            score: result.score,
            pointsMax: challenge.pointsMax,
            feedback: result.aiFeedback || aiFeedback,
            breakdown: result.aiBreakdown || aiBreakdown,
            scoredBy,
          },
          userProgress: progress,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
