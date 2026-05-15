/**
 * Глобальний каталог тегів платформи.
 * GET /api/tags
 */

import express from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validation.js';
import {
  aggregateAllTags,
  filterAndSortTags,
  SOURCE_LABELS,
} from '../services/tagsAggregateService.js';

const router = express.Router();

let cache = { at: 0, tags: [] };
const CACHE_MS = 60_000;

async function getTagsCached() {
  const stale = Date.now() - cache.at >= CACHE_MS || !cache.tags.length;
  if (!stale) return cache.tags;
  const tags = await aggregateAllTags();
  cache = { at: Date.now(), tags };
  return tags;
}

router.get(
  '/',
  [
    query('search').optional().trim(),
    query('source').optional().isIn([
      'all', 'question', 'article', 'guide', 'snippet',
      'roadmap', 'best_practice', 'faq', 'news', 'community', 'hub',
    ]),
    query('sortBy').optional().isIn(['count', 'name']),
    query('limit').optional().isInt({ min: 1, max: 500 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { search, source, sortBy } = req.query;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

      let sourceFilter = source || 'all';
      if (sourceFilter === 'hub') {
        const all = await getTagsCached();
        let list = filterAndSortTags(all, { search, source: 'all', sortBy: sortBy || 'count' });
        list = list.filter((t) => t.hubCount > 0);
        if (limit) list = list.slice(0, limit);
        return res.json({
          success: true,
          data: {
            tags: list,
            total: list.length,
            sources: SOURCE_LABELS,
          },
        });
      }

      const all = await getTagsCached();
      let list = filterAndSortTags(all, {
        search,
        source: sourceFilter,
        sortBy: sortBy || 'count',
      });
      if (limit) list = list.slice(0, limit);

      res.json({
        success: true,
        data: {
          tags: list,
          total: list.length,
          sources: SOURCE_LABELS,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
