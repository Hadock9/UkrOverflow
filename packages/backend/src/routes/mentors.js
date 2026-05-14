/**
 * Routes /api/mentors — каталог менторів.
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import MentorProfile from '../models/MentorProfile.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

function csvToArray(csv) {
  if (!csv) return null;
  if (Array.isArray(csv)) return csv.map((s) => String(s).trim()).filter(Boolean);
  return String(csv).split(',').map((s) => s.trim()).filter(Boolean);
}

router.get(
  '/',
  [
    query('stack').optional(),
    query('language').optional().trim(),
    query('topic').optional().trim(),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { stack, language, topic, search, page, limit } = req.query;
      const result = await MentorProfile.list({
        stack: csvToArray(stack),
        language: language || null,
        topic: topic || null,
        search: search || null,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
      });
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }
);

router.get(
  '/me',
  authenticateToken,
  async (req, res, next) => {
    try {
      const profile = await MentorProfile.findByUserId(req.user.id);
      res.json({ success: true, data: { profile: profile || null } });
    } catch (e) { next(e); }
  }
);

router.put(
  '/me',
  authenticateToken,
  [
    body('bio').isLength({ min: 20, max: 2000 }).withMessage('Bio 20-2000 символів'),
    body('stack').isArray({ min: 1, max: 10 }).withMessage('Stack 1-10 елементів'),
    body('topics').optional().isArray({ max: 10 }),
    body('languages').optional().isArray({ max: 5 }),
    body('availabilityHoursWeek').optional().isInt({ min: 0, max: 168 }),
    body('priceNote').optional({ nullable: true }).isLength({ max: 160 }),
    body('contactMethod').optional({ nullable: true }).isLength({ max: 160 }),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { bio, stack, topics, languages, availabilityHoursWeek, priceNote, contactMethod, isActive } = req.body;
      const profile = await MentorProfile.upsert({
        userId: req.user.id,
        bio,
        stack: stack || [],
        topics: topics || [],
        languages: languages || [],
        availabilityHoursWeek: availabilityHoursWeek ?? 0,
        priceNote: priceNote || null,
        contactMethod: contactMethod || null,
        isActive: isActive !== undefined ? isActive : true,
      });
      res.json({ success: true, data: { profile } });
    } catch (e) { next(e); }
  }
);

router.delete(
  '/me',
  authenticateToken,
  async (req, res, next) => {
    try {
      await MentorProfile.delete(req.user.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  }
);

router.get(
  '/:userId',
  [param('userId').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const uid = parseInt(req.params.userId, 10);
      const profile = await MentorProfile.findByUserId(uid);
      if (!profile) return res.status(404).json({ success: false, message: 'Менторський профіль не знайдено' });
      res.json({ success: true, data: { profile } });
    } catch (e) { next(e); }
  }
);

export default router;
