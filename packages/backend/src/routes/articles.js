/**
 * Routes для статей knowledge hub.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import Article from '../models/Article.js';
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
      const result = await Article.list({
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
    const tags = await Article.getTags();
    res.json({
      success: true,
      data: { tags },
    });
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
      const articleId = parseInt(req.params.id, 10);
      const result = await Article.recordView(articleId, req.viewerKey);

      if (!result) {
        return res.status(404).json({ success: false, message: 'Статтю не знайдено' });
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
      const articleId = parseInt(req.params.id, 10);
      let article = await Article.findById(articleId);

      if (!article) {
        return res.status(404).json({ success: false, message: 'Статтю не знайдено' });
      }

      const wantRecord = String(req.headers['x-record-view'] || '').trim() === '1';
      if (wantRecord && req.viewerKey) {
        await Article.recordView(articleId, req.viewerKey);
        article = await Article.findById(articleId);
      }

      res.json({ success: true, data: { article } });
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
    body('body').trim().isLength({ min: 80 }).withMessage('Тіло статті має бути мінімум 80 символів'),
    body('excerpt').optional().trim().isLength({ max: 280 }).withMessage('Опис має бути до 280 символів'),
    body('tags').isArray({ min: 1, max: 8 }).withMessage('Має бути від 1 до 8 тегів'),
    body('tags.*').trim().isLength({ min: 1, max: 30 }).withMessage('Кожен тег має бути від 1 до 30 символів'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, body: articleBody, excerpt, tags } = req.body;
      const article = await Article.create({
        title,
        body: articleBody,
        excerpt,
        tags,
        authorId: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: 'Статтю створено',
        data: { article },
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
    body('title').optional().trim().isLength({ min: 10, max: 255 }).withMessage('Заголовок має бути від 10 до 255 символів'),
    body('body').optional().trim().isLength({ min: 80 }).withMessage('Тіло статті має бути мінімум 80 символів'),
    body('excerpt').optional().trim().isLength({ max: 280 }).withMessage('Опис має бути до 280 символів'),
    body('tags').optional().isArray({ min: 1, max: 8 }).withMessage('Має бути від 1 до 8 тегів'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const articleId = parseInt(req.params.id, 10);
      const existing = await Article.findById(articleId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Статтю не знайдено' });
      }

      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Ви не можете редагувати цю статтю' });
      }

      const article = await Article.update(articleId, req.body);
      res.json({ success: true, message: 'Статтю оновлено', data: { article } });
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
      const articleId = parseInt(req.params.id, 10);
      const existing = await Article.findById(articleId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Статтю не знайдено' });
      }

      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Ви не можете видалити цю статтю' });
      }

      await Article.delete(articleId);
      res.json({ success: true, message: 'Статтю видалено' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
