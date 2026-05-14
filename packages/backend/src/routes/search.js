/**
 * Routes для повнотекстового пошуку
 */

import express from 'express';
import { query } from 'express-validator';
import pool from '../config/database.js';
import { validate } from '../middleware/validation.js';
import { optionalAuth } from '../middleware/auth.js';
import { globalSearch } from '../services/globalSearchService.js';

const router = express.Router();

/**
 * GET /api/search/global?q=...&types=question,snippet,community_post&page=1&limit=20
 * Уніфіковані результати по хабу та постах спільнот.
 */
router.get(
  '/global',
  [
    query('q').trim().isLength({ min: 2 }).withMessage('Мінімум 2 символи'),
    query('types').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  optionalAuth,
  async (req, res, next) => {
    try {
      const { q, types, page = 1, limit = 20 } = req.query;
      const typeList = types
        ? String(types)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : null;
      const { hits: allHits, query: qNorm } = await globalSearch(q, {
        types: typeList || undefined,
        limitPerType: 14,
      });
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(50, Math.max(5, parseInt(limit, 10) || 20));
      const offset = (p - 1) * l;
      const pageHits = allHits.slice(offset, offset + l);
      res.json({
        success: true,
        data: {
          hits: pageHits,
          pagination: {
            page: p,
            limit: l,
            total: allHits.length,
            totalPages: Math.max(1, Math.ceil(allHits.length / l)),
          },
          query: qNorm,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/search
 * Повнотекстовий пошук по питаннях та відповідях
 */
router.get(
  '/',
  [
    query('q')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Пошуковий запит має бути мінімум 3 символи'),
    query('type')
      .optional()
      .isIn(['all', 'questions', 'answers'])
      .withMessage('Тип має бути: all, questions, або answers'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Сторінка має бути числом >= 1'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Ліміт має бути від 1 до 50')
  ],
  validate,
  optionalAuth,
  async (req, res, next) => {
    try {
      const { q, type = 'all', page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const results = {
        query: q,
        questions: [],
        answers: [],
        total: 0
      };

      // Пошук по питаннях
      if (type === 'all' || type === 'questions') {
        const [questions] = await pool.execute(
          `SELECT
            q.id,
            q.title,
            q.body,
            q.tags,
            q.views,
            q.created_at,
            u.username as author_name,
            (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count,
            (SELECT COUNT(*) FROM votes WHERE entity_type = 'question' AND entity_id = q.id AND vote_type = 'up') -
            (SELECT COUNT(*) FROM votes WHERE entity_type = 'question' AND entity_id = q.id AND vote_type = 'down') as votes,
            MATCH(q.title, q.body) AGAINST (? IN NATURAL LANGUAGE MODE) as relevance
           FROM questions q
           JOIN users u ON q.author_id = u.id
           WHERE MATCH(q.title, q.body) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY relevance DESC, q.created_at DESC
           LIMIT ? OFFSET ?`,
          [q, q, parseInt(limit), offset]
        );

        questions.forEach(question => {
          question.tags = JSON.parse(question.tags || '[]');
        });

        results.questions = questions;
        results.total += questions.length;
      }

      // Пошук по відповідях
      if (type === 'all' || type === 'answers') {
        const [answers] = await pool.execute(
          `SELECT
            a.id,
            a.body,
            a.question_id,
            a.is_accepted,
            a.created_at,
            u.username as author_name,
            q.title as question_title,
            (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'up') -
            (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'down') as votes,
            MATCH(a.body) AGAINST (? IN NATURAL LANGUAGE MODE) as relevance
           FROM answers a
           JOIN users u ON a.author_id = u.id
           JOIN questions q ON a.question_id = q.id
           WHERE MATCH(a.body) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY relevance DESC, a.created_at DESC
           LIMIT ? OFFSET ?`,
          [q, q, parseInt(limit), offset]
        );

        results.answers = answers;
        results.total += answers.length;
      }

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/search/suggestions
 * Автодоповнення для пошуку
 */
router.get(
  '/suggestions',
  [
    query('q')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Запит має бути мінімум 2 символи')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { q } = req.query;

      // Пошук схожих заголовків питань
      const [suggestions] = await pool.execute(
        `SELECT DISTINCT title
         FROM questions
         WHERE title LIKE ?
         ORDER BY views DESC
         LIMIT 10`,
        [`%${q}%`]
      );

      // Популярні теги
      const [tags] = await pool.execute(
        `SELECT DISTINCT JSON_EXTRACT(tags, '$[*]') as tag_list
         FROM questions
         WHERE JSON_SEARCH(tags, 'one', ?, NULL, '$[*]') IS NOT NULL
         LIMIT 5`,
        [`%${q}%`]
      );

      const tagSuggestions = [];
      tags.forEach(row => {
        try {
          const tagList = JSON.parse(row.tag_list);
          tagList.forEach(tag => {
            if (tag.toLowerCase().includes(q.toLowerCase()) && !tagSuggestions.includes(tag)) {
              tagSuggestions.push(tag);
            }
          });
        } catch (e) {
          // Ignore parse errors
        }
      });

      res.json({
        success: true,
        data: {
          titles: suggestions.map(s => s.title),
          tags: tagSuggestions.slice(0, 5)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
