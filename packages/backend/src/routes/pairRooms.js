/**
 * Routes /api/pair-rooms — парне програмування.
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import PairRoom from '../models/PairRoom.js';
import PairRoomMessage from '../models/PairRoomMessage.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { setPresence, logActivity } from '../services/activityService.js';

const router = express.Router();

const ROOM_TYPES = PairRoom.ROOM_TYPES;
const TOPICS = ['debug this', 'study JS', 'study Python', 'react', 'algorithms', 'general'];

function broadcastRoom(roomId, data) {
  if (typeof global.broadcast === 'function') {
    global.broadcast(`pair-room:${roomId}`, data);
  }
}

router.get(
  '/',
  [
    query('topic').optional().trim(),
    query('roomType').optional().isIn(ROOM_TYPES),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await PairRoom.list({
        topic: req.query.topic,
        roomType: req.query.roomType,
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
      });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.get('/topics', (_req, res) => {
  res.json({ success: true, data: { topics: TOPICS, roomTypes: ROOM_TYPES } });
});

router.get(
  '/:slug',
  optionalAuth,
  [param('slug').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const room = await PairRoom.findBySlug(req.params.slug);
      if (!room) {
        return res.status(404).json({ success: false, message: 'Кімнату не знайдено' });
      }

      const members = await PairRoom.getMembers(room.id);
      const messages = await PairRoomMessage.list(room.id, { limit: 60 });

      let isMember = false;
      if (req.user?.id) {
        isMember = await PairRoom.isMember(room.id, req.user.id);
      }

      res.json({
        success: true,
        data: { room: { ...room, isMember }, members, messages },
      });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/',
  authenticateToken,
  [
    body('title').trim().isLength({ min: 3, max: 120 }),
    body('topic').optional().trim(),
    body('roomType').optional().isIn(ROOM_TYPES),
    body('description').optional().isLength({ max: 500 }),
    body('codeSnippet').optional().isString(),
    body('stack').optional().isArray({ max: 8 }),
    body('maxParticipants').optional().isInt({ min: 2, max: 12 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const room = await PairRoom.create({
        title: req.body.title,
        topic: req.body.topic || 'general',
        roomType: req.body.roomType || 'general',
        description: req.body.description,
        codeSnippet: req.body.codeSnippet || '',
        hostId: req.user.id,
        maxParticipants: req.body.maxParticipants || 6,
        stack: req.body.stack,
      });

      await logActivity({
        actorId: req.user.id,
        verb: 'room_created',
        entityType: 'pair_room',
        entityId: room.id,
        title: room.title,
      });

      res.status(201).json({ success: true, data: { room } });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id/join',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const roomId = parseInt(req.params.id, 10);
      const result = await PairRoom.join(roomId, req.user.id);

      if (!result) {
        return res.status(404).json({ success: false, message: 'Кімнату не знайдено' });
      }
      if (result.error === 'full') {
        return res.status(409).json({ success: false, message: 'Кімната заповнена' });
      }
      if (result.error === 'closed') {
        return res.status(410).json({ success: false, message: 'Кімната закрита' });
      }

      await setPresence(req.user.id, {
        status: 'in_room',
        context: { roomTitle: result.room.title },
        entityType: 'pair_room',
        entityId: roomId,
      });

      broadcastRoom(roomId, { type: 'member_join', userId: req.user.id, username: req.user.username });

      res.json({ success: true, data: { room: result.room } });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id/leave',
  authenticateToken,
  [param('id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const roomId = parseInt(req.params.id, 10);
      await PairRoom.leave(roomId, req.user.id);
      broadcastRoom(roomId, { type: 'member_leave', userId: req.user.id });
      res.json({ success: true, message: 'Ви вийшли з кімнати' });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  '/:id/code',
  authenticateToken,
  [param('id').isInt(), body('codeSnippet').isString()],
  validate,
  async (req, res, next) => {
    try {
      const roomId = parseInt(req.params.id, 10);
      const isMember = await PairRoom.isMember(roomId, req.user.id);
      if (!isMember) {
        return res.status(403).json({ success: false, message: 'Спочатку приєднайтесь до кімнати' });
      }

      const room = await PairRoom.updateCode(roomId, req.user.id, req.body.codeSnippet);
      broadcastRoom(roomId, {
        type: 'code_update',
        codeSnippet: req.body.codeSnippet,
        userId: req.user.id,
        username: req.user.username,
      });

      res.json({ success: true, data: { room } });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/:id/messages',
  optionalAuth,
  [param('id').isInt(), query('limit').optional().isInt({ min: 1, max: 200 })],
  validate,
  async (req, res, next) => {
    try {
      const roomId = parseInt(req.params.id, 10);
      const messages = await PairRoomMessage.list(roomId, {
        limit: req.query.limit,
        beforeId: req.query.beforeId ? parseInt(req.query.beforeId, 10) : null,
      });
      res.json({ success: true, data: { messages } });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id/messages',
  authenticateToken,
  [param('id').isInt(), body('body').trim().isLength({ min: 1, max: 4000 })],
  validate,
  async (req, res, next) => {
    try {
      const roomId = parseInt(req.params.id, 10);
      const isMember = await PairRoom.isMember(roomId, req.user.id);
      if (!isMember) {
        return res.status(403).json({ success: false, message: 'Спочатку приєднайтесь до кімнати' });
      }

      const message = await PairRoomMessage.create({
        roomId,
        authorId: req.user.id,
        body: req.body.body,
      });

      broadcastRoom(roomId, { type: 'message', message });

      res.status(201).json({ success: true, data: { message } });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
