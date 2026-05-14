/**
 * Routes для голосування
 */

import express from 'express';
import { body } from 'express-validator';
import { Vote } from '../models/Vote.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

/**
 * POST /api/votes
 * Голосування
 */
router.post(
  '/',
  authenticateToken,
  [
    body('entityType')
      .isIn(['question', 'answer'])
      .withMessage('Тип сутності має бути question або answer'),
    body('entityId')
      .isInt()
      .withMessage('ID сутності має бути числом'),
    body('voteType')
      .isIn(['up', 'down'])
      .withMessage('Тип голосу має бути up або down')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { entityType, entityId, voteType } = req.body;

      const votes = await Vote.vote({
        userId: req.user.id,
        entityType,
        entityId,
        voteType
      });

      res.json({
        success: true,
        message: 'Голос зараховано',
        data: { votes }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/votes/:entityType/:entityId
 * Отримання голосів для сутності
 */
router.get('/:entityType/:entityId', async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;

    if (!['question', 'answer'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний тип сутності'
      });
    }

    const votes = await Vote.getVotes(entityType, parseInt(entityId));

    res.json({
      success: true,
      data: { votes }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
