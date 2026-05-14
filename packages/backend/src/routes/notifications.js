/**
 * API роути для сповіщень
 */

import express from 'express';
import Notification from '../models/Notification.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/notifications
 * Отримати всі сповіщення користувача
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { unread, limit = 20, offset = 0 } = req.query;

    const notifications = await Notification.findByUserId(userId, {
      unreadOnly: unread === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const unreadCount = await Notification.countUnread(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: notifications.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання сповіщень',
      error: error.message,
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Отримати кількість непрочитаних сповіщень
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await Notification.countUnread(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Error counting unread notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка підрахунку сповіщень',
      error: error.message,
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Позначити сповіщення як прочитане
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    await Notification.markAsRead(notificationId, userId);

    res.json({
      success: true,
      message: 'Сповіщення позначено як прочитане',
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка оновлення сповіщення',
      error: error.message,
    });
  }
});

/**
 * PUT /api/notifications/read-all
 * Позначити всі сповіщення як прочитані
 */
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'Всі сповіщення позначено як прочитані',
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка оновлення сповіщень',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Видалити сповіщення
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    await Notification.delete(notificationId, userId);

    res.json({
      success: true,
      message: 'Сповіщення видалено',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка видалення сповіщення',
      error: error.message,
    });
  }
});

export default router;
