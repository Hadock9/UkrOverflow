/**
 * Конфігурація JWT
 * Без хардкодів, тільки змінні оточення
 */

import dotenv from 'dotenv';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error(
    'Відсутня змінна JWT_SECRET в .env файлі\n' +
    'Згенеруйте секрет командою: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠ JWT_SECRET занадто короткий. Рекомендується мінімум 32 символи');
}

export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  algorithm: 'HS256'
};

export default jwtConfig;
