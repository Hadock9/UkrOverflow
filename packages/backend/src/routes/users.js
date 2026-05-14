/**
 * Routes для користувачів
 */

import express from 'express';
import { param, query } from 'express-validator';
import { User } from '../models/User.js';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

function csvToArray(csv) {
  if (!csv) return [];
  if (Array.isArray(csv)) return csv.map((s) => String(s).trim()).filter(Boolean);
  return String(csv).split(',').map((s) => s.trim()).filter(Boolean);
}

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
 * GET /api/users/search
 * Пошук розробників за стеком/локацією/текстом
 */
router.get(
  '/search',
  [
    query('stack').optional(),
    query('location').optional().trim(),
    query('q').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const stack = csvToArray(req.query.stack);
      const location = req.query.location || null;
      const q = req.query.q || null;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const offset = (page - 1) * limit;

      let where = 'WHERE 1=1';
      const params = [];

      if (stack.length > 0) {
        const ors = stack.map(() => 'JSON_CONTAINS(LOWER(u.github_stack), LOWER(?))');
        where += ` AND (${ors.join(' OR ')})`;
        stack.forEach((s) => params.push(JSON.stringify(String(s))));
      }
      if (location) {
        where += ' AND u.location LIKE ?';
        params.push(`%${location}%`);
      }
      if (q) {
        where += ' AND (u.username LIKE ? OR u.bio LIKE ? OR u.github_login LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      const sql = `SELECT u.id, u.username, u.avatar_url, u.github_login, u.github_stack,
                          u.bio, u.location, u.reputation
                   FROM users u
                   ${where}
                   ORDER BY u.reputation DESC, u.id DESC
                   LIMIT ${limit} OFFSET ${offset}`;

      const [rows] = params.length ? await pool.execute(sql, params) : await pool.query(sql);

      const enriched = rows.map((r) => {
        let stackArr = [];
        try {
          const raw = typeof r.github_stack === 'string' ? JSON.parse(r.github_stack) : r.github_stack;
          if (Array.isArray(raw)) stackArr = raw;
          else if (raw && typeof raw === 'object') {
            stackArr = Object.entries(raw)
              .sort((a, b) => (b[1] || 0) - (a[1] || 0))
              .map(([k]) => k);
          }
        } catch { /* ignore */ }
        return { ...r, github_stack_top: stackArr.slice(0, 3), github_stack: stackArr };
      });

      const countSql = `SELECT COUNT(*) as total FROM users u ${where}`;
      const [[{ total }]] = params.length ? await pool.execute(countSql, params) : await pool.query(countSql);

      res.json({
        success: true,
        data: {
          users: enriched,
          pagination: {
            page, limit, total,
            totalPages: Math.ceil(total / limit),
          },
        },
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
