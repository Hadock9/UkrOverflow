/**
 * Модель CommunityComment — коментарі до community_posts.
 */

import pool from '../config/database.js';
import CommunityPost from './CommunityPost.js';

export class CommunityComment {
  static async create({ postId, authorId, parentId = null, body }) {
    const [result] = await pool.execute(
      `INSERT INTO community_post_comments (post_id, author_id, parent_id, body)
       VALUES (?, ?, ?, ?)`,
      [postId, authorId, parentId || null, body]
    );
    await CommunityPost.incrementCommentCount(postId);
    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT c.*, u.username as author_name, u.avatar_url as author_avatar
       FROM community_post_comments c
       LEFT JOIN users u ON c.author_id = u.id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async listByPost(postId) {
    const [rows] = await pool.execute(
      `SELECT c.id, c.post_id, c.author_id, c.parent_id, c.body, c.votes, c.created_at, c.updated_at,
              u.username as author_name, u.avatar_url as author_avatar
       FROM community_post_comments c
       LEFT JOIN users u ON c.author_id = u.id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [postId]
    );
    return rows;
  }

  static async delete(id) {
    const [rows] = await pool.execute('SELECT post_id FROM community_post_comments WHERE id = ?', [id]);
    if (!rows.length) return;
    await pool.execute('DELETE FROM community_post_comments WHERE id = ?', [id]);
    await CommunityPost.decrementCommentCount(rows[0].post_id);
  }
}

export default CommunityComment;
