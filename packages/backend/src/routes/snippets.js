/**
 * Routes для snippets knowledge hub.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import Snippet from '../models/Snippet.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { attachViewerKeyOptional, resolveViewerKey } from '../middleware/viewerKey.js';
import { validate } from '../middleware/validation.js';

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
      const result = await Snippet.list({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        sortBy,
        tag,
        authorId: authorId ? parseInt(authorId, 10) : null,
        search,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/tags/all', async (req, res, next) => {
  try {
    const tags = await Snippet.getTags();
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
      const snippetId = parseInt(req.params.id, 10);
      const result = await Snippet.recordView(snippetId, req.viewerKey);

      if (!result) {
        return res.status(404).json({ success: false, message: 'Snippet не знайдено' });
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
      const snippetId = parseInt(req.params.id, 10);
      let snippet = await Snippet.findById(snippetId);

      if (!snippet) {
        return res.status(404).json({ success: false, message: 'Snippet не знайдено' });
      }

      const wantRecord = String(req.headers['x-record-view'] || '').trim() === '1';
      if (wantRecord && req.viewerKey) {
        await Snippet.recordView(snippetId, req.viewerKey);
        snippet = await Snippet.findById(snippetId);
      }

      res.json({ success: true, data: { snippet } });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  authenticateToken,
  [
    body('title').trim().isLength({ min: 5, max: 255 }).withMessage('Заголовок має бути від 5 до 255 символів'),
    body('description').trim().isLength({ min: 20, max: 5000 }).withMessage('Опис snippet має бути від 20 до 5000 символів'),
    body('code').trim().isLength({ min: 3, max: 20000 }).withMessage('Код має бути від 3 до 20000 символів'),
    body('language').trim().isLength({ min: 2, max: 40 }).withMessage('Мова має бути від 2 до 40 символів'),
    body('tags').isArray({ min: 1, max: 8 }).withMessage('Має бути від 1 до 8 тегів'),
    body('tags.*').trim().isLength({ min: 1, max: 30 }).withMessage('Кожен тег має бути від 1 до 30 символів'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, description, code, language, tags } = req.body;
      const snippet = await Snippet.create({
        title,
        description,
        code,
        language,
        tags,
        authorId: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: 'Snippet створено',
        data: { snippet },
      });
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
    body('title').optional().trim().isLength({ min: 5, max: 255 }).withMessage('Заголовок має бути від 5 до 255 символів'),
    body('description').optional().trim().isLength({ min: 20, max: 5000 }).withMessage('Опис snippet має бути від 20 до 5000 символів'),
    body('code').optional().trim().isLength({ min: 3, max: 20000 }).withMessage('Код має бути від 3 до 20000 символів'),
    body('language').optional().trim().isLength({ min: 2, max: 40 }).withMessage('Мова має бути від 2 до 40 символів'),
    body('tags').optional().isArray({ min: 1, max: 8 }).withMessage('Має бути від 1 до 8 тегів'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const snippetId = parseInt(req.params.id, 10);
      const existing = await Snippet.findById(snippetId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Snippet не знайдено' });
      }

      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Ви не можете редагувати цей snippet' });
      }

      const snippet = await Snippet.update(snippetId, req.body);
      res.json({ success: true, message: 'Snippet оновлено', data: { snippet } });
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
      const snippetId = parseInt(req.params.id, 10);
      const existing = await Snippet.findById(snippetId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Snippet не знайдено' });
      }

      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Ви не можете видалити цей snippet' });
      }

      await Snippet.delete(snippetId);
      res.json({ success: true, message: 'Snippet видалено' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
