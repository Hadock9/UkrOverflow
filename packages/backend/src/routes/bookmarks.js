/**
 * API роути для закладок
 */

import express from 'express';
import Bookmark from '../models/Bookmark.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/bookmarks
 * Отримати всі закладки користувача
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const bookmarks = await Bookmark.findByUserId(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const total = await Bookmark.countByUserId(userId);

    res.json({
      success: true,
      data: {
        bookmarks,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання закладок',
      error: error.message,
    });
  }
});

/**
 * POST /api/bookmarks/:questionId
 * Додати питання в закладки
 */
router.post('/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const questionId = parseInt(req.params.questionId);

    const bookmark = await Bookmark.create(userId, questionId);

    if (!bookmark) {
      return res.status(409).json({
        success: false,
        message: 'Це питання вже в закладках',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Питання додано в закладки',
      data: { bookmark },
    });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення закладки',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/bookmarks/:questionId
 * Видалити питання із закладок
 */
router.delete('/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const questionId = parseInt(req.params.questionId);

    const deleted = await Bookmark.delete(userId, questionId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Закладку не знайдено',
      });
    }

    res.json({
      success: true,
      message: 'Питання видалено із закладок',
    });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка видалення закладки',
      error: error.message,
    });
  }
});

/**
 * GET /api/bookmarks/check/:questionId
 * Перевірити чи питання є в закладках
 */
router.get('/check/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const questionId = parseInt(req.params.questionId);

    const exists = await Bookmark.exists(userId, questionId);

    res.json({
      success: true,
      data: { bookmarked: exists },
    });
  } catch (error) {
    console.error('Error checking bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка перевірки закладки',
      error: error.message,
    });
  }
});

export default router;
