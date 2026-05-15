/**
 * Коментарі до новин (обговорення як на DOU).
 */

import pool from '../config/database.js';

export class NewsComment {
  static async create({ newsPostId, authorId, parentId = null, body }) {
    const [result] = await pool.execute(
      `INSERT INTO news_comments (news_post_id, author_id, parent_id, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [newsPostId, authorId, parentId || null, body],
    );
    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT c.*, u.username AS author_name
       FROM news_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  static async listByPost(newsPostId) {
    const [rows] = await pool.execute(
      `SELECT c.id, c.news_post_id, c.author_id, c.parent_id, c.body, c.created_at,
              u.username AS author_name
       FROM news_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.news_post_id = ?
       ORDER BY c.created_at ASC`,
      [newsPostId],
    );
    return rows;
  }

  static async countByPost(newsPostId) {
    const [[{ cnt }]] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM news_comments WHERE news_post_id = ?',
      [newsPostId],
    );
    return cnt;
  }
}

export default NewsComment;
