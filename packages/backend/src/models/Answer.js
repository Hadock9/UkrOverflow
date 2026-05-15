/**
 * Модель Answer
 */

import pool from '../config/database.js';

/** Бонус репутації автору прийнятої відповіді */
export const ACCEPTED_ANSWER_REPUTATION = 15;

export class Answer {
  /**
   * Створення відповіді
   */
  static async create({ body, questionId, authorId }) {
    const [result] = await pool.execute(
      `INSERT INTO answers (body, question_id, author_id, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [body, questionId, authorId]
    );

    return this.findById(result.insertId);
  }

  /**
   * Пошук відповіді за ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT a.*, u.username as author_name,
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'up') as upvotes,
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'down') as downvotes
       FROM answers a
       JOIN users u ON a.author_id = u.id
       WHERE a.id = ?`,
      [id]
    );

    if (rows[0]) {
      rows[0].votes = rows[0].upvotes - rows[0].downvotes;
    }

    return rows[0] || null;
  }

  /**
   * Список відповідей для питання
   */
  static async listByQuestion(questionId, { sortBy = 'votes' } = {}) {
    const allowedSorts = ['votes', 'created_at'];
    const sort = allowedSorts.includes(sortBy) ? sortBy : 'votes';

    let orderBy = sort === 'votes'
      ? 'votes DESC, a.created_at DESC'
      : 'a.created_at DESC';

    const [rows] = await pool.execute(
      `SELECT a.*, u.username as author_name,
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'up') -
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'down') as votes
       FROM answers a
       JOIN users u ON a.author_id = u.id
       WHERE a.question_id = ?
       ORDER BY a.is_accepted DESC, ${orderBy}`,
      [questionId]
    );

    return rows;
  }

  /**
   * Поточна прийнята відповідь для питання (якщо є)
   */
  static async findAcceptedByQuestion(questionId) {
    const [rows] = await pool.execute(
      'SELECT id, author_id FROM answers WHERE question_id = ? AND is_accepted = 1 LIMIT 1',
      [questionId]
    );
    return rows[0] || null;
  }

  /**
   * Список відповідей користувача
   */
  static async listByAuthor(authorId, { sortBy = 'created_at', limit = 100 } = {}) {
    const allowedSorts = ['votes', 'created_at'];
    const sort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';

    let orderBy = sort === 'votes'
      ? 'votes DESC, a.created_at DESC'
      : 'a.created_at DESC';

    const [rows] = await pool.query(
      `SELECT a.*, u.username as author_name, q.title as question_title,
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'up') as upvotes,
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'down') as downvotes,
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'up') -
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'answer' AND entity_id = a.id AND vote_type = 'down') as votes
       FROM answers a
       JOIN users u ON a.author_id = u.id
       JOIN questions q ON a.question_id = q.id
       WHERE a.author_id = ?
       ORDER BY ${orderBy}
       LIMIT ${parseInt(limit)}`,
      [authorId]
    );

    return rows;
  }

  /**
   * Оновлення відповіді
   */
  static async update(id, { body }) {
    await pool.execute(
      'UPDATE answers SET body = ?, updated_at = NOW() WHERE id = ?',
      [body, id]
    );

    return this.findById(id);
  }

  /**
   * Видалення відповіді
   */
  static async delete(id) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Видалення голосів
      await connection.execute(
        'DELETE FROM votes WHERE entity_type = "answer" AND entity_id = ?',
        [id]
      );

      // Видалення відповіді
      await connection.execute('DELETE FROM answers WHERE id = ?', [id]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Позначення відповіді як прийнятої
   */
  static async markAsAccepted(id, questionId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [previousRows] = await connection.execute(
        'SELECT id, author_id FROM answers WHERE question_id = ? AND is_accepted = 1',
        [questionId]
      );
      const previous = previousRows[0] || null;

      // Зняти позначку з інших відповідей
      await connection.execute(
        'UPDATE answers SET is_accepted = 0 WHERE question_id = ?',
        [questionId]
      );

      // Позначити цю відповідь
      await connection.execute(
        'UPDATE answers SET is_accepted = 1 WHERE id = ?',
        [id]
      );

      await connection.commit();

      return {
        answer: await this.findById(id),
        previousAccepted: previous,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Зняти позначку прийнятої відповіді
   */
  static async clearAccepted(id, questionId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        'SELECT id, author_id, is_accepted FROM answers WHERE id = ? AND question_id = ?',
        [id, questionId]
      );
      const existing = rows[0];
      if (!existing || !existing.is_accepted) {
        await connection.rollback();
        return { cleared: false, previousAccepted: null };
      }

      await connection.execute(
        'UPDATE answers SET is_accepted = 0 WHERE question_id = ?',
        [questionId]
      );

      await connection.commit();

      return {
        cleared: true,
        previousAccepted: { id: existing.id, author_id: existing.author_id },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default Answer;
