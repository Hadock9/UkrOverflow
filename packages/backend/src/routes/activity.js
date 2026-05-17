/**
 * Routes /api/activity — жива стрічка активності та присутність.
 */

import express from 'express';
import { body, query } from 'express-validator';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  getLiveFeed,
  getRecentEvents,
  setPresence,
  logActivity,
} from '../services/activityService.js';

const router = express.Router();

const PRESENCE_STATUSES = ['asking', 'answering', 'learning', 'in_room'];

router.get(
  '/live',
  optionalAuth,
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  async (req, res, next) => {
    try {
      const feed = await getLiveFeed({ limit: req.query.limit });
      res.json({ success: true, data: feed });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/',
  [query('limit').optional().isInt({ min: 1, max: 100 }), query('verb').optional().trim()],
  validate,
  async (req, res, next) => {
    try {
      const events = await getRecentEvents({
        limit: req.query.limit,
        verb: req.query.verb || null,
      });
      res.json({ success: true, data: { events } });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/presence',
  authenticateToken,
  [
    body('status').isIn(PRESENCE_STATUSES).withMessage('Невалідний статус'),
    body('context').optional().isObject(),
    body('entityType').optional().trim(),
    body('entityId').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { status, context, entityType, entityId } = req.body;
      const presence = await setPresence(req.user.id, {
        status,
        context: context || {},
        entityType: entityType || null,
        entityId: entityId || null,
      });
      res.json({ success: true, data: { presence } });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/heartbeat',
  authenticateToken,
  [
    body('status').optional().isIn(PRESENCE_STATUSES),
    body('context').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const status = req.body.status || 'learning';
      const presence = await setPresence(req.user.id, {
        status,
        context: req.body.context || {},
      });
      res.json({ success: true, data: { presence } });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
