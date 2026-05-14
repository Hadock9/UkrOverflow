/**
 * Unified knowledge hub content feed.
 */

import express from 'express';
import { query } from 'express-validator';
import { Question } from '../models/Question.js';
import Article from '../models/Article.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

function sortItems(items, sortBy) {
  return [...items].sort((a, b) => {
    if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
    if (sortBy === 'votes') return (b.votes || 0) - (a.votes || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Сторінка має бути числом >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Ліміт має бути від 1 до 100'),
    query('sortBy').optional().isIn(['created_at', 'views', 'votes']).withMessage('Невірний параметр сортування'),
    query('contentType').optional().isIn(['all', CONTENT_TYPES.QUESTION, CONTENT_TYPES.ARTICLE]).withMessage('Невірний тип контенту'),
    query('tag').optional().trim(),
    query('authorId').optional().isInt().withMessage('ID автора має бути числом'),
    query('search').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        contentType = 'all',
        tag = null,
        authorId,
        search,
      } = req.query;

      const normalizedPage = parseInt(page, 10) || 1;
      const normalizedLimit = parseInt(limit, 10) || 20;
      const normalizedAuthorId = authorId ? parseInt(authorId, 10) : null;

      if (contentType === CONTENT_TYPES.QUESTION) {
        const result = await Question.list({
          page: normalizedPage,
          limit: normalizedLimit,
          sortBy,
          tag,
          authorId: normalizedAuthorId,
          search,
        });

        return res.json({
          success: true,
          data: {
            items: result.questions,
            pagination: result.pagination,
          },
        });
      }

      if (contentType === CONTENT_TYPES.ARTICLE) {
        const result = await Article.list({
          page: normalizedPage,
          limit: normalizedLimit,
          sortBy: sortBy === 'votes' ? 'created_at' : sortBy,
          tag,
          authorId: normalizedAuthorId,
          search,
        });

        return res.json({
          success: true,
          data: {
            items: result.articles,
            pagination: result.pagination,
          },
        });
      }

      const expandedLimit = normalizedPage * normalizedLimit;
      const [questionsResult, articlesResult] = await Promise.all([
        Question.list({
          page: 1,
          limit: expandedLimit,
          sortBy,
          tag,
          authorId: normalizedAuthorId,
          search,
        }),
        Article.list({
          page: 1,
          limit: expandedLimit,
          sortBy: sortBy === 'votes' ? 'created_at' : sortBy,
          tag,
          authorId: normalizedAuthorId,
          search,
        }),
      ]);

      const mergedItems = sortItems(
        [...questionsResult.questions, ...articlesResult.articles],
        sortBy
      );

      const total = questionsResult.pagination.total + articlesResult.pagination.total;
      const totalPages = Math.max(1, Math.ceil(total / normalizedLimit));
      const offset = (normalizedPage - 1) * normalizedLimit;

      res.json({
        success: true,
        data: {
          items: mergedItems.slice(offset, offset + normalizedLimit),
          pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            total,
            totalPages,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
