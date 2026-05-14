/**
 * Routes для авторизації
 */

import express from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { jwtConfig } from '../config/jwt.js';
import { validate } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Реєстрація нового користувача
 */
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Ім\'я користувача має бути від 3 до 30 символів')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Ім\'я користувача може містити тільки літери, цифри та _'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Невірний формат email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Пароль має бути мінімум 6 символів')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { username, email, password } = req.body;

      // Перевірка існування користувача
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Користувач з таким email вже існує'
        });
      }

      const existingUsername = await User.findByUsername(username);
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: 'Користувач з таким іменем вже існує'
        });
      }

      // Створення користувача
      const user = await User.create({ username, email, password });

      // Генерація токена
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      res.status(201).json({
        success: true,
        message: 'Користувача успішно зареєстровано',
        data: {
          user,
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Вхід користувача
 */
router.post(
  '/login',
  [
    body('identifier')
      .trim()
      .notEmpty()
      .withMessage('Email або ім\'я користувача обов\'язкове'),
    body('password')
      .notEmpty()
      .withMessage('Пароль обов\'язковий')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { identifier, password } = req.body;

      // Пошук користувача за email або username
      let user = await User.findByEmail(identifier);
      if (!user) {
        user = await User.findByUsername(identifier);
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Невірний email/ім\'я користувача або пароль'
        });
      }

      // Перевірка паролю
      const isPasswordValid = await User.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Невірний email/ім\'я користувача або пароль'
        });
      }

      // Генерація токена
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      // Видалення паролю з відповіді
      delete user.password;

      res.json({
        success: true,
        message: 'Успішний вхід',
        data: {
          user,
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Отримання профілю поточного користувача
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Користувача не знайдено'
      });
    }

    delete user.password;

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/profile
 * Оновлення профілю
 */
router.put(
  '/profile',
  authenticateToken,
  [
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Ім\'я користувача має бути від 3 до 30 символів'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Невірний формат email'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Біографія має бути максимум 500 символів'),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Місцезнаходження має бути максимум 100 символів'),
    body('website')
      .optional()
      .trim()
      .isURL()
      .withMessage('Невірний формат URL')
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.update(req.user.id, req.body);

      delete user.password;

      res.json({
        success: true,
        message: 'Профіль оновлено',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
