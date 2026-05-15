/**
 * Routes для відповідей
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import { Answer, ACCEPTED_ANSWER_REPUTATION } from '../models/Answer.js';
import { Question } from '../models/Question.js';
import { User } from '../models/User.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { enrichManyWithVotes } from '../utils/enrichVotes.js';
import { validate } from '../middleware/validation.js';
import Notification from '../models/Notification.js';

const router = express.Router();

function canManageAcceptedAnswer(question, user) {
  return question.author_id === user.id || user.role === 'admin';
}

async function applyAcceptedReputation({ previousAccepted, newAuthorId }) {
  if (
    previousAccepted &&
    previousAccepted.author_id !== newAuthorId
  ) {
    await User.updateReputation(previousAccepted.author_id, -ACCEPTED_ANSWER_REPUTATION);
  }
  if (!previousAccepted || previousAccepted.author_id !== newAuthorId) {
    await User.updateReputation(newAuthorId, ACCEPTED_ANSWER_REPUTATION);
  }
}

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
  optionalAuth,
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

      if (req.user && Array.isArray(answers) && answers.length) {
        await enrichManyWithVotes(answers, 'answer', req.user.id);
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

      const question = await Question.findById(answer.question_id);
      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Питання не знайдено'
        });
      }

      if (!canManageAcceptedAnswer(question, req.user)) {
        return res.status(403).json({
          success: false,
          message: 'Тільки автор питання або адміністратор може прийняти відповідь'
        });
      }

      const { answer: updatedAnswer, previousAccepted } = await Answer.markAsAccepted(
        answerId,
        answer.question_id
      );

      await applyAcceptedReputation({
        previousAccepted,
        newAuthorId: updatedAnswer.author_id,
      });

      if (!previousAccepted || previousAccepted.id !== answerId) {
        await Notification.notifyAnswerAccepted(answerId);
      }

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

/**
 * DELETE /api/answers/:id/accept
 * Зняття позначки прийнятої відповіді
 */
router.delete(
  '/:id/accept',
  authenticateToken,
  [param('id').isInt().withMessage('ID має бути числом')],
  validate,
  async (req, res, next) => {
    try {
      const answerId = parseInt(req.params.id);

      const answer = await Answer.findById(answerId);
      if (!answer) {
        return res.status(404).json({
          success: false,
          message: 'Відповідь не знайдено'
        });
      }

      const question = await Question.findById(answer.question_id);
      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Питання не знайдено'
        });
      }

      if (!canManageAcceptedAnswer(question, req.user)) {
        return res.status(403).json({
          success: false,
          message: 'Тільки автор питання або адміністратор може зняти позначку'
        });
      }

      const { cleared, previousAccepted } = await Answer.clearAccepted(
        answerId,
        answer.question_id
      );

      if (cleared && previousAccepted) {
        await User.updateReputation(previousAccepted.author_id, -ACCEPTED_ANSWER_REPUTATION);
      }

      res.json({
        success: true,
        message: cleared ? 'Позначку знято' : 'Відповідь не була прийнятою',
        data: { cleared }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
