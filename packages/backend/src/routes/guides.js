/**
 * Routes для guides knowledge hub.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import Guide from '../models/Guide.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { attachViewerKeyOptional, resolveViewerKey } from '../middleware/viewerKey.js';
import { validate } from '../middleware/validation.js';
import { enrichWithVotes } from '../utils/enrichVotes.js';

const router = express.Router();

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Сторінка має бути числом >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Ліміт має бути від 1 до 100'),
    query('sortBy').optional().isIn(['created_at', 'views', 'votes']).withMessage('Невірний параметр сортування'),
    query('tag').optional().trim(),
    query('authorId').optional().isInt().withMessage('ID автора має бути числом'),
    query('search').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { page, limit, sortBy, tag, authorId, search } = req.query;
      const result = await Guide.list({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        sortBy,
        tag,
        authorId: authorId ? parseInt(authorId, 10) : null,
        search,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/tags/all', async (req, res, next) => {
  try {
    const tags = await Guide.getTags();
    res.json({ success: true, data: { tags } });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/view',
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  resolveViewerKey,
  async (req, res, next) => {
    try {
      const guideId = parseInt(req.params.id, 10);
      const result = await Guide.recordView(guideId, req.viewerKey);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Гайд не знайдено' });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  optionalAuth,
  attachViewerKeyOptional,
  async (req, res, next) => {
    try {
      const guideId = parseInt(req.params.id, 10);
      let guide = await Guide.findById(guideId);

      if (!guide) {
        return res.status(404).json({ success: false, message: 'Гайд не знайдено' });
      }

      const wantRecord = String(req.headers['x-record-view'] || '').trim() === '1';
      if (wantRecord && req.viewerKey) {
        await Guide.recordView(guideId, req.viewerKey);
        guide = await Guide.findById(guideId);
      }

      await enrichWithVotes(guide, 'guide', req.user?.id);
      res.json({ success: true, data: { guide } });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  authenticateToken,
  [
    body('title').trim().isLength({ min: 10, max: 255 }).withMessage('Заголовок має бути від 10 до 255 символів'),
    body('summary').trim().isLength({ min: 20, max: 280 }).withMessage('Опис має бути від 20 до 280 символів'),
    body('body').trim().isLength({ min: 80 }).withMessage('Тіло гайду має бути мінімум 80 символів'),
    body('difficulty').trim().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Складність має бути beginner, intermediate або advanced'),
    body('estimatedMinutes').isInt({ min: 1, max: 600 }).withMessage('Орієнтовний час має бути від 1 до 600 хвилин'),
    body('tags').isArray({ min: 1, max: 8 }).withMessage('Має бути від 1 до 8 тегів'),
    body('tags.*').trim().isLength({ min: 1, max: 30 }).withMessage('Кожен тег має бути від 1 до 30 символів'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, summary, body: guideBody, difficulty, estimatedMinutes, tags } = req.body;
      const guide = await Guide.create({
        title,
        summary,
        body: guideBody,
        difficulty,
        estimatedMinutes,
        tags,
        authorId: req.user.id,
      });

      res.status(201).json({ success: true, message: 'Гайд створено', data: { guide } });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  [
    param('id').isInt().withMessage('ID має бути числом'),
    body('title').optional().trim().isLength({ min: 10, max: 255 }).withMessage('Заголовок має бути від 10 до 255 символів'),
    body('summary').optional().trim().isLength({ min: 20, max: 280 }).withMessage('Опис має бути від 20 до 280 символів'),
    body('body').optional().trim().isLength({ min: 80 }).withMessage('Тіло гайду має бути мінімум 80 символів'),
    body('difficulty').optional().trim().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Складність має бути beginner, intermediate або advanced'),
    body('estimatedMinutes').optional().isInt({ min: 1, max: 600 }).withMessage('Орієнтовний час має бути від 1 до 600 хвилин'),
    body('tags').optional().isArray({ min: 1, max: 8 }).withMessage('Має бути від 1 до 8 тегів'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const guideId = parseInt(req.params.id, 10);
      const existing = await Guide.findById(guideId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Гайд не знайдено' });
      }
      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Ви не можете редагувати цей гайд' });
      }

      const guide = await Guide.update(guideId, req.body);
      res.json({ success: true, message: 'Гайд оновлено', data: { guide } });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  authenticateToken,
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const guideId = parseInt(req.params.id, 10);
      const existing = await Guide.findById(guideId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Гайд не знайдено' });
      }
      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Ви не можете видалити цей гайд' });
      }

      await Guide.delete(guideId);
      res.json({ success: true, message: 'Гайд видалено' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
