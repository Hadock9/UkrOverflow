/**
 * Модель CommunityPost — пости у спільнотах (різні типи: discussion, pet_project тощо).
 */

import pool from '../config/database.js';
import Community from './Community.js';
import { Question } from './Question.js';
import { LINKABLE_HUB_TYPES } from '../constants/contentTypes.js';
import { normalizeTagList } from '../utils/tagNormalize.js';
import { voteTotalExpr } from '../utils/voteSql.js';

const ALLOWED_TYPES = ['discussion', 'pet_project', 'code_review', 'mentor_request', 'roadmap_request', 'team_search', 'event', 'announcement'];
const ALLOWED_STATUSES = ['open', 'closed', 'filled'];
const ALLOWED_SORTS = ['created_at', 'votes', 'views', 'comment_count'];

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function decorate(row) {
  if (!row) return row;
  row.metadata = parseJson(row.metadata, {});
  row.stack = parseJson(row.stack, []);
  return row;
}

function normalizeLinkedType(t) {
  if (!t) return null;
  const s = String(t).trim();
  return LINKABLE_HUB_TYPES.includes(s) ? s : null;
}

export class CommunityPost {
  static async create({
    communityId,
    authorId,
    type,
    title,
    body,
    metadata,
    stack,
    status,
    linkedContentType,
    linkedContentId,
  }) {
    const cleanType = ALLOWED_TYPES.includes(type) ? type : 'discussion';
    const cleanStatus = ALLOWED_STATUSES.includes(status) ? status : 'open';
    const lt = normalizeLinkedType(linkedContentType);
    const lid = linkedContentId != null && linkedContentId !== '' ? parseInt(linkedContentId, 10) : null;
    const linkedType = lt && lid > 0 ? lt : null;
    const linkedId = linkedType ? lid : null;

    const [result] = await pool.execute(
      `INSERT INTO community_posts (community_id, author_id, type, title, body, metadata, stack, status, linked_content_type, linked_content_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        communityId,
        authorId,
        cleanType,
        title,
        body,
        JSON.stringify(metadata || {}),
        JSON.stringify(normalizeTagList(Array.isArray(stack) ? stack : [])),
        cleanStatus,
        linkedType,
        linkedId,
      ]
    );
    await Community.incrementPostCount(communityId);
    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT p.*,
              u.username as author_name, u.avatar_url as author_avatar, u.github_login as author_github,
              c.slug as community_slug, c.name as community_name, c.type as community_type,
              ${voteTotalExpr('community_post', 'p.id')} AS votes
       FROM community_posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN communities c ON p.community_id = c.id
       WHERE p.id = ?`,
      [id]
    );
    return decorate(rows[0]) || null;
  }

