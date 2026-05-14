/**
 * Модель Guide для knowledge hub.
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

export class Guide {
  static async create({ title, summary, body, difficulty, estimatedMinutes, tags, authorId }) {
    const excerpt = buildExcerpt(summary, body);
    const [result] = await pool.execute(
      `INSERT INTO guides (title, summary, excerpt, body, difficulty, estimated_minutes, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, summary, excerpt, body, difficulty, estimatedMinutes, JSON.stringify(tags), authorId]
    );

    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT g.*, u.username as author_name
       FROM guides g
       JOIN users u ON g.author_id = u.id
       WHERE g.id = ?`,
      [id]
    );

    if (rows[0]) {
      try {
        rows[0].tags = typeof rows[0].tags === 'string' ? JSON.parse(rows[0].tags) : rows[0].tags || [];
      } catch (e) {
        console.error('Failed to parse guide tags:', rows[0].tags, e);
        rows[0].tags = [];
      }
      rows[0].type = CONTENT_TYPES.GUIDE;
      rows[0].votes = 0;
      rows[0].answers_count = 0;
    }

    return rows[0] || null;
  }

  static async recordView(guideId, viewerKey) {
    if (!viewerKey || viewerKey.length > 96) {
      throw new Error('Некоректний ключ глядача');
    }

    const [exists] = await pool.execute('SELECT id FROM guides WHERE id = ?', [guideId]);
    if (!exists.length) {
      return null;
    }

    try {
      const [insertResult] = await pool.execute(
        `INSERT IGNORE INTO guide_views (guide_id, viewer_key, viewed_at)
         VALUES (?, ?, NOW())`,
        [guideId, viewerKey]
      );

      if (insertResult.affectedRows === 1) {
        await pool.execute('UPDATE guides SET views = views + 1 WHERE id = ?', [guideId]);
      }

      const [[{ views }]] = await pool.execute('SELECT views FROM guides WHERE id = ?', [guideId]);
      return { counted: insertResult.affectedRows === 1, views };
    } catch (err) {
      const noTable =
        err?.code === 'ER_NO_SUCH_TABLE' ||
        err?.errno === 1146 ||
        String(err?.sqlMessage || err?.message || '').includes('guide_views');
      if (!noTable) throw err;
      console.warn('[Guide] Немає таблиці guide_views — виконайте `npm run migrate`. Тимчасовий режим: +1 без дедуплікації.');
      await pool.execute('UPDATE guides SET views = views + 1 WHERE id = ?', [guideId]);
      const [[{ views }]] = await pool.execute('SELECT views FROM guides WHERE id = ?', [guideId]);
      return { counted: true, views };
    }
  }

  static async list({ page = 1, limit = 20, sortBy = 'created_at', tag = null, authorId = null, search = null } = {}) {
    const offset = (page - 1) * limit;
    const sort = ['created_at', 'views'].includes(sortBy) ? sortBy : 'created_at';

    let query = `
      SELECT g.*, u.username as author_name
      FROM guides g
      JOIN users u ON g.author_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (tag) {
      query += ' AND JSON_CONTAINS(g.tags, ?)';
      params.push(JSON.stringify(tag));
    }

    if (authorId) {
      query += ' AND g.author_id = ?';
      params.push(authorId);
    }

    if (search) {
      query += ' AND (g.title LIKE ? OR g.summary LIKE ? OR g.body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY g.${sort} DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
    const [rows] = params.length > 0 ? await pool.execute(query, params) : await pool.query(query);

    rows.forEach((row) => {
      try {
        row.tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
      } catch (e) {
        console.error('Failed to parse guide tags:', row.tags, e);
        row.tags = [];
      }
      row.type = CONTENT_TYPES.GUIDE;
      row.votes = 0;
      row.answers_count = 0;
    });

    let countQuery = 'SELECT COUNT(*) as total FROM guides WHERE 1=1';
    const countParams = [];

    if (tag) {
      countQuery += ' AND JSON_CONTAINS(tags, ?)';
      countParams.push(JSON.stringify(tag));
    }

    if (authorId) {
      countQuery += ' AND author_id = ?';
      countParams.push(authorId);
    }

    if (search) {
      countQuery += ' AND (title LIKE ? OR summary LIKE ? OR body LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.execute(countQuery, countParams);

    return {
      guides: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async update(id, { title, summary, body, difficulty, estimatedMinutes, tags }) {
    const updates = [];
    const values = [];
    const nextSummary = summary;
    const nextBody = body;

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (summary !== undefined) {
      updates.push('summary = ?');
      values.push(summary);
    }
    if (body !== undefined) {
      updates.push('body = ?');
      values.push(body);
    }
    if (summary !== undefined || body !== undefined) {
      updates.push('excerpt = ?');
      values.push(buildExcerpt(nextSummary, nextBody));
    }
    if (difficulty !== undefined) {
      updates.push('difficulty = ?');
      values.push(difficulty);
    }
    if (estimatedMinutes !== undefined) {
      updates.push('estimated_minutes = ?');
      values.push(estimatedMinutes);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(tags));
    }

    if (updates.length === 0) throw new Error('Немає даних для оновлення');

    updates.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(`UPDATE guides SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM guides WHERE id = ?', [id]);
  }

  static async getTags() {
    const [rows] = await pool.execute('SELECT tags FROM guides');
    const tagMap = new Map();

    rows.forEach((row) => {
      try {
        const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
        tags.forEach((tag) => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      } catch (e) {
        console.error('Failed to parse guide tags:', row.tags, e);
      }
    });

    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}

export default Guide;
