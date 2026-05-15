/**
 * Routes для стрічки новин.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import News from '../models/News.js';
import NewsComment from '../models/NewsComment.js';
import NewsPoll from '../models/NewsPoll.js';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.js';
import { attachViewerKeyOptional, resolveViewerKey } from '../middleware/viewerKey.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['published_at', 'views']),
    query('tag').optional().trim(),
    query('category').optional().isIn(['salary', 'career', 'tech', 'community', 'events', 'ai']),
    query('search').optional().trim(),
    query('pinnedOnly').optional().isIn(['0', '1', 'true', 'false']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { page, limit, sortBy, tag, category, search, pinnedOnly } = req.query;
      const result = await News.list({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        sortBy,
        tag,
        category: category || null,
        search,
        pinnedOnly: pinnedOnly === '1' || pinnedOnly === 'true',
      });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.get('/digest', async (req, res, next) => {
  try {
    const digest = await News.getDigest();
    res.json({ success: true, data: digest });
  } catch (e) {
    next(e);
  }
});

router.get('/poll/active', optionalAuth, resolveViewerKey, async (req, res, next) => {
  try {
    const poll = await NewsPoll.findActive();
    if (!poll) {
      return res.json({ success: true, data: { poll: null } });
    }
    const myVote = req.viewerKey
      ? await NewsPoll.getUserVote(poll.id, req.viewerKey)
      : null;
    res.json({ success: true, data: { poll, myVote } });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/poll/:id/vote',
  [param('id').isInt(), body('optionId').trim().isLength({ min: 1, max: 32 })],
  validate,
  resolveViewerKey,
  optionalAuth,
  async (req, res, next) => {
    try {
      const pollId = parseInt(req.params.id, 10);
      const result = await NewsPoll.vote(
        pollId,
        req.body.optionId,
        req.viewerKey,
        req.user?.id || null,
      );
      if (result.error) {
        return res.status(400).json({ success: false, message: result.error });
      }
      const myVote = await NewsPoll.getUserVote(pollId, req.viewerKey);
      res.json({ success: true, data: { poll: result.poll, myVote } });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/:id/comments',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const post = await News.findById(id);
      if (!post) return res.status(404).json({ success: false, message: 'Новину не знайдено' });
      const comments = await NewsComment.listByPost(id);
      res.json({ success: true, data: { comments, count: comments.length } });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/comments',
  authenticateToken,
  [param('id').isInt(), body('body').trim().isLength({ min: 2, max: 5000 })],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const post = await News.findById(id);
      if (!post) return res.status(404).json({ success: false, message: 'Новину не знайдено' });
      const comment = await NewsComment.create({
        newsPostId: id,
        authorId: req.user.id,
        parentId: req.body.parentId || null,
        body: req.body.body.trim(),
      });
      res.status(201).json({ success: true, data: { comment } });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/view',
  [param('id').isInt()],
  validate,
  resolveViewerKey,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const r = await News.recordView(id, req.viewerKey);
      if (!r) return res.status(404).json({ success: false, message: 'Новину не знайдено' });
      res.json({ success: true, data: r });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/:idOrSlug',
  [param('idOrSlug').trim().isLength({ min: 1, max: 280 })],
  validate,
  optionalAuth,
  attachViewerKeyOptional,
  async (req, res, next) => {
    try {
      const { idOrSlug } = req.params;
      let item = await News.findByIdOrSlug(idOrSlug);
      if (!item) return res.status(404).json({ success: false, message: 'Новину не знайдено' });

      if (String(req.headers['x-record-view'] || '').trim() === '1' && req.viewerKey) {
        await News.recordView(item.id, req.viewerKey);
        item = await News.findById(item.id);
      }
      res.json({ success: true, data: { news: item } });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/',
  authenticateToken,
  requireRole('admin', 'moderator'),
  [
    body('title').trim().isLength({ min: 10, max: 255 }),
    body('body').trim().isLength({ min: 80 }),
    body('tags').isArray({ min: 1, max: 8 }),
    body('category').optional().isIn(['salary', 'career', 'tech', 'community', 'events', 'ai']),
    body('publishedAt').optional().isISO8601(),
    body('isPinned').optional().isBoolean(),
    body('slug').optional().trim().isLength({ min: 2, max: 280 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, body: rb, tags, category, publishedAt, isPinned, slug } = req.body;
      const news = await News.create({
        title,
        body: rb,
        tags,
        category: category || 'tech',
        authorId: req.user.id,
        publishedAt,
        isPinned: Boolean(isPinned),
        slug: slug || null,
      });
      res.status(201).json({ success: true, message: 'Новину опубліковано', data: { news } });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireRole('admin', 'moderator'),
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await News.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Новину не знайдено' });
      const news = await News.update(id, req.body);
      res.json({ success: true, data: { news } });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await News.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Новину не знайдено' });
      await News.delete(id);
      res.json({ success: true, message: 'Новину видалено' });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
