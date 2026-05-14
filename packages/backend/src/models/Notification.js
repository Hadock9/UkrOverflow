/**
 * Модель для сповіщень
 */

import pool from '../config/database.js';

class Notification {
  /**
   * Створити сповіщення
   */
  static async create(userId, type, entityType, entityId, data = {}) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO notifications (user_id, type, entity_type, entity_id, data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, type, entityType, entityId, JSON.stringify(data)]
      );

      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Отримати сповіщення за ID
   */
  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        `SELECT n.*, u.username as actor_name
         FROM notifications n
         LEFT JOIN users u ON n.actor_id = u.id
         WHERE n.id = ?`,
        [id]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('Error finding notification:', error);
      throw error;
    }
  }

  /**
   * Отримати всі сповіщення користувача
   */
  static async findByUserId(userId, options = {}) {
    const { unreadOnly = false, limit = 20, offset = 0 } = options;

    try {
      let query = `
        SELECT n.*,
               CASE
                 WHEN n.type = 'question_answer' THEN q.title
                 WHEN n.type = 'answer_accepted' THEN q.title
                 WHEN n.type = 'vote' THEN q.title
                 ELSE NULL
               END as question_title,
               CASE
                 WHEN n.entity_type = 'question' THEN q.author_id
                 WHEN n.entity_type = 'answer' THEN a.author_id
                 ELSE NULL
               END as actor_id,
               CASE
                 WHEN n.entity_type = 'question' THEN qu.username
                 WHEN n.entity_type = 'answer' THEN au.username
                 ELSE NULL
               END as actor_name
        FROM notifications n
        LEFT JOIN questions q ON n.entity_type = 'question' AND n.entity_id = q.id
        LEFT JOIN answers a ON n.entity_type = 'answer' AND n.entity_id = a.id
        LEFT JOIN users qu ON q.author_id = qu.id
        LEFT JOIN users au ON a.author_id = au.id
        WHERE n.user_id = ?
      `;

      const params = [userId];

      if (unreadOnly) {
        query += ' AND n.is_read = FALSE';
      }

      query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [rows] = await pool.execute(query, params);

      return rows;
    } catch (error) {
      console.error('Error finding notifications:', error);
      throw error;
    }
  }

  /**
   * Підрахунок непрочитаних сповіщень
   */
  static async countUnread(userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );

      return rows[0].count;
    } catch (error) {
      console.error('Error counting unread notifications:', error);
      throw error;
    }
  }

  /**
   * Позначити як прочитане
   */
  static async markAsRead(id, userId) {
    try {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Позначити всі як прочитані
   */
  static async markAllAsRead(userId) {
    try {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );

      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Видалити сповіщення
   */
  static async delete(id, userId) {
    try {
      await pool.execute(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Створити сповіщення про нову відповідь
   */
  static async notifyQuestionAnswer(questionId, answerAuthorId) {
    try {
      // Отримати автора питання
      const [questions] = await pool.execute(
        'SELECT author_id FROM questions WHERE id = ?',
        [questionId]
      );

      if (!questions[0]) return;

      const questionAuthorId = questions[0].author_id;

      // Не сповіщати якщо автор відповідає на своє питання
      if (questionAuthorId === answerAuthorId) return;

      await this.create(
        questionAuthorId,
        'question_answer',
        'question',
        questionId,
        { answerAuthorId }
      );
    } catch (error) {
      console.error('Error creating question answer notification:', error);
    }
  }

  /**
   * Створити сповіщення про прийняття відповіді
   */
  static async notifyAnswerAccepted(answerId) {
    try {
      // Отримати автора відповіді
      const [answers] = await pool.execute(
        'SELECT author_id, question_id FROM answers WHERE id = ?',
        [answerId]
      );

      if (!answers[0]) return;

      const { author_id, question_id } = answers[0];

      await this.create(
        author_id,
        'answer_accepted',
        'answer',
        answerId,
        { questionId: question_id }
      );
    } catch (error) {
      console.error('Error creating answer accepted notification:', error);
    }
  }

  /**
   * Створити сповіщення про голос
   */
  static async notifyVote(entityType, entityId, voteType, voterId) {
    try {
      // Отримати автора сутності
      const table = entityType === 'question' ? 'questions' : 'answers';
      const [entities] = await pool.execute(
        `SELECT author_id FROM ${table} WHERE id = ?`,
        [entityId]
      );

      if (!entities[0]) return;

      const authorId = entities[0].author_id;

      // Не сповіщати якщо користувач голосує за свій контент
      if (authorId === voterId) return;

      // Не створюємо сповіщення для downvote (щоб не засмічувати)
      if (voteType === 'down') return;

      await this.create(
        authorId,
        'vote',
        entityType,
        entityId,
        { voteType, voterId }
      );
    } catch (error) {
      console.error('Error creating vote notification:', error);
    }
  }
}

export default Notification;
