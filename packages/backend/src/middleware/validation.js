/**
 * Middleware для валідації даних
 */

import { validationResult } from 'express-validator';

/**
 * Перевірка результатів валідації
 */
export function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Помилка валідації',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }

  next();
}

export default validate;
