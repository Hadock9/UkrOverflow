/**
 * Routes для FAQ knowledge hub.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import Faq from '../models/Faq.js';
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
      const result = await Faq.list({
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
    const tags = await Faq.getTags();
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
      const r = await Faq.recordView(id, req.viewerKey);
      if (!r) return res.status(404).json({ success: false, message: 'FAQ не знайдено' });
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
      let faq = await Faq.findById(id);
      if (!faq) return res.status(404).json({ success: false, message: 'FAQ не знайдено' });

      if (String(req.headers['x-record-view'] || '').trim() === '1' && req.viewerKey) {
        await Faq.recordView(id, req.viewerKey);
        faq = await Faq.findById(id);
      }
      await enrichWithVotes(faq, 'faq', req.user?.id);
      res.json({ success: true, data: { faq } });
    } catch (e) { next(e); }
  }
);

router.post(
  '/',
  authenticateToken,
  [
    body('title').trim().isLength({ min: 10, max: 255 }),
    body('topic').trim().isLength({ min: 2, max: 120 }),
    body('body').trim().isLength({ min: 80 }),
    body('qaPairs').isArray({ min: 1, max: 50 }),
    body('tags').isArray({ min: 1, max: 8 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, topic, body: rb, qaPairs, tags } = req.body;
      const faq = await Faq.create({ title, topic, body: rb, qaPairs, tags, authorId: req.user.id });
      res.status(201).json({ success: true, message: 'FAQ створено', data: { faq } });
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
      const existing = await Faq.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'FAQ не знайдено' });
      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Немає прав' });
      }
      const faq = await Faq.update(id, req.body);
      res.json({ success: true, data: { faq } });
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
      const existing = await Faq.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'FAQ не знайдено' });
      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Немає прав' });
      }
      await Faq.delete(id);
      res.json({ success: true, message: 'FAQ видалено' });
    } catch (e) { next(e); }
  }
);

export default router;
