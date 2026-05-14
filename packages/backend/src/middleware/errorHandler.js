/**
 * Middleware для обробки помилок
 */

export function errorHandler(err, req, res, next) {
  console.error('[Error]', err);

  // Помилки валідації
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Помилка валідації',
      errors: err.errors
    });
  }

  // JWT помилки
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Недійсний токен'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Токен прострочений'
    });
  }

  // Помилки бази даних
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Запис з такими даними вже існує'
    });
  }

  // Загальна помилка
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Внутрішня помилка сервера',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * Обробник 404
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Ресурс не знайдено'
  });
}

export default {
  errorHandler,
  notFoundHandler
};
