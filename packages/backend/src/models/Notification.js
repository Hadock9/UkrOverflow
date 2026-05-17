/**
 * Сповіщення — централізована модель подій платформи.
 */

import pool from '../config/database.js';
import CommunityPost from './CommunityPost.js';
import CommunityComment from './CommunityComment.js';
import Community from './Community.js';
import { hubTableForType } from '../utils/hubTables.js';
import { VOTE_AUTHOR_TABLE } from '../constants/voteEntityTypes.js';

function pickActorId(data) {
  if (!data || typeof data !== 'object') return null;
  const id =
    data.actorId ??
    data.answerAuthorId ??
    data.voterId ??
    data.memberId ??
    data.commentAuthorId;
  return id != null ? parseInt(id, 10) : null;
}

const AUTHOR_TABLE = {
  ...VOTE_AUTHOR_TABLE,
};

class Notification {
  static async create(userId, type, entityType, entityId, data = {}) {
    const recipientId = parseInt(userId, 10);
    const actorId = pickActorId(data);
    if (actorId && recipientId === actorId) return null;

    try {
      const [result] = await pool.execute(
        `INSERT INTO notifications (user_id, type, entity_type, entity_id, data, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [recipientId, type, entityType, entityId, JSON.stringify(data), actorId || null]
      );
      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  /** Уникати спаму при повторних однакових діях */
  static async hasRecent(userId, type, entityType, entityId, actorId, minutes = 30) {
    const [rows] = await pool.execute(
      `SELECT id FROM notifications
       WHERE user_id = ? AND type = ? AND entity_type = ? AND entity_id = ?
         AND (actor_id <=> ?) AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
       LIMIT 1`,
      [userId, type, entityType, entityId, actorId ?? null, minutes]
    );
    return rows.length > 0;
  }

  static async createOnce(userId, type, entityType, entityId, data = {}, minutes = 30) {
    const actorId = pickActorId(data);
    if (await this.hasRecent(userId, type, entityType, entityId, actorId, minutes)) {
      return null;
    }
    return this.create(userId, type, entityType, entityId, data);
  }

  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        `SELECT n.*, actor.username AS actor_name
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
               actor.username AS actor_name,
               COALESCE(
                 q.title,
                 q_from_ans.title,
                 cp.title,
                 cm.name,
                 np.title,
                 ci.title,
                 ci_from_ca.title
               ) AS context_title,
               COALESCE(ci.type, ci_from_ca.type) AS content_type,
               np.slug AS news_slug,
               cm.slug AS community_slug
        FROM notifications n
        LEFT JOIN users actor ON n.actor_id = actor.id
        LEFT JOIN questions q ON n.entity_type = 'question' AND n.entity_id = q.id
        LEFT JOIN answers a ON n.entity_type = 'answer' AND n.entity_id = a.id
        LEFT JOIN questions q_from_ans ON a.question_id = q_from_ans.id
        LEFT JOIN community_posts cp ON n.entity_type = 'community_post' AND n.entity_id = cp.id
        LEFT JOIN communities cm ON n.entity_type = 'community' AND n.entity_id = cm.id
        LEFT JOIN news_posts np ON n.entity_type = 'news_post' AND n.entity_id = np.id
        LEFT JOIN content_items ci ON n.entity_type = 'content' AND n.entity_id = ci.id
        LEFT JOIN content_answers ca ON n.entity_type = 'content_answer' AND n.entity_id = ca.id
        LEFT JOIN content_items ci_from_ca ON ca.content_id = ci_from_ca.id
        WHERE n.user_id = ?
      `;

      const params = [userId];
      if (unreadOnly) query += ' AND n.is_read = FALSE';
      query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [rows] = await pool.execute(query, params);
      return rows.map((row) => Notification._enrichRow(row));
    } catch (error) {
      console.error('Error finding notifications:', error);
      throw error;
    }
  }

  static async countUnread(userId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
    return Number(rows[0]?.count) || 0;
  }

  /** Нормалізація рядка для API: data як об'єкт, узгоджений заголовок контексту. */
  static _enrichRow(row) {
    let data = row.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    if (!data || typeof data !== 'object') data = {};

    const contextTitle =
      row.context_title ||
      data.title ||
      data.postTitle ||
      (row.type === 'community_join' || row.type === 'community_welcome'
        ? data.communityName
        : null) ||
      null;

    return {
      ...row,
      data,
      context_title: contextTitle,
      question_title: contextTitle,
      is_read: row.is_read === true || row.is_read === 1,
    };
  }

  static async markAsRead(id, userId) {
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return true;
  }

  static async markAllAsRead(userId) {
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
    return true;
  }

  static async delete(id, userId) {
    await pool.execute('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
    return true;
  }

  static async resolveEntityAuthor(entityType, entityId) {
    const table = AUTHOR_TABLE[entityType];
    if (!table) return null;
    const [rows] = await pool.execute(`SELECT author_id FROM ${table} WHERE id = ?`, [entityId]);
    return rows[0]?.author_id ?? null;
  }

  static async resolveHubAuthor(hubType, hubId) {
    const table = hubTableForType(hubType);
    if (!table) return null;
    const [rows] = await pool.execute(`SELECT author_id FROM ${table} WHERE id = ?`, [hubId]);
    return rows[0]?.author_id ?? null;
  }

  // ——— Q&A ———

  static async notifyQuestionAnswer(questionId, answerAuthorId) {
    try {
      const [questions] = await pool.execute(
        'SELECT author_id, title FROM questions WHERE id = ?',
        [questionId]
      );
      if (!questions[0]) return;
      const { author_id: authorId, title } = questions[0];
      await this.create(authorId, 'question_answer', 'question', questionId, {
        actorId: answerAuthorId,
        title,
      });
      await this.notifyQuestionActivity(questionId, answerAuthorId);
    } catch (error) {
      console.error('Error creating question answer notification:', error);
    }
  }

  /** Інші автори відповідей на те саме питання */
  static async notifyQuestionActivity(questionId, answerAuthorId) {
    try {
      const [q] = await pool.execute('SELECT author_id, title FROM questions WHERE id = ?', [questionId]);
      if (!q[0]) return;
      const questionAuthorId = q[0].author_id;
      const title = q[0].title;

      const [rows] = await pool.execute(
        `SELECT DISTINCT author_id FROM answers
         WHERE question_id = ? AND author_id NOT IN (?, ?)`,
        [questionId, answerAuthorId, questionAuthorId]
      );

      for (const row of rows) {
        await this.createOnce(
          row.author_id,
          'question_activity',
          'question',
          questionId,
          { actorId: answerAuthorId, title },
          60
        );
      }
    } catch (error) {
      console.error('Error creating question activity notification:', error);
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
      await this.create(author_id, 'answer_accepted', 'answer', answerId, {
        questionId: question_id,
        actorId: null,
      });
    } catch (error) {
      console.error('Error creating answer accepted notification:', error);
    }
  }

  static async notifyVote(entityType, entityId, voteType, voterId) {
    try {
      if (voteType !== 'up') return;

      let authorId = await this.resolveEntityAuthor(entityType, entityId);
      if (!authorId) return;
      if (authorId === voterId) return;

      const data = { voteType, voterId, actorId: voterId };

      if (entityType === 'answer') {
        const [a] = await pool.execute('SELECT question_id FROM answers WHERE id = ?', [entityId]);
        if (a[0]) data.questionId = a[0].question_id;
      }
      if (entityType === 'content_answer') {
        const [a] = await pool.execute(
          'SELECT content_id FROM content_answers WHERE id = ?',
          [entityId]
        );
        if (a[0]) data.contentId = a[0].content_id;
      }
      if (entityType === 'content') {
        const [c] = await pool.execute(
          'SELECT type, title, slug FROM content_items WHERE id = ?',
          [entityId]
        );
        if (c[0]) {
          data.contentType = c[0].type;
          data.title = c[0].title;
          data.slug = c[0].slug;
        }
      }
      if (['article', 'guide', 'snippet', 'roadmap', 'best_practice', 'faq'].includes(entityType)) {
        const table = hubTableForType(entityType);
        if (table) {
          const [c] = await pool.execute(`SELECT title FROM ${table} WHERE id = ?`, [entityId]);
          if (c[0]) data.title = c[0].title;
        }
        data.hubType = entityType;
      }
      if (entityType === 'community_post') {
        const [c] = await pool.execute('SELECT title FROM community_posts WHERE id = ?', [entityId]);
        if (c[0]) data.title = c[0].title;
      }
      if (entityType === 'news_post') {
        const [c] = await pool.execute('SELECT title, slug FROM news_posts WHERE id = ?', [entityId]);
        if (c[0]) {
          data.title = c[0].title;
          data.newsSlug = c[0].slug;
        }
      }

      await this.createOnce(authorId, 'vote', entityType, entityId, data, 15);
    } catch (error) {
      console.error('Error creating vote notification:', error);
    }
  }

  static async notifyQuestionBookmarked(questionId, bookmarkUserId) {
    try {
      const [rows] = await pool.execute(
        'SELECT author_id, title FROM questions WHERE id = ?',
        [questionId]
      );
      if (!rows[0]) return;
      const { author_id: authorId, title } = rows[0];
      await this.createOnce(
        authorId,
        'question_bookmark',
        'question',
        questionId,
        { actorId: bookmarkUserId, title },
        120
      );
    } catch (error) {
      console.error('Error creating bookmark notification:', error);
    }
  }

  // ——— Community ———

  static async notifyCommunityCommentActivity(postId, commentAuthorId, commentId, parentId) {
    try {
      const post = await CommunityPost.findById(postId);
      if (!post) return;

      if (parentId) {
        const parent = await CommunityComment.findById(parentId);
        if (parent && parent.author_id !== commentAuthorId) {
          await this.create(parent.author_id, 'community_post_reply', 'community_post', postId, {
            actorId: commentAuthorId,
            commentId,
            parentId,
            postTitle: post.title,
          });
        }
      } else if (post.author_id !== commentAuthorId) {
        await this.create(post.author_id, 'community_post_comment', 'community_post', postId, {
          actorId: commentAuthorId,
          commentId,
          postTitle: post.title,
        });
      }

      await this.notifyCommunityCommentParticipants(postId, commentAuthorId, commentId, parentId);
    } catch (error) {
      console.error('Error creating community comment notification:', error);
    }
  }

  /** Учасники треду (інші коментатори) */
  static async notifyCommunityCommentParticipants(postId, commentAuthorId, commentId, parentId) {
    const [rows] = await pool.execute(
      `SELECT DISTINCT author_id FROM community_post_comments
       WHERE post_id = ? AND author_id != ?`,
      [postId, commentAuthorId]
    );
    const post = await CommunityPost.findById(postId);
    for (const row of rows) {
      if (row.author_id === post?.author_id && !parentId) continue;
      await this.createOnce(
        row.author_id,
        'community_thread_activity',
        'community_post',
        postId,
        { actorId: commentAuthorId, commentId, postTitle: post?.title },
        45
      );
    }
  }

  static async notifyNewCommunityPost(communityId, postId, authorId) {
    try {
      const community = await Community.findById(communityId);
      if (!community) return;

      const payload = {
        actorId: authorId,
        communityId,
        slug: community.slug,
        communityName: community.name,
      };

      const [members] = await pool.execute(
        `SELECT user_id FROM community_memberships
         WHERE community_id = ? AND user_id != ?`,
        [communityId, authorId]
      );

      for (const m of members) {
        await this.createOnce(
          m.user_id,
          'community_new_post',
          'community_post',
          postId,
          payload,
          10
        );
      }
    } catch (error) {
      console.error('Error creating new community post notification:', error);
    }
  }

  static async notifyCommunityJoin(communityId, memberId) {
    try {
      const community = await Community.findById(communityId);
      if (!community) return;

      if (community.owner_id !== memberId) {
        await this.create(community.owner_id, 'community_join', 'community', communityId, {
          memberId,
          actorId: memberId,
          slug: community.slug,
          communityName: community.name,
        });
      }

      await this.create(memberId, 'community_welcome', 'community', communityId, {
        slug: community.slug,
        communityName: community.name,
      });
    } catch (error) {
      console.error('Error creating community join notification:', error);
    }
  }

  static async notifyCommunityPostStatus(postId, actorId, status) {
    try {
      const post = await CommunityPost.findById(postId);
      if (!post) return;

      const payload = {
        actorId,
        status,
        postTitle: post.title,
        communityId: post.community_id,
      };

      if (post.author_id !== actorId) {
        await this.create(post.author_id, 'community_post_status', 'community_post', postId, payload);
      }

      const [commenters] = await pool.execute(
        `SELECT DISTINCT author_id FROM community_post_comments
         WHERE post_id = ? AND author_id != ?`,
        [postId, actorId]
      );
      for (const c of commenters) {
        if (c.author_id === post.author_id) continue;
        await this.createOnce(
          c.author_id,
          'community_post_status',
          'community_post',
          postId,
          payload,
          60
        );
      }
    } catch (error) {
      console.error('Error creating post status notification:', error);
    }
  }

  static async notifyHubLinkedInPost(post) {
    try {
      if (!post.linked_content_type || !post.linked_content_id) return;
      const hubAuthorId = await this.resolveHubAuthor(
        post.linked_content_type,
        post.linked_content_id
      );
      if (!hubAuthorId || hubAuthorId === post.author_id) return;

      await this.createOnce(
        hubAuthorId,
        'hub_linked_in_post',
        'community_post',
        post.id,
        {
          actorId: post.author_id,
          linkedContentType: post.linked_content_type,
          linkedContentId: post.linked_content_id,
          postTitle: post.title,
        },
        120
      );
    } catch (error) {
      console.error('Error creating hub linked notification:', error);
    }
  }

  // ——— News ———

  static async notifyNewsCommentActivity(newsPostId, commentAuthorId, commentId, parentId) {
    try {
      const [posts] = await pool.execute(
        'SELECT author_id, title, slug FROM news_posts WHERE id = ?',
        [newsPostId]
      );
      if (!posts[0]) return;
      const post = posts[0];

      if (parentId) {
        const [parents] = await pool.execute(
          'SELECT author_id FROM news_comments WHERE id = ?',
          [parentId]
        );
        if (parents[0] && parents[0].author_id !== commentAuthorId) {
          await this.create(parents[0].author_id, 'news_comment_reply', 'news_post', newsPostId, {
            actorId: commentAuthorId,
            commentId,
            parentId,
            title: post.title,
            slug: post.slug,
          });
        }
      } else if (post.author_id !== commentAuthorId) {
        await this.create(post.author_id, 'news_post_comment', 'news_post', newsPostId, {
          actorId: commentAuthorId,
          commentId,
          title: post.title,
          slug: post.slug,
        });
      }

      const [others] = await pool.execute(
        `SELECT DISTINCT author_id FROM news_comments
         WHERE news_post_id = ? AND author_id != ?`,
        [newsPostId, commentAuthorId]
      );
      for (const row of others) {
        if (!parentId && row.author_id === post.author_id) continue;
        await this.createOnce(
          row.author_id,
          'news_thread_activity',
          'news_post',
          newsPostId,
          { actorId: commentAuthorId, commentId, title: post.title, slug: post.slug },
          45
        );
      }
    } catch (error) {
      console.error('Error creating news comment notification:', error);
    }
  }

  static async notifyNewsPublished(newsId, authorId, moderatorId = null) {
    try {
      const [rows] = await pool.execute(
        'SELECT title, slug FROM news_posts WHERE id = ?',
        [newsId]
      );
      if (!rows[0] || !moderatorId || moderatorId === authorId) return;
      await this.create(authorId, 'news_published', 'news_post', newsId, {
        actorId: moderatorId,
        title: rows[0].title,
        slug: rows[0].slug,
      });
    } catch (error) {
      console.error('Error creating news published notification:', error);
    }
  }
}

export default Notification;