  static async list({ communityId, type, status, authorId, stack, search, page = 1, limit = 20, sort = 'created_at' } = {}) {
    const sortField = ALLOWED_SORTS.includes(sort) ? sort : 'created_at';
    const orderExpr = sortField === 'votes'
      ? voteTotalExpr('community_post', 'p.id')
      : `p.${sortField}`;
    const limitN = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitN;

    let where = 'WHERE 1=1';
    const params = [];

    if (communityId) {
      where += ' AND p.community_id = ?';
      params.push(communityId);
    }
    if (type && ALLOWED_TYPES.includes(type)) {
      where += ' AND p.type = ?';
      params.push(type);
    }
    if (status && ALLOWED_STATUSES.includes(status)) {
      where += ' AND p.status = ?';
      params.push(status);
    }
    if (authorId) {
      where += ' AND p.author_id = ?';
      params.push(authorId);
    }
    if (search) {
      where += ' AND (p.title LIKE ? OR p.body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (Array.isArray(stack) && stack.length > 0) {
      const orClauses = stack.map(() => 'JSON_CONTAINS(LOWER(p.stack), LOWER(?))');
      where += ` AND (${orClauses.join(' OR ')})`;
      stack.forEach((s) => params.push(JSON.stringify(String(s))));
    }

    const sql = `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar,
                        c.slug as community_slug, c.name as community_name, c.type as community_type,
                        ${voteTotalExpr('community_post', 'p.id')} AS votes
                 FROM community_posts p
                 LEFT JOIN users u ON p.author_id = u.id
                 LEFT JOIN communities c ON p.community_id = c.id
                 ${where}
                 ORDER BY ${orderExpr} DESC
                 LIMIT ${limitN} OFFSET ${offset}`;

    const [rows] = params.length ? await pool.execute(sql, params) : await pool.query(sql);
    rows.forEach(decorate);

    const countSql = `SELECT COUNT(*) as total FROM community_posts p ${where}`;
    const [[{ total }]] = params.length ? await pool.execute(countSql, params) : await pool.query(countSql);

    return {
      posts: rows,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: limitN,
        total,
        totalPages: Math.ceil(total / limitN),
      },
    };
  }

  /**
   * Пости спільноти, де стек перетинається з тегами питання (JSON_OVERLAPS).
   */
  static async findRelatedByQuestionTags(questionId, { limit = 8 } = {}) {
    const limitN = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 30);
    const question = await Question.findById(questionId);
    if (!question) {
      return { posts: [], pagination: { total: 0, limit: limitN, page: 1, totalPages: 0 } };
    }
    let tags = normalizeTagList(Array.isArray(question.tags) ? question.tags : []);
    if (!tags.length) {
      return { posts: [], pagination: { total: 0, limit: limitN, page: 1, totalPages: 0 } };
    }
    tags = tags.slice(0, 15);
    const tagsJson = JSON.stringify(tags);

    let rows;
    try {
      [rows] = await pool.execute(
        `SELECT p.*, u.username AS author_name, u.avatar_url AS author_avatar,
                c.slug AS community_slug, c.name AS community_name, c.type AS community_type
         FROM community_posts p
         LEFT JOIN users u ON p.author_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         WHERE JSON_OVERLAPS(COALESCE(p.stack, CAST('[]' AS JSON)), CAST(? AS JSON))
         ORDER BY p.created_at DESC
         LIMIT ${limitN}`,
        [tagsJson]
      );
    } catch {
      const likes = tags.map(() => '(p.stack LIKE ?)').join(' OR ');
      const likeParams = tags.map((t) => `%${String(t)}%`);
      [rows] = await pool.execute(
        `SELECT p.*, u.username AS author_name, u.avatar_url AS author_avatar,
                c.slug AS community_slug, c.name AS community_name, c.type AS community_type
         FROM community_posts p
         LEFT JOIN users u ON p.author_id = u.id
         LEFT JOIN communities c ON p.community_id = c.id
         WHERE (${likes})
         ORDER BY p.created_at DESC
         LIMIT ${limitN}`,
        likeParams
      );
    }
    rows.forEach(decorate);
    return {
      posts: rows,
      pagination: { total: rows.length, limit: limitN, page: 1, totalPages: 1 },
    };
  }

  static async update(id, { type, title, body, metadata, stack, status, linkedContentType, linkedContentId }) {
    const updates = [];
    const values = [];
    if (type !== undefined && ALLOWED_TYPES.includes(type)) { updates.push('type = ?'); values.push(type); }
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (body !== undefined) { updates.push('body = ?'); values.push(body); }
    if (metadata !== undefined) { updates.push('metadata = ?'); values.push(JSON.stringify(metadata || {})); }
    if (stack !== undefined) { updates.push('stack = ?'); values.push(JSON.stringify(normalizeTagList(Array.isArray(stack) ? stack : []))); }
    if (status !== undefined && ALLOWED_STATUSES.includes(status)) { updates.push('status = ?'); values.push(status); }

    if (linkedContentType !== undefined || linkedContentId !== undefined) {
      const lt = normalizeLinkedType(linkedContentType);
      const lid = linkedContentId != null && linkedContentId !== '' ? parseInt(linkedContentId, 10) : null;
      if (lt && lid > 0) {
        updates.push('linked_content_type = ?');
        updates.push('linked_content_id = ?');
        values.push(lt, lid);
      } else {
        updates.push('linked_content_type = NULL');
        updates.push('linked_content_id = NULL');
      }
    }

    if (!updates.length) return this.findById(id);
    values.push(id);
    await pool.execute(`UPDATE community_posts SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    const [rows] = await pool.execute('SELECT community_id FROM community_posts WHERE id = ?', [id]);
    if (!rows.length) return;
    await pool.execute('DELETE FROM community_posts WHERE id = ?', [id]);
    await Community.decrementPostCount(rows[0].community_id);
  }

  static async recordView(id) {
    await pool.execute('UPDATE community_posts SET views = views + 1 WHERE id = ?', [id]);
  }

  static async incrementCommentCount(id) {
    await pool.execute('UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?', [id]);
  }

  static async decrementCommentCount(id) {
    await pool.execute('UPDATE community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = ?', [id]);
  }
}

export default CommunityPost;
