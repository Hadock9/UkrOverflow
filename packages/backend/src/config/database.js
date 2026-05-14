/**
 * Конфігурація бази даних
 * Використовує змінні оточення без хардкодів
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Валідація конфігурації (DB_PASSWORD може бути порожнім — локальний root без пароля)
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(
  (varName) => process.env[varName] === undefined || String(process.env[varName]).trim() === ''
);

if (missingVars.length > 0) {
  throw new Error(
    `Відсутні обов'язкові змінні оточення: ${missingVars.join(', ')}\n` +
    'Створіть файл .env на основі .env.example'
  );
}

// Створення пулу з'єднань
export const pool = mysql.createPool(config);

/**
 * Перевірка з'єднання з базою даних
 */
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✓ З\'єднання з базою даних встановлено');
    connection.release();
    return true;
  } catch (error) {
    console.error('✗ Помилка з\'єднання з базою даних:', error.message);
    throw error;
  }
}

/**
 * Закриття пулу з'єднань
 */
export async function closePool() {
  try {
    await pool.end();
    console.log('✓ Пул з\'єднань закрито');
  } catch (error) {
    console.error('✗ Помилка закриття пулу:', error.message);
    throw error;
  }
}

export default pool;
