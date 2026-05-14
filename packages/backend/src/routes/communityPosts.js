/**
 * Routes /api/community-posts — пости у спільнотах, коментарі.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import CommunityPost from '../models/CommunityPost.js';
import CommunityComment from '../models/CommunityComment.js';
import Community from '../models/Community.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

const POST_TYPES = ['discussion', 'pet_project', 'code_review', 'mentor_request', 'roadmap_request', 'team_search', 'event', 'announcement'];
const POST_STATUSES = ['open', 'closed', 'filled'];

function csvToArray(csv) {
  if (!csv) return null;
  if (Array.isArray(csv)) return csv.map((s) => String(s).trim()).filter(Boolean);
  return String(csv).split(',').map((s) => s.trim()).filter(Boolean);
}

router.get(
  '/',
  [
    query('communityId').optional().isInt(),
    query('type').optional().isIn(POST_TYPES),
    query('status').optional().isIn(POST_STATUSES),
    query('authorId').optional().isInt(),
    query('stack').optional(),
    query('search').optional().trim(),
    query('sort').optional().isIn(['created_at', 'votes', 'views', 'comment_count']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { communityId, type, status, authorId, stack, search, sort, page, limit } = req.query;
      const result = await CommunityPost.list({
        communityId: communityId ? parseInt(communityId, 10) : null,
        type, status,
        authorId: authorId ? parseInt(authorId, 10) : null,
        stack: csvToArray(stack),
        search, sort,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
      });
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }
);

router.get(
  '/:id',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (String(req.headers['x-record-view'] || '').trim() === '1') {
        await CommunityPost.recordView(id);
      }
      const post = await CommunityPost.findById(id);
      if (!post) return res.status(404).json({ success: false, message: 'Пост не знайдено' });
      res.json({ success: true, data: { post } });
    } catch (e) { next(e); }
  }
);

router.post(
  '/',
  authenticateToken,
  [
    body('communityId').isInt(),
    body('type').isIn(POST_TYPES),
    body('title').trim().isLength({ min: 5, max: 255 }).withMessage('Заголовок 5-255 символів'),
    body('body').trim().isLength({ min: 20 }).withMessage('Тіло мінімум 20 символів'),
    body('metadata').optional().custom((v) => v === null || typeof v === 'object'),
    body('stack').optional().isArray({ max: 20 }),
    body('status').optional().isIn(POST_STATUSES),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { communityId, type, title, body: postBody, metadata, stack, status } = req.body;
      const community = await Community.findById(communityId);
      if (!community) return res.status(404).json({ success: false, message: 'Спільноту не знайдено' });

      const post = await CommunityPost.create({
        communityId,
        authorId: req.user.id,
        type,
        title,
        body: postBody,
        metadata: metadata || {},
        stack: Array.isArray(stack) ? stack : [],
        status,
      });
      res.status(201).json({ success: true, data: { post } });
    } catch (e) { next(e); }
  }
);

router.put(
  '/:id',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const post = await CommunityPost.findById(id);
      if (!post) return res.status(404).json({ success: false, message: 'Пост не знайдено' });
      if (post.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Лише автор може редагувати' });
      }
      const updated = await CommunityPost.update(id, req.body);
      res.json({ success: true, data: { post: updated } });
    } catch (e) { next(e); }
  }
);

router.delete(
  '/:id',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const post = await CommunityPost.findById(id);
      if (!post) return res.status(404).json({ success: false, message: 'Пост не знайдено' });

      const community = await Community.findById(post.community_id);
      const isOwner = community?.owner_id === req.user.id;
      if (post.author_id !== req.user.id && !isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Немає прав' });
      }
      await CommunityPost.delete(id);
      res.json({ success: true });
    } catch (e) { next(e); }
  }
);

router.post(
  '/:id/close',
  authenticateToken,
  [param('id').isInt(), body('status').optional().isIn(['closed', 'filled'])],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const post = await CommunityPost.findById(id);
      if (!post) return res.status(404).json({ success: false, message: 'Пост не знайдено' });
      if (post.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Лише автор може закрити' });
      }
      const status = req.body.status === 'filled' ? 'filled' : 'closed';
      const updated = await CommunityPost.update(id, { status });
      res.json({ success: true, data: { post: updated } });
    } catch (e) { next(e); }
  }
);

router.get(
  '/:id/comments',
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const comments = await CommunityComment.listByPost(id);
      res.json({ success: true, data: { comments } });
    } catch (e) { next(e); }
  }
);

router.post(
  '/:id/comments',
  authenticateToken,
  [
    param('id').isInt(),
    body('body').trim().isLength({ min: 1, max: 5000 }),
    body('parentId').optional({ nullable: true }).isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const post = await CommunityPost.findById(id);
      if (!post) return res.status(404).json({ success: false, message: 'Пост не знайдено' });

      const comment = await CommunityComment.create({
        postId: id,
        authorId: req.user.id,
        parentId: req.body.parentId || null,
        body: req.body.body,
      });
      res.status(201).json({ success: true, data: { comment } });
    } catch (e) { next(e); }
  }
);

router.delete(
  '/comments/:commentId',
  authenticateToken,
  [param('commentId').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const cid = parseInt(req.params.commentId, 10);
      const c = await CommunityComment.findById(cid);
      if (!c) return res.status(404).json({ success: false, message: 'Коментар не знайдено' });
      if (c.author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Немає прав' });
      }
      await CommunityComment.delete(cid);
      res.json({ success: true });
    } catch (e) { next(e); }
  }
);

export default router;
