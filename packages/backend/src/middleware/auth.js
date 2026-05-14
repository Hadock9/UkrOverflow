/**
 * Middleware для авторизації
 */

import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';

/**
 * Перевірка JWT токену
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Токен авторизації відсутній'
    });
  }

  jwt.verify(token, jwtConfig.secret, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Недійсний або прострочений токен'
      });
    }

    req.user = user;
    next();
  });
}

/**
 * Опціональна авторизація (не вимагає токен)
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, jwtConfig.secret, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }

  next();
}

/**
 * Перевірка ролі користувача
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Авторизація обов\'язкова'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Недостатньо прав доступу'
      });
    }

    next();
  };
}

/**
 * Перевірка власності ресурсу або адмін права
 */
export function requireOwnerOrAdmin(getOwnerId) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Авторизація обов\'язкова'
      });
    }

    // Адмін має доступ до всього
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const ownerId = await getOwnerId(req);

      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: 'Ресурс не знайдено'
        });
      }

      if (ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Ви можете редагувати тільки свій контент'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Помилка перевірки прав доступу'
      });
    }
  };
}

export default {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnerOrAdmin
};
