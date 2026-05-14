/**
 * Модель для сповіщень — усі основні події агрегуються тут.
 */

import pool from '../config/database.js';
import CommunityPost from './CommunityPost.js';
import CommunityComment from './CommunityComment.js';
import Community from './Community.js';

function pickActorId(data) {
  if (!data || typeof data !== 'object') return null;
  const id = data.actorId ?? data.answerAuthorId ?? data.voterId ?? data.memberId;
  return id != null ? parseInt(id, 10) : null;
}

class Notification {
  static async create(userId, type, entityType, entityId, data = {}) {
    const actorId = pickActorId(data);
    try {
      const [result] = await pool.execute(
        `INSERT INTO notifications (user_id, type, entity_type, entity_id, data, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, type, entityType, entityId, JSON.stringify(data), actorId || null]
      );

      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        `SELECT n.*,
                actor.username as actor_name
         FROM notifications n
         LEFT JOIN users actor ON n.actor_id = actor.id
         WHERE n.id = ?`,
        [id]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('Error finding notification:', error);
      throw error;
    }
  }

  static async findByUserId(userId, options = {}) {
    const { unreadOnly = false, limit = 20, offset = 0 } = options;

    try {
      let query = `
        SELECT n.*,
               actor.username as actor_name,
               COALESCE(
                 q.title,
                 q_from_ans.title,
                 cp.title,
                 cm.name
               ) AS context_title
        FROM notifications n
        LEFT JOIN users actor ON n.actor_id = actor.id
        LEFT JOIN questions q ON n.entity_type = 'question' AND n.entity_id = q.id
        LEFT JOIN answers a ON n.entity_type = 'answer' AND n.entity_id = a.id
        LEFT JOIN questions q_from_ans ON a.question_id = q_from_ans.id
        LEFT JOIN community_posts cp ON n.entity_type = 'community_post' AND n.entity_id = cp.id
        LEFT JOIN communities cm ON n.entity_type = 'community' AND n.entity_id = cm.id
        WHERE n.user_id = ?
      `;

      const params = [userId];

      if (unreadOnly) {
        query += ' AND n.is_read = FALSE';
      }

      query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [rows] = await pool.execute(query, params);
      return rows.map((row) => ({
        ...row,
        question_title: row.context_title,
      }));
    } catch (error) {
      console.error('Error finding notifications:', error);
      throw error;
    }
  }

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

  static async notifyQuestionAnswer(questionId, answerAuthorId) {
    try {
      const [questions] = await pool.execute(
        'SELECT author_id FROM questions WHERE id = ?',
        [questionId]
      );

      if (!questions[0]) return;

      const questionAuthorId = questions[0].author_id;

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

  static async notifyAnswerAccepted(answerId) {
    try {
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

  static async notifyVote(entityType, entityId, voteType, voterId) {
    try {
      if (voteType !== 'up') return;

      const table = entityType === 'question' ? 'questions' : 'answers';
      const [entities] = await pool.execute(
        `SELECT author_id FROM ${table} WHERE id = ?`,
        [entityId]
      );

      if (!entities[0]) return;

      const authorId = entities[0].author_id;

      if (authorId === voterId) return;

      const data = { voteType, voterId, actorId: voterId };
      if (entityType === 'answer') {
        const [a] = await pool.execute(
          'SELECT question_id FROM answers WHERE id = ?',
          [entityId]
        );
        if (a[0]) data.questionId = a[0].question_id;
      }

      await this.create(
        authorId,
        'vote',
        entityType,
        entityId,
        data
      );
    } catch (error) {
      console.error('Error creating vote notification:', error);
    }
  }

  /** Новий коментар / відповідь у треді до поста спільноти */
  static async notifyCommunityCommentActivity(postId, commentAuthorId, commentId, parentId) {
    try {
      if (parentId) {
        const parent = await CommunityComment.findById(parentId);
        if (!parent || parent.author_id === commentAuthorId) return;
        await this.create(
          parent.author_id,
          'community_post_reply',
          'community_post',
          postId,
          { actorId: commentAuthorId, commentId, parentId }
        );
        return;
      }
      const post = await CommunityPost.findById(postId);
      if (!post || post.author_id === commentAuthorId) return;
      await this.create(
        post.author_id,
        'community_post_comment',
        'community_post',
        postId,
        { actorId: commentAuthorId, commentId }
      );
    } catch (error) {
      console.error('Error creating community comment notification:', error);
    }
  }

  /** Новий пост у спільноті — власник отримує сповіщення */
  static async notifyNewCommunityPost(communityId, postId, authorId) {
    try {
      const community = await Community.findById(communityId);
      if (!community) return;
      if (community.owner_id === authorId) return;
      await this.create(
        community.owner_id,
        'community_new_post',
        'community_post',
        postId,
        { actorId: authorId, communityId, slug: community.slug }
      );
    } catch (error) {
      console.error('Error creating new community post notification:', error);
    }
  }

  /** Користувач приєднався до спільноти */
  static async notifyCommunityJoin(communityId, memberId) {
    try {
      const community = await Community.findById(communityId);
      if (!community) return;
      if (community.owner_id === memberId) return;
      await this.create(
        community.owner_id,
        'community_join',
        'community',
        communityId,
        { memberId, actorId: memberId, slug: community.slug, communityName: community.name }
      );
    } catch (error) {
      console.error('Error creating community join notification:', error);
    }
  }

  /** Питання додали в закладки */
  static async notifyQuestionBookmarked(questionId, bookmarkUserId) {
    try {
      const [rows] = await pool.execute(
        'SELECT author_id, title FROM questions WHERE id = ?',
        [questionId]
      );
      if (!rows[0]) return;
      const { author_id: authorId, title } = rows[0];
      if (authorId === bookmarkUserId) return;
      await this.create(
        authorId,
        'question_bookmark',
        'question',
        questionId,
        { actorId: bookmarkUserId, title }
      );
    } catch (error) {
      console.error('Error creating bookmark notification:', error);
    }
  }
}

export default Notification;
