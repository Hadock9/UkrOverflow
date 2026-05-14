/**
 * Модель Snippet для knowledge hub.
 */

import pool from '../config/database.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';

function buildExcerpt(description) {
  const source = (description || '')
    .replace(/[#>*_`\-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!source) return '';
  return source.length > 280 ? `${source.slice(0, 277)}...` : source;
}

export class Snippet {
  static async create({ title, description, code, language, tags, authorId }) {
    const excerpt = buildExcerpt(description);
    const [result] = await pool.execute(
      `INSERT INTO snippets (title, description, excerpt, code, language, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, description, excerpt, code, language, JSON.stringify(tags), authorId]
    );

    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT s.*, u.username as author_name
       FROM snippets s
       JOIN users u ON s.author_id = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (rows[0]) {
      try {
        rows[0].tags = typeof rows[0].tags === 'string' ? JSON.parse(rows[0].tags) : rows[0].tags || [];
      } catch (e) {
        console.error('Failed to parse snippet tags:', rows[0].tags, e);
        rows[0].tags = [];
      }
      rows[0].type = CONTENT_TYPES.SNIPPET;
      rows[0].votes = 0;
      rows[0].answers_count = 0;
      rows[0].body = rows[0].description;
    }

    return rows[0] || null;
  }

  static async recordView(snippetId, viewerKey) {
    if (!viewerKey || viewerKey.length > 96) {
      throw new Error('Некоректний ключ глядача');
    }

    const [exists] = await pool.execute('SELECT id FROM snippets WHERE id = ?', [snippetId]);
    if (!exists.length) {
      return null;
    }

    try {
      const [insertResult] = await pool.execute(
        `INSERT IGNORE INTO snippet_views (snippet_id, viewer_key, viewed_at)
         VALUES (?, ?, NOW())`,
        [snippetId, viewerKey]
      );

      if (insertResult.affectedRows === 1) {
        await pool.execute('UPDATE snippets SET views = views + 1 WHERE id = ?', [snippetId]);
      }

      const [[{ views }]] = await pool.execute('SELECT views FROM snippets WHERE id = ?', [snippetId]);
      return {
        counted: insertResult.affectedRows === 1,
        views,
      };
    } catch (err) {
      const noTable =
        err?.code === 'ER_NO_SUCH_TABLE' ||
        err?.errno === 1146 ||
        String(err?.sqlMessage || err?.message || '').includes('snippet_views');
      if (!noTable) {
        throw err;
      }
      console.warn(
        '[Snippet] Немає таблиці snippet_views — виконайте `npm run migrate`. Тимчасовий режим: +1 без дедуплікації.'
      );
      await pool.execute('UPDATE snippets SET views = views + 1 WHERE id = ?', [snippetId]);
      const [[{ views }]] = await pool.execute('SELECT views FROM snippets WHERE id = ?', [snippetId]);
      return { counted: true, views };
    }
  }

  static async list({ page = 1, limit = 20, sortBy = 'created_at', tag = null, authorId = null, search = null } = {}) {
    const offset = (page - 1) * limit;
    const sort = ['created_at', 'views'].includes(sortBy) ? sortBy : 'created_at';

    let query = `
      SELECT s.*, u.username as author_name
      FROM snippets s
      JOIN users u ON s.author_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (tag) {
      query += ' AND JSON_CONTAINS(s.tags, ?)';
      params.push(JSON.stringify(tag));
    }

    if (authorId) {
      query += ' AND s.author_id = ?';
      params.push(authorId);
    }

    if (search) {
      query += ' AND (s.title LIKE ? OR s.description LIKE ? OR s.code LIKE ? OR s.language LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY s.${sort} DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;

    const [rows] = params.length > 0 ? await pool.execute(query, params) : await pool.query(query);

    rows.forEach((row) => {
      try {
        row.tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
      } catch (e) {
        console.error('Failed to parse snippet tags:', row.tags, e);
        row.tags = [];
      }
      row.type = CONTENT_TYPES.SNIPPET;
      row.votes = 0;
      row.answers_count = 0;
      row.body = row.description;
    });

    let countQuery = 'SELECT COUNT(*) as total FROM snippets WHERE 1=1';
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
      countQuery += ' AND (title LIKE ? OR description LIKE ? OR code LIKE ? OR language LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.execute(countQuery, countParams);

    return {
      snippets: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async update(id, { title, description, code, language, tags }) {
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
      updates.push('excerpt = ?');
      values.push(buildExcerpt(description));
    }

    if (code !== undefined) {
      updates.push('code = ?');
      values.push(code);
    }

    if (language !== undefined) {
      updates.push('language = ?');
      values.push(language);
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(tags));
    }

    if (updates.length === 0) {
      throw new Error('Немає даних для оновлення');
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(`UPDATE snippets SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM snippets WHERE id = ?', [id]);
  }

  static async getTags() {
    const [rows] = await pool.execute('SELECT tags FROM snippets');
    const tagMap = new Map();

    rows.forEach((row) => {
      try {
        const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
        tags.forEach((tag) => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      } catch (e) {
        console.error('Failed to parse snippet tags:', row.tags, e);
      }
    });

    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}

export default Snippet;
