/**
 * Routes для відповідей
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import { Answer } from '../models/Answer.js';
import { Question } from '../models/Question.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Notification from '../models/Notification.js';

const router = express.Router();

/**
 * GET /api/answers
 * Список відповідей для питання або користувача
 */
router.get(
  '/',
  [
    query('questionId').optional().isInt().withMessage('ID питання має бути числом'),
    query('authorId').optional().isInt().withMessage('ID автора має бути числом'),
    query('sortBy').optional().isIn(['votes', 'created_at']).withMessage('Невірний параметр сортування'),
    query('limit').optional().isInt().withMessage('Limit має бути числом')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { questionId, authorId, sortBy, limit } = req.query;

      let answers;
      if (authorId) {
        // Отримати відповіді користувача
        answers = await Answer.listByAuthor(parseInt(authorId), { sortBy, limit });
      } else if (questionId) {
        // Отримати відповіді для питання
        answers = await Answer.listByQuestion(parseInt(questionId), { sortBy });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Вкажіть questionId або authorId'
        });
      }

      res.json({
        success: true,
        data: { answers }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/answers
 * Створення відповіді
 */
router.post(
  '/',
  authenticateToken,
  [
    body('body')
      .trim()
      .isLength({ min: 30 })
      .withMessage('Відповідь має бути мінімум 30 символів'),
    body('questionId')
      .isInt()
      .withMessage('ID питання має бути числом')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { body, questionId } = req.body;

      // Перевірка існування питання
      const question = await Question.findById(questionId);
      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Питання не знайдено'
        });
      }

      const answer = await Answer.create({
        body,
        questionId,
        authorId: req.user.id
      });

      // Створити сповіщення для автора питання
      await Notification.notifyQuestionAnswer(questionId, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Відповідь створено',
        data: { answer }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/answers/:id
 * Оновлення відповіді
 */
router.put(
  '/:id',
  authenticateToken,
  [
    param('id').isInt().withMessage('ID має бути числом'),
    body('body')
      .trim()
      .isLength({ min: 30 })
      .withMessage('Відповідь має бути мінімум 30 символів')
  ],
  validate,
  async (req, res, next) => {
    try {
      const answerId = parseInt(req.params.id);

      // Перевірка існування та прав
      const existing = await Answer.findById(answerId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Відповідь не знайдено'
        });
      }

      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Ви не можете редагувати цю відповідь'
        });
      }

      const answer = await Answer.update(answerId, req.body);

      res.json({
        success: true,
        message: 'Відповідь оновлено',
        data: { answer }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/answers/:id
 * Видалення відповіді
 */
router.delete(
  '/:id',
  authenticateToken,
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const answerId = parseInt(req.params.id);

      // Перевірка існування та прав
      const existing = await Answer.findById(answerId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Відповідь не знайдено'
        });
      }

      if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Ви не можете видалити цю відповідь'
        });
      }

      await Answer.delete(answerId);

      res.json({
        success: true,
        message: 'Відповідь видалено'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/answers/:id/accept
 * Позначення відповіді як прийнятої
 */
router.post(
  '/:id/accept',
  authenticateToken,
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const answerId = parseInt(req.params.id);

      // Перевірка існування відповіді
      const answer = await Answer.findById(answerId);
      if (!answer) {
        return res.status(404).json({
          success: false,
          message: 'Відповідь не знайдено'
        });
      }

      // Перевірка, що користувач - автор питання
      const question = await Question.findById(answer.question_id);
      if (question.author_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Тільки автор питання може прийняти відповідь'
        });
      }

      const updatedAnswer = await Answer.markAsAccepted(answerId, answer.question_id);

      // Створити сповіщення для автора відповіді
      await Notification.notifyAnswerAccepted(answerId);

      res.json({
        success: true,
        message: 'Відповідь прийнято',
        data: { answer: updatedAnswer }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
