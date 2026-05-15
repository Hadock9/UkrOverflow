/**
 * Routes для roadmaps knowledge hub.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import Roadmap from '../models/Roadmap.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { attachViewerKeyOptional, resolveViewerKey } from '../middleware/viewerKey.js';
import { validate } from '../middleware/validation.js';
import { enrichWithVotes } from '../utils/enrichVotes.js';

const router = express.Router();

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['created_at', 'views', 'votes']),
    query('tag').optional().trim(),
    query('authorId').optional().isInt(),
    query('search').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { page, limit, sortBy, tag, authorId, search } = req.query;
      const result = await Roadmap.list({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        sortBy,
        tag,
        authorId: authorId ? parseInt(authorId, 10) : null,
        search,
      });
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }
);

router.get('/tags/all', async (req, res, next) => {
  try {
    const tags = await Roadmap.getTags();
    res.json({ success: true, data: { tags } });
  } catch (e) { next(e); }
});

router.post(
  '/:id/view',
  [param('id').isInt()],
  validate,
  resolveViewerKey,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const r = await Roadmap.recordView(id, req.viewerKey);
      if (!r) return res.status(404).json({ success: false, message: 'Roadmap не знайдено' });
      res.json({ success: true, data: r });
    } catch (e) { next(e); }
  }
);

router.get(
  '/:id',
  [param('id').isInt()],
  validate,
  optionalAuth,
  attachViewerKeyOptional,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      let roadmap = await Roadmap.findById(id);
      if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap не знайдено' });

      if (String(req.headers['x-record-view'] || '').trim() === '1' && req.viewerKey) {
        await Roadmap.recordView(id, req.viewerKey);
        roadmap = await Roadmap.findById(id);
      }
      await enrichWithVotes(roadmap, 'roadmap', req.user?.id);
      res.json({ success: true, data: { roadmap } });
    } catch (e) { next(e); }
  }
);

router.post(
  '/',
  authenticateToken,
  [
    body('title').trim().isLength({ min: 10, max: 255 }),
    body('summary').trim().isLength({ min: 20, max: 280 }),
    body('body').trim().isLength({ min: 80 }),
    body('steps').isArray({ min: 2, max: 50 }),
    body('difficulty').isIn(['beginner', 'intermediate', 'advanced']),
    body('estimatedWeeks').isInt({ min: 1, max: 156 }),
    body('tags').isArray({ min: 1, max: 8 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, summary, body: rb, steps, difficulty, estimatedWeeks, tags } = req.body;
      const roadmap = await Roadmap.create({
        title, summary, body: rb, steps, difficulty, estimatedWeeks, tags, authorId: req.user.id,
      });
      res.status(201).json({ success: true, message: 'Roadmap створено', data: { roadmap } });
    } catch (e) { next(e); }
  }
);

router.put(
  '/:id',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await Roadmap.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Roadmap не знайдено' });
      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Немає прав' });
      }
      const roadmap = await Roadmap.update(id, req.body);
      res.json({ success: true, data: { roadmap } });
    } catch (e) { next(e); }
  }
);

router.delete(
  '/:id',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await Roadmap.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Roadmap не знайдено' });
      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Немає прав' });
      }
      await Roadmap.delete(id);
      res.json({ success: true, message: 'Roadmap видалено' });
    } catch (e) { next(e); }
  }
);

export default router;
