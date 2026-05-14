/**
 * Routes /api/communities — спільноти DevFlow.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import Community from '../models/Community.js';
import CommunityMembership from '../models/CommunityMembership.js';
import Notification from '../models/Notification.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

const COMMUNITY_TYPES = ['city', 'university', 'dev_club', 'project_team', 'study_group', 'company', 'online'];

router.get(
  '/',
  [
    query('type').optional().isIn(COMMUNITY_TYPES),
    query('location').optional().trim(),
    query('search').optional().trim(),
    query('sort').optional().isIn(['created_at', 'member_count', 'post_count']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { type, location, search, sort, page, limit } = req.query;
      const result = await Community.list({
        type, location, search, sort,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
      });
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }
);

router.get(
  '/:slug',
  optionalAuth,
  [param('slug').isString().trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const community = await Community.findBySlug(req.params.slug);
      if (!community) return res.status(404).json({ success: false, message: 'Спільноту не знайдено' });

      let myRole = null;
      if (req.user?.id) {
        myRole = await CommunityMembership.findRole(community.id, req.user.id);
      }
      res.json({ success: true, data: { community: { ...community, myRole } } });
    } catch (e) { next(e); }
  }
);

router.post(
  '/',
  authenticateToken,
  [
    body('name').trim().isLength({ min: 3, max: 160 }).withMessage('Назва 3-160 символів'),
    body('type').isIn(COMMUNITY_TYPES).withMessage('Невалідний тип'),
    body('description').optional({ nullable: true }).isLength({ max: 2000 }),
    body('location').optional({ nullable: true }).isLength({ max: 120 }),
    body('website').optional({ nullable: true }).isLength({ max: 255 }),
    body('tags').optional().isArray({ max: 10 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, type, description, location, website, tags } = req.body;
      const community = await Community.create({
        name, type,
        description: description || null,
        location: location || null,
        website: website || null,
        tags: Array.isArray(tags) ? tags : [],
        ownerId: req.user.id,
      });
      res.status(201).json({ success: true, data: { community } });
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
      const community = await Community.findById(id);
      if (!community) return res.status(404).json({ success: false, message: 'Спільноту не знайдено' });

      const role = await CommunityMembership.findRole(id, req.user.id);
      const isOwner = community.owner_id === req.user.id;
      if (!isOwner && role !== 'admin' && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Немає прав' });
      }
      const updated = await Community.update(id, req.body);
      res.json({ success: true, data: { community: updated } });
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
      const community = await Community.findById(id);
      if (!community) return res.status(404).json({ success: false, message: 'Спільноту не знайдено' });
      if (community.owner_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Лише власник може видалити' });
      }
      await Community.delete(id);
      res.json({ success: true, message: 'Спільноту видалено' });
    } catch (e) { next(e); }
  }
);

router.post(
  '/:id/join',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const community = await Community.findById(id);
      if (!community) return res.status(404).json({ success: false, message: 'Спільноту не знайдено' });

      const existingRole = await CommunityMembership.findRole(id, req.user.id);
      if (existingRole) {
        return res.json({ success: true, message: 'Ви вже учасник', data: { role: existingRole } });
      }
      const m = await CommunityMembership.join(id, req.user.id, 'member');
      await Notification.notifyCommunityJoin(id, req.user.id);
      res.json({ success: true, data: { membership: m } });
    } catch (e) { next(e); }
  }
);

router.post(
  '/:id/leave',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const community = await Community.findById(id);
      if (!community) return res.status(404).json({ success: false, message: 'Спільноту не знайдено' });
      if (community.owner_id === req.user.id) {
        return res.status(400).json({ success: false, message: 'Власник не може вийти зі своєї спільноти' });
      }
      const ok = await CommunityMembership.leave(id, req.user.id);
      if (!ok) return res.status(400).json({ success: false, message: 'Ви не учасник' });
      res.json({ success: true });
    } catch (e) { next(e); }
  }
);

router.get(
  '/:id/members',
  [
    param('id').isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { page, limit } = req.query;
      const result = await CommunityMembership.listMembers(id, {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 50,
      });
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }
);

export default router;
