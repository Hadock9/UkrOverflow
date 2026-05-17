/**
 * Модель Vote
 */

import pool from '../config/database.js';
import Notification from './Notification.js';
import { User } from './User.js';
import { VOTE_AUTHOR_TABLE, isVoteEntityType } from '../constants/voteEntityTypes.js';

export class Vote {
  /**
   * Голосування (toggle / зміна типу)
   */
  static async vote({ userId, entityType, entityId, voteType }) {
    if (!isVoteEntityType(entityType)) {
      throw new Error('Невірний тип сутності для голосування');
    }

    const connection = await pool.getConnection();

    let notifyUpvote = false;
    let reputationDelta = 0;

    try {
      await connection.beginTransaction();

      const [existing] = await connection.execute(
        'SELECT * FROM votes WHERE user_id = ? AND entity_type = ? AND entity_id = ?',
        [userId, entityType, entityId]
      );

      if (existing.length > 0) {
        const currentVote = existing[0];

        if (currentVote.vote_type === voteType) {
          await connection.execute('DELETE FROM votes WHERE id = ?', [currentVote.id]);
          reputationDelta = voteType === 'up' ? -10 : 5;
        } else {
          await connection.execute('UPDATE votes SET vote_type = ? WHERE id = ?', [
            voteType,
            currentVote.id,
          ]);
          reputationDelta = voteType === 'up' ? 15 : -15;
          notifyUpvote = voteType === 'up';
        }
      } else {
        await connection.execute(
          'INSERT INTO votes (user_id, entity_type, entity_id, vote_type, created_at) VALUES (?, ?, ?, ?, NOW())',
          [userId, entityType, entityId, voteType]
        );
        reputationDelta = voteType === 'up' ? 10 : -5;
        notifyUpvote = voteType === 'up';
      }

      await connection.commit();

      if (reputationDelta !== 0) {
        await this._applyReputationDelta(entityType, entityId, reputationDelta);
      }

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

  static async getVotes(entityType, entityId) {
    const [rows] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM votes WHERE entity_type = ? AND entity_id = ? AND vote_type = 'up') as upvotes,
        (SELECT COUNT(*) FROM votes WHERE entity_type = ? AND entity_id = ? AND vote_type = 'down') as downvotes`,
      [entityType, entityId, entityType, entityId]
    );

    const upvotes = Number(rows[0]?.upvotes) || 0;
    const downvotes = Number(rows[0]?.downvotes) || 0;

    return {
      upvotes,
      downvotes,
      total: upvotes - downvotes,
    };
  }

  static async getUserVote(userId, entityType, entityId) {
    if (!userId) return null;
    const [rows] = await pool.execute(
      'SELECT vote_type FROM votes WHERE user_id = ? AND entity_type = ? AND entity_id = ?',
      [userId, entityType, entityId]
    );
    return rows[0]?.vote_type || null;
  }

  /** Додає upvotes, downvotes, votes, user_vote до об'єкта сутності */
  static async enrichEntity(entity, entityType, userId = null) {
    if (!entity?.id) return entity;
    const stats = await this.getVotes(entityType, entity.id);
    entity.upvotes = stats.upvotes;
    entity.downvotes = stats.downvotes;
    entity.votes = stats.total;
    entity.user_vote = userId ? await this.getUserVote(userId, entityType, entity.id) : null;
    return entity;
  }

  static async enrichMany(entities, entityType, userId = null) {
    if (!Array.isArray(entities) || !entities.length) return entities;
    await Promise.all(entities.map((e) => this.enrichEntity(e, entityType, userId)));
    return entities;
  }

  static async _applyReputationDelta(entityType, entityId, delta) {
    const table = VOTE_AUTHOR_TABLE[entityType];
    if (!table || !delta) return;

    const [rows] = await pool.execute(`SELECT author_id FROM ${table} WHERE id = ?`, [entityId]);
    if (rows.length > 0 && rows[0].author_id) {
      await User.updateReputation(rows[0].author_id, delta);
    }
  }
}

export default Vote;
