/**
 * Routes для питань
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import { Question } from '../models/Question.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

/**
 * GET /api/questions
 * Список питань
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Сторінка має бути числом >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Ліміт має бути від 1 до 100'),
    query('sortBy').optional().isIn(['created_at', 'views', 'votes']).withMessage('Невірний параметр сортування'),
    query('tag').optional().trim(),
    query('authorId').optional().isInt().withMessage('ID автора має бути числом'),
    query('search').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { page, limit, sortBy, tag, authorId, search } = req.query;

      const result = await Question.list({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        sortBy,
        tag,
        authorId: authorId ? parseInt(authorId) : null,
        search
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
 * GET /api/questions/:id
 * Отримання питання за ID
 */
router.get(
  '/:id',
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  optionalAuth,
  async (req, res, next) => {
    try {
      const question = await Question.findById(req.params.id, true);

      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Питання не знайдено'
        });
      }

      res.json({
        success: true,
        data: { question }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/questions
 * Створення питання
 */
router.post(
  '/',
  authenticateToken,
  [
    body('title')
      .trim()
      .isLength({ min: 10, max: 255 })
      .withMessage('Заголовок має бути від 10 до 255 символів'),
    body('body')
      .trim()
      .isLength({ min: 30 })
      .withMessage('Тіло питання має бути мінімум 30 символів'),
    body('tags')
      .isArray({ min: 1, max: 5 })
      .withMessage('Має бути від 1 до 5 тегів'),
    body('tags.*')
      .trim()
      .isLength({ min: 1, max: 30 })
      .withMessage('Кожен тег має бути від 1 до 30 символів')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, body, tags } = req.body;

      const question = await Question.create({
        title,
        body,
        tags,
        authorId: req.user.id
      });

      res.status(201).json({
        success: true,
        message: 'Питання створено',
        data: { question }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/questions/:id
 * Оновлення питання
 */
router.put(
  '/:id',
  authenticateToken,
  [
    param('id').isInt().withMessage('ID має бути числом'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 10, max: 255 })
      .withMessage('Заголовок має бути від 10 до 255 символів'),
    body('body')
      .optional()
      .trim()
      .isLength({ min: 30 })
      .withMessage('Тіло питання має бути мінімум 30 символів'),
    body('tags')
      .optional()
      .isArray({ min: 1, max: 5 })
      .withMessage('Має бути від 1 до 5 тегів')
  ],
  validate,
  async (req, res, next) => {
    try {
      const questionId = parseInt(req.params.id);

      // Перевірка існування та прав
      const existing = await Question.findById(questionId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Питання не знайдено'
        });
      }

      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Ви не можете редагувати це питання'
        });
      }

      const question = await Question.update(questionId, req.body);

      res.json({
        success: true,
        message: 'Питання оновлено',
        data: { question }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/questions/:id
 * Видалення питання
 */
router.delete(
  '/:id',
  authenticateToken,
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const questionId = parseInt(req.params.id);

      // Перевірка існування та прав
      const existing = await Question.findById(questionId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Питання не знайдено'
        });
      }

      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Ви не можете видалити це питання'
        });
      }

      await Question.delete(questionId);

      res.json({
        success: true,
        message: 'Питання видалено'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/questions/:id/answers
 * Отримання відповідей для питання
 */
router.get(
  '/:id/answers',
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const Answer = (await import('../models/Answer.js')).default;
      const answers = await Answer.listByQuestion(parseInt(req.params.id));

      res.json({
        success: true,
        data: answers
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/questions/tags/all
 * Список всіх тегів
 */
router.get('/tags/all', async (req, res, next) => {
  try {
    const tags = await Question.getTags();

    res.json({
      success: true,
      data: { tags }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
