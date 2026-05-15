/**
 * Routes для голосування
 */

import express from 'express';
import { body, param } from 'express-validator';
import { Vote } from '../models/Vote.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { VOTE_ENTITY_TYPES, isVoteEntityType } from '../constants/voteEntityTypes.js';

const router = express.Router();

/**
 * POST /api/votes
 * Голосування: { entityType, entityId, voteType: 'up' | 'down' }
 */
router.post(
  '/',
  authenticateToken,
  [
    body('entityType')
      .custom((v) => isVoteEntityType(v))
      .withMessage(`Тип сутності: ${VOTE_ENTITY_TYPES.join(', ')}`),
    body('entityId').isInt().withMessage('ID сутності має бути числом'),
    body('voteType').isIn(['up', 'down']).withMessage('Тип голосу має бути up або down'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { entityType, entityId, voteType } = req.body;

      const votes = await Vote.vote({
        userId: req.user.id,
        entityType,
        entityId: parseInt(entityId, 10),
        voteType,
      });

      const userVote = await Vote.getUserVote(req.user.id, entityType, parseInt(entityId, 10));

      res.json({
        success: true,
        message: 'Голос зараховано',
        data: { votes, userVote },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/votes/:entityType/:entityId
 * Лічильники + user_vote (якщо авторизовано)
 */
router.get(
  '/:entityType/:entityId',
  [
    param('entityType').custom((v) => isVoteEntityType(v)),
    param('entityId').isInt(),
  ],
  validate,
  optionalAuth,
  async (req, res, next) => {
    try {
      const { entityType } = req.params;
      const entityId = parseInt(req.params.entityId, 10);

      const votes = await Vote.getVotes(entityType, entityId);
      const userVote = req.user
        ? await Vote.getUserVote(req.user.id, entityType, entityId)
        : null;

      res.json({
        success: true,
        data: { votes, userVote },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
