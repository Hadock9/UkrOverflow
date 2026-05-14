/**
 * Уніфікований фід knowledge hub: агрегує всі 7 типів контенту.
 *
 * GET /api/content
 *   ?contentType=all|question|article|guide|snippet|roadmap|best_practice|faq
 *   ?sortBy=created_at|views|votes
 *   ?tag, ?authorId, ?search, ?page, ?limit
 */

import express from 'express';
import { query } from 'express-validator';
import { Question } from '../models/Question.js';
import Article from '../models/Article.js';
import Guide from '../models/Guide.js';
import Snippet from '../models/Snippet.js';
import Roadmap from '../models/Roadmap.js';
import BestPractice from '../models/BestPractice.js';
import Faq from '../models/Faq.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

const SUPPORTED_TYPES = [
  'all',
  CONTENT_TYPES.QUESTION,
  CONTENT_TYPES.ARTICLE,
  CONTENT_TYPES.GUIDE,
  CONTENT_TYPES.SNIPPET,
  CONTENT_TYPES.ROADMAP,
  CONTENT_TYPES.BEST_PRACTICE,
  CONTENT_TYPES.FAQ,
];

function sortItems(items, sortBy) {
  return [...items].sort((a, b) => {
    if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
    if (sortBy === 'votes') return (b.votes || 0) - (a.votes || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

async function loadByType(type, opts) {
  switch (type) {
    case CONTENT_TYPES.QUESTION: {
      const r = await Question.list(opts);
      return { items: r.questions, total: r.pagination.total };
    }
    case CONTENT_TYPES.ARTICLE: {
      const r = await Article.list({ ...opts, sortBy: opts.sortBy === 'votes' ? 'created_at' : opts.sortBy });
      return { items: r.articles, total: r.pagination.total };
    }
    case CONTENT_TYPES.GUIDE: {
      const r = await Guide.list({ ...opts, sortBy: opts.sortBy === 'votes' ? 'created_at' : opts.sortBy });
      return { items: r.guides, total: r.pagination.total };
    }
    case CONTENT_TYPES.SNIPPET: {
      const r = await Snippet.list({ ...opts, sortBy: opts.sortBy === 'votes' ? 'created_at' : opts.sortBy });
      return { items: r.snippets, total: r.pagination.total };
    }
    case CONTENT_TYPES.ROADMAP: {
      const r = await Roadmap.list({ ...opts, sortBy: opts.sortBy === 'votes' ? 'created_at' : opts.sortBy });
      return { items: r.roadmaps, total: r.pagination.total };
    }
    case CONTENT_TYPES.BEST_PRACTICE: {
      const r = await BestPractice.list({ ...opts, sortBy: opts.sortBy === 'votes' ? 'created_at' : opts.sortBy });
      return { items: r.bestPractices, total: r.pagination.total };
    }
    case CONTENT_TYPES.FAQ: {
      const r = await Faq.list({ ...opts, sortBy: opts.sortBy === 'votes' ? 'created_at' : opts.sortBy });
      return { items: r.faqs, total: r.pagination.total };
    }
    default:
      return { items: [], total: 0 };
  }
}

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['created_at', 'views', 'votes']),
    query('contentType').optional().isIn(SUPPORTED_TYPES),
    query('tag').optional().trim(),
    query('authorId').optional().isInt(),
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

      if (contentType !== 'all') {
        const result = await loadByType(contentType, {
          page: normalizedPage,
          limit: normalizedLimit,
          sortBy,
          tag,
          authorId: normalizedAuthorId,
          search,
        });
        const totalPages = Math.max(1, Math.ceil(result.total / normalizedLimit));
        return res.json({
          success: true,
          data: {
            items: result.items,
            pagination: { page: normalizedPage, limit: normalizedLimit, total: result.total, totalPages },
          },
        });
      }

      const expandedLimit = normalizedPage * normalizedLimit;
      const opts = { page: 1, limit: expandedLimit, sortBy, tag, authorId: normalizedAuthorId, search };

      const allTypes = SUPPORTED_TYPES.filter((t) => t !== 'all');
      const results = await Promise.all(allTypes.map((t) => loadByType(t, opts)));

      const merged = sortItems(results.flatMap((r) => r.items), sortBy);
      const total = results.reduce((acc, r) => acc + r.total, 0);
      const totalPages = Math.max(1, Math.ceil(total / normalizedLimit));
      const offset = (normalizedPage - 1) * normalizedLimit;

      res.json({
        success: true,
        data: {
          items: merged.slice(offset, offset + normalizedLimit),
          pagination: { page: normalizedPage, limit: normalizedLimit, total, totalPages },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
