/**
 * Routes для користувачів
 */

import express from 'express';
import { param } from 'express-validator';
import { User } from '../models/User.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

/**
 * GET /api/users
 * Список користувачів
 */
router.get(
  '/',
  async (req, res, next) => {
    try {
      const { page, limit, sortBy } = req.query;

      const result = await User.list({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        sortBy
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/:id
 * Отримання користувача за ID
 */
router.get(
  '/:id',
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Користувача не знайдено'
        });
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/users/:id/block
 * Блокування користувача (тільки для адмінів)
 */
router.post(
  '/:id/block',
  authenticateToken,
  requireRole('admin'),
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);

      // Не можна блокувати самого себе
      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Ви не можете заблокувати самого себе'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Користувача не знайдено'
        });
      }

      const blockedUser = await User.block(userId);

      res.json({
        success: true,
        message: `Користувача ${user.username} заблоковано`,
        data: { user: blockedUser }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/users/:id/unblock
 * Розблокування користувача (тільки для адмінів)
 */
router.post(
  '/:id/unblock',
  authenticateToken,
  requireRole('admin'),
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Користувача не знайдено'
        });
      }

      const unblockedUser = await User.unblock(userId);

      res.json({
        success: true,
        message: `Користувача ${user.username} розблоковано`,
        data: { user: unblockedUser }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
