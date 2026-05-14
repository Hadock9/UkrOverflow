/**
 * Модель Roadmap для knowledge hub.
 */

import pool from '../config/database.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';

function buildExcerpt(summary, body) {
  const source = (summary || body || '')
    .replace(/[#>*_`\-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!source) return '';
  return source.length > 280 ? `${source.slice(0, 277)}...` : source;
}

function parseJsonColumn(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function decorate(row) {
  if (!row) return row;
  row.tags = parseJsonColumn(row.tags, []);
  row.steps = parseJsonColumn(row.steps, []);
  row.type = CONTENT_TYPES.ROADMAP;
  row.votes = 0;
  row.answers_count = 0;
  return row;
}

export class Roadmap {
  static async create({ title, summary, body, steps, difficulty, estimatedWeeks, tags, authorId }) {
    const excerpt = buildExcerpt(summary, body);
    const [result] = await pool.execute(
      `INSERT INTO roadmaps (title, summary, excerpt, body, steps, difficulty, estimated_weeks, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        title,
        summary,
        excerpt,
        body,
        JSON.stringify(steps || []),
        difficulty,
        estimatedWeeks,
        JSON.stringify(tags || []),
        authorId,
      ]
    );
    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT r.*, u.username as author_name
       FROM roadmaps r JOIN users u ON r.author_id = u.id
       WHERE r.id = ?`,
      [id]
    );
    return decorate(rows[0]) || null;
  }

  static async recordView(roadmapId, viewerKey) {
    if (!viewerKey || viewerKey.length > 96) throw new Error('Некоректний ключ глядача');
    const [exists] = await pool.execute('SELECT id FROM roadmaps WHERE id = ?', [roadmapId]);
    if (!exists.length) return null;

    try {
      const [r] = await pool.execute(
        `INSERT IGNORE INTO roadmap_views (roadmap_id, viewer_key, viewed_at) VALUES (?, ?, NOW())`,
        [roadmapId, viewerKey]
      );
      if (r.affectedRows === 1) {
        await pool.execute('UPDATE roadmaps SET views = views + 1 WHERE id = ?', [roadmapId]);
      }
      const [[{ views }]] = await pool.execute('SELECT views FROM roadmaps WHERE id = ?', [roadmapId]);
      return { counted: r.affectedRows === 1, views };
    } catch (err) {
      if (err?.code !== 'ER_NO_SUCH_TABLE' && err?.errno !== 1146) throw err;
      console.warn('[Roadmap] Немає roadmap_views — запустіть `npm run migrate`.');
      await pool.execute('UPDATE roadmaps SET views = views + 1 WHERE id = ?', [roadmapId]);
      const [[{ views }]] = await pool.execute('SELECT views FROM roadmaps WHERE id = ?', [roadmapId]);
      return { counted: true, views };
    }
  }

  static async list({ page = 1, limit = 20, sortBy = 'created_at', tag = null, authorId = null, search = null } = {}) {
    const offset = (page - 1) * limit;
    const sort = ['created_at', 'views'].includes(sortBy) ? sortBy : 'created_at';

    let query = `SELECT r.*, u.username as author_name FROM roadmaps r JOIN users u ON r.author_id = u.id WHERE 1=1`;
    const params = [];

    if (tag) {
      query += ' AND JSON_CONTAINS(r.tags, ?)';
      params.push(JSON.stringify(tag));
    }
    if (authorId) {
      query += ' AND r.author_id = ?';
      params.push(authorId);
    }
    if (search) {
      query += ' AND (r.title LIKE ? OR r.summary LIKE ? OR r.body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY r.${sort} DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
    const [rows] = params.length ? await pool.execute(query, params) : await pool.query(query);
    rows.forEach(decorate);

    let countQuery = 'SELECT COUNT(*) as total FROM roadmaps WHERE 1=1';
    const cp = [];
    if (tag) { countQuery += ' AND JSON_CONTAINS(tags, ?)'; cp.push(JSON.stringify(tag)); }
    if (authorId) { countQuery += ' AND author_id = ?'; cp.push(authorId); }
    if (search) { countQuery += ' AND (title LIKE ? OR summary LIKE ? OR body LIKE ?)'; cp.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const [[{ total }]] = await pool.execute(countQuery, cp);

    return { roadmaps: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async update(id, { title, summary, body, steps, difficulty, estimatedWeeks, tags }) {
    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (summary !== undefined) { updates.push('summary = ?'); values.push(summary); }
    if (body !== undefined) { updates.push('body = ?'); values.push(body); }
    if (summary !== undefined || body !== undefined) {
      updates.push('excerpt = ?'); values.push(buildExcerpt(summary, body));
    }
    if (steps !== undefined) { updates.push('steps = ?'); values.push(JSON.stringify(steps)); }
    if (difficulty !== undefined) { updates.push('difficulty = ?'); values.push(difficulty); }
    if (estimatedWeeks !== undefined) { updates.push('estimated_weeks = ?'); values.push(estimatedWeeks); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
    if (!updates.length) throw new Error('Немає даних для оновлення');
    updates.push('updated_at = NOW()');
    values.push(id);
    await pool.execute(`UPDATE roadmaps SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM roadmaps WHERE id = ?', [id]);
  }

  static async getTags() {
    const [rows] = await pool.execute('SELECT tags FROM roadmaps');
    const tagMap = new Map();
    rows.forEach((row) => {
      const tags = parseJsonColumn(row.tags, []);
      tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    });
    return Array.from(tagMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }
}

export default Roadmap;
