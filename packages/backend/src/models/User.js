/**
 * Модель User
 */

import pool from '../config/database.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export class User {
  /**
   * Створення користувача
   */
  static async create({ username, email, password }) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [username, email, hashedPassword]
    );

    return {
      id: result.insertId,
      username,
      email
    };
  }

  /**
   * Пошук користувача за ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT id, username, email, reputation, role, created_at, updated_at,
              (SELECT COUNT(*) FROM questions WHERE author_id = ?) as questions_count,
              (SELECT COUNT(*) FROM answers WHERE author_id = ?) as answers_count
       FROM users WHERE id = ?`,
      [id, id, id]
    );

    return rows[0] || null;
  }

  /**
   * Пошук користувача за email
   */
  static async findByEmail(email) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    return rows[0] || null;
  }

  /**
   * Пошук користувача за username
   */
  static async findByUsername(username) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    return rows[0] || null;
  }

  /**
   * Перевірка паролю
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Оновлення репутації
   */
  static async updateReputation(userId, delta) {
    await pool.execute(
      'UPDATE users SET reputation = reputation + ? WHERE id = ?',
      [delta, userId]
    );
  }

  /**
   * Оновлення профілю
   */
  static async update(userId, data) {
    const allowedFields = ['username', 'email', 'bio', 'location', 'website'];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      throw new Error('Немає даних для оновлення');
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(userId);
  }

  /**
   * Видалення користувача
   */
  static async delete(userId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Видалення голосів
      await connection.execute('DELETE FROM votes WHERE user_id = ?', [userId]);

      // Видалення відповідей
      await connection.execute('DELETE FROM answers WHERE author_id = ?', [userId]);

      // Видалення питань
      await connection.execute('DELETE FROM questions WHERE author_id = ?', [userId]);

      // Видалення користувача
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Список користувачів
   */
  static async list({ page = 1, limit = 20, sortBy = 'reputation' } = {}) {
    const offset = (page - 1) * limit;
    const allowedSorts = ['reputation', 'created_at', 'username'];
    const sort = allowedSorts.includes(sortBy) ? sortBy : 'reputation';

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.reputation, u.created_at,
              COUNT(DISTINCT q.id) as questions_count,
              COUNT(DISTINCT a.id) as answers_count
       FROM users u
       LEFT JOIN questions q ON q.author_id = u.id
       LEFT JOIN answers a ON a.author_id = u.id
       GROUP BY u.id
       ORDER BY u.${sort} DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );

    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) as total FROM users'
    );

    return {
      users: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Блокування користувача
   */
  static async block(userId) {
    await pool.execute(
      'UPDATE users SET blocked = 1, blocked_at = NOW() WHERE id = ?',
      [userId]
    );

    return this.findById(userId);
  }

  /**
   * Розблокування користувача
   */
  static async unblock(userId) {
    await pool.execute(
      'UPDATE users SET blocked = 0, blocked_at = NULL WHERE id = ?',
      [userId]
    );

    return this.findById(userId);
  }
}

export default User;
