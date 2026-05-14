/**
 * Модель Article для knowledge hub.
 */

import pool from '../config/database.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';

function buildExcerpt(body, explicitExcerpt) {
  const source = (explicitExcerpt || body || '')
    .replace(/[#>*_`\-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!source) return '';
  return source.length > 280 ? `${source.slice(0, 277)}...` : source;
}

export class Article {
  static async create({ title, body, excerpt, tags, authorId }) {
    const normalizedExcerpt = buildExcerpt(body, excerpt);
    const [result] = await pool.execute(
      `INSERT INTO articles (title, body, excerpt, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, body, normalizedExcerpt, JSON.stringify(tags), authorId]
    );

    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT a.*, u.username as author_name
       FROM articles a
       JOIN users u ON a.author_id = u.id
       WHERE a.id = ?`,
      [id]
    );

    if (rows[0]) {
      try {
        rows[0].tags = typeof rows[0].tags === 'string' ? JSON.parse(rows[0].tags) : rows[0].tags || [];
      } catch (e) {
        console.error('Failed to parse article tags:', rows[0].tags, e);
        rows[0].tags = [];
      }
      rows[0].type = CONTENT_TYPES.ARTICLE;
      rows[0].votes = 0;
      rows[0].answers_count = 0;
    }

    return rows[0] || null;
  }

  static async recordView(articleId, viewerKey) {
    if (!viewerKey || viewerKey.length > 96) {
      throw new Error('Некоректний ключ глядача');
    }

    const [exists] = await pool.execute('SELECT id FROM articles WHERE id = ?', [articleId]);
    if (!exists.length) {
      return null;
    }

    try {
      const [insertResult] = await pool.execute(
        `INSERT IGNORE INTO article_views (article_id, viewer_key, viewed_at)
         VALUES (?, ?, NOW())`,
        [articleId, viewerKey]
      );

      if (insertResult.affectedRows === 1) {
        await pool.execute('UPDATE articles SET views = views + 1 WHERE id = ?', [articleId]);
      }

      const [[{ views }]] = await pool.execute('SELECT views FROM articles WHERE id = ?', [articleId]);
      return {
        counted: insertResult.affectedRows === 1,
        views,
      };
    } catch (err) {
      const noTable =
        err?.code === 'ER_NO_SUCH_TABLE' ||
        err?.errno === 1146 ||
        String(err?.sqlMessage || err?.message || '').includes('article_views');
      if (!noTable) {
        throw err;
      }
      console.warn(
        '[Article] Немає таблиці article_views — виконайте `npm run migrate`. Тимчасовий режим: +1 без дедуплікації.'
      );
      await pool.execute('UPDATE articles SET views = views + 1 WHERE id = ?', [articleId]);
      const [[{ views }]] = await pool.execute('SELECT views FROM articles WHERE id = ?', [articleId]);
      return { counted: true, views };
    }
  }

  static async list({ page = 1, limit = 20, sortBy = 'created_at', tag = null, authorId = null, search = null } = {}) {
    const offset = (page - 1) * limit;
    const sort = ['created_at', 'views'].includes(sortBy) ? sortBy : 'created_at';

    let query = `
      SELECT a.*, u.username as author_name
      FROM articles a
      JOIN users u ON a.author_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (tag) {
      query += ' AND JSON_CONTAINS(a.tags, ?)';
      params.push(JSON.stringify(tag));
    }

    if (authorId) {
      query += ' AND a.author_id = ?';
      params.push(authorId);
    }

    if (search) {
      query += ' AND (a.title LIKE ? OR a.body LIKE ? OR a.excerpt LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY a.${sort} DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;

    const [rows] = params.length > 0 ? await pool.execute(query, params) : await pool.query(query);

    rows.forEach((row) => {
      try {
        row.tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
      } catch (e) {
        console.error('Failed to parse article tags:', row.tags, e);
        row.tags = [];
      }
      row.type = CONTENT_TYPES.ARTICLE;
      row.votes = 0;
      row.answers_count = 0;
    });

    let countQuery = 'SELECT COUNT(*) as total FROM articles WHERE 1=1';
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
      countQuery += ' AND (title LIKE ? OR body LIKE ? OR excerpt LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.execute(countQuery, countParams);

    return {
      articles: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async update(id, { title, body, excerpt, tags }) {
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (body !== undefined) {
      updates.push('body = ?');
      values.push(body);
    }

    if (excerpt !== undefined || body !== undefined) {
      const nextExcerpt = buildExcerpt(body, excerpt);
      updates.push('excerpt = ?');
      values.push(nextExcerpt);
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

    await pool.execute(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM articles WHERE id = ?', [id]);
  }

  static async getTags() {
    const [rows] = await pool.execute('SELECT tags FROM articles');
    const tagMap = new Map();

    rows.forEach((row) => {
      try {
        const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
        tags.forEach((tag) => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      } catch (e) {
        console.error('Failed to parse article tags:', row.tags, e);
      }
    });

    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}

export default Article;
