/**
 * Модель Vote
 */

import pool from '../config/database.js';
import Notification from './Notification.js';

export class Vote {
  /**
   * Голосування
   */
  static async vote({ userId, entityType, entityId, voteType }) {
    const connection = await pool.getConnection();

    let notifyUpvote = false;

    try {
      await connection.beginTransaction();

      // Перевірка існуючого голосу
      const [existing] = await connection.execute(
        'SELECT * FROM votes WHERE user_id = ? AND entity_type = ? AND entity_id = ?',
        [userId, entityType, entityId]
      );

      if (existing.length > 0) {
        const currentVote = existing[0];

        // Якщо той самий тип - видаляємо голос
        if (currentVote.vote_type === voteType) {
          await connection.execute(
            'DELETE FROM votes WHERE id = ?',
            [currentVote.id]
          );
        } else {
          // Інакше - змінюємо тип голосу
          await connection.execute(
            'UPDATE votes SET vote_type = ? WHERE id = ?',
            [voteType, currentVote.id]
          );
          notifyUpvote = voteType === 'up';
        }
      } else {
        // Новий голос
        await connection.execute(
          'INSERT INTO votes (user_id, entity_type, entity_id, vote_type, created_at) VALUES (?, ?, ?, ?, NOW())',
          [userId, entityType, entityId, voteType]
        );
        notifyUpvote = voteType === 'up';
      }

      await connection.commit();

      // Оновлення репутації автора
      await this._updateAuthorReputation(entityType, entityId, voteType);

      if (notifyUpvote) {
        await Notification.notifyVote(entityType, entityId, 'up', userId);
      }

      return this.getVotes(entityType, entityId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Отримання голосів для сутності
   */
  static async getVotes(entityType, entityId) {
    const [rows] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM votes WHERE entity_type = ? AND entity_id = ? AND vote_type = 'up') as upvotes,
        (SELECT COUNT(*) FROM votes WHERE entity_type = ? AND entity_id = ? AND vote_type = 'down') as downvotes`,
      [entityType, entityId, entityType, entityId]
    );

    const { upvotes, downvotes } = rows[0];

    return {
      upvotes,
      downvotes,
      total: upvotes - downvotes
    };
  }

  /**
   * Перевірка голосу користувача
   */
  static async getUserVote(userId, entityType, entityId) {
    const [rows] = await pool.execute(
      'SELECT vote_type FROM votes WHERE user_id = ? AND entity_type = ? AND entity_id = ?',
      [userId, entityType, entityId]
    );

    return rows[0]?.vote_type || null;
  }

  /**
   * Приватні методи
   */

  static async _updateAuthorReputation(entityType, entityId, voteType) {
    const tableMap = {
      question: 'questions',
      answer: 'answers',
      content: 'content_items',
      content_answer: 'content_answers',
    };
    const table = tableMap[entityType];
    if (!table) return;

    const delta = voteType === 'up' ? 10 : -5;
    const [rows] = await pool.execute(`SELECT author_id FROM ${table} WHERE id = ?`, [entityId]);

    if (rows.length > 0) {
      await pool.execute('UPDATE users SET reputation = reputation + ? WHERE id = ?', [
        delta,
        rows[0].author_id,
      ]);
    }
  }
}

export default Vote;
