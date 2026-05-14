/**
 * Модель для закладок
 */

import pool from '../config/database.js';

class Bookmark {
  /**
   * Створити закладку
   */
  static async create(userId, questionId) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO bookmarks (user_id, question_id, created_at) VALUES (?, ?, NOW())',
        [userId, questionId]
      );

      return {
        id: result.insertId,
        user_id: userId,
        question_id: questionId,
      };
    } catch (error) {
      // Якщо закладка вже існує (UNIQUE constraint)
      if (error.code === 'ER_DUP_ENTRY') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Видалити закладку
   */
  static async delete(userId, questionId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?',
        [userId, questionId]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      throw error;
    }
  }

  /**
   * Перевірити чи питання є в закладках
   */
  static async exists(userId, questionId) {
    try {
      const [rows] = await pool.execute(
        'SELECT id FROM bookmarks WHERE user_id = ? AND question_id = ?',
        [userId, questionId]
      );

      return rows.length > 0;
    } catch (error) {
      console.error('Error checking bookmark:', error);
      throw error;
    }
  }

  /**
   * Отримати всі закладки користувача
   */
  static async findByUserId(userId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      const [rows] = await pool.execute(
        `SELECT
           b.id as bookmark_id,
           b.created_at as bookmarked_at,
           q.id,
           q.title,
           q.body,
           q.tags,
           q.views,
           q.created_at,
           q.author_id,
           u.username as author_name,
           (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count,
           COALESCE(
             (SELECT SUM(CASE WHEN vote_type = 'up' THEN 1 WHEN vote_type = 'down' THEN -1 ELSE 0 END)
              FROM votes WHERE entity_type = 'question' AND entity_id = q.id),
             0
           ) as votes
         FROM bookmarks b
         JOIN questions q ON b.question_id = q.id
         JOIN users u ON q.author_id = u.id
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      return rows.map(row => ({
        ...row,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
      }));
    } catch (error) {
      console.error('Error finding bookmarks:', error);
      throw error;
    }
  }

  /**
   * Підрахунок закладок користувача
   */
  static async countByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?',
        [userId]
      );

      return rows[0].count;
    } catch (error) {
      console.error('Error counting bookmarks:', error);
      throw error;
    }
  }
}

export default Bookmark;
