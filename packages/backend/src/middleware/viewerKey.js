/**
 * Ключ глядача для унікального підрахунку переглядів питання.
 * Авторизований — user:<id>, анонімний — anon:<uuid> з заголовка X-Visitor-Id.
 */

import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Повертає viewer_key або null (без помилки клієнту).
 */
export function tryResolveViewerKey(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const user = jwt.verify(token, jwtConfig.secret);
      if (user?.id != null) {
        return `user:${Number(user.id)}`;
      }
    } catch {
      /* невалідний токен — пробуємо анонімний ключ */
    }
  }

  const raw = req.headers['x-visitor-id'];
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s && UUID_V4.test(s)) {
    return `anon:${s}`;
  }

  return null;
}

/** Додає req.viewerKey або null (для GET з опційним підрахунком перегляду) */
export function attachViewerKeyOptional(req, res, next) {
  req.viewerKey = tryResolveViewerKey(req);
  next();
}

/** Вимагає viewer_key (для POST /view) */
export function resolveViewerKey(req, res, next) {
  const key = tryResolveViewerKey(req);
  if (!key) {
    return res.status(400).json({
      success: false,
      message: 'Для перегляду без входу надішліть заголовок X-Visitor-Id (UUID v4)',
    });
  }
  req.viewerKey = key;
  next();
}
