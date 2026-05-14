/**
 * Модель BestPractice для knowledge hub.
 */

import pool from '../config/database.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';

function buildExcerpt(rule, body) {
  const source = (rule || body || '')
    .replace(/[#>*_`\-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source) return '';
  return source.length > 280 ? `${source.slice(0, 277)}...` : source;
}

function parseJson(v, f) {
  if (v === null || v === undefined) return f;
  if (Array.isArray(v) || typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return f; }
}

function decorate(row) {
  if (!row) return row;
  row.tags = parseJson(row.tags, []);
  row.type = CONTENT_TYPES.BEST_PRACTICE;
  row.votes = 0;
  row.answers_count = 0;
  return row;
}

export class BestPractice {
  static async create({ title, rule, body, antiPatterns, category, tags, authorId }) {
    const excerpt = buildExcerpt(rule, body);
    const [result] = await pool.execute(
      `INSERT INTO best_practices (title, rule, excerpt, body, anti_patterns, category, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, rule, excerpt, body, antiPatterns ?? null, category ?? null, JSON.stringify(tags || []), authorId]
    );
    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT b.*, u.username as author_name FROM best_practices b JOIN users u ON b.author_id = u.id WHERE b.id = ?`,
      [id]
    );
    return decorate(rows[0]) || null;
  }

  static async recordView(bpId, viewerKey) {
    if (!viewerKey || viewerKey.length > 96) throw new Error('Некоректний ключ глядача');
    const [exists] = await pool.execute('SELECT id FROM best_practices WHERE id = ?', [bpId]);
    if (!exists.length) return null;
    try {
      const [r] = await pool.execute(
        `INSERT IGNORE INTO best_practice_views (best_practice_id, viewer_key, viewed_at) VALUES (?, ?, NOW())`,
        [bpId, viewerKey]
      );
      if (r.affectedRows === 1) {
        await pool.execute('UPDATE best_practices SET views = views + 1 WHERE id = ?', [bpId]);
      }
      const [[{ views }]] = await pool.execute('SELECT views FROM best_practices WHERE id = ?', [bpId]);
      return { counted: r.affectedRows === 1, views };
    } catch (err) {
      if (err?.code !== 'ER_NO_SUCH_TABLE' && err?.errno !== 1146) throw err;
      console.warn('[BestPractice] Немає best_practice_views — запустіть `npm run migrate`.');
      await pool.execute('UPDATE best_practices SET views = views + 1 WHERE id = ?', [bpId]);
      const [[{ views }]] = await pool.execute('SELECT views FROM best_practices WHERE id = ?', [bpId]);
      return { counted: true, views };
    }
  }

  static async list({ page = 1, limit = 20, sortBy = 'created_at', tag = null, authorId = null, search = null } = {}) {
    const offset = (page - 1) * limit;
    const sort = ['created_at', 'views'].includes(sortBy) ? sortBy : 'created_at';
    let q = `SELECT b.*, u.username as author_name FROM best_practices b JOIN users u ON b.author_id = u.id WHERE 1=1`;
    const params = [];
    if (tag) { q += ' AND JSON_CONTAINS(b.tags, ?)'; params.push(JSON.stringify(tag)); }
    if (authorId) { q += ' AND b.author_id = ?'; params.push(authorId); }
    if (search) {
      q += ' AND (b.title LIKE ? OR b.rule LIKE ? OR b.body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    q += ` ORDER BY b.${sort} DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
    const [rows] = params.length ? await pool.execute(q, params) : await pool.query(q);
    rows.forEach(decorate);

    let cq = 'SELECT COUNT(*) as total FROM best_practices WHERE 1=1';
    const cp = [];
    if (tag) { cq += ' AND JSON_CONTAINS(tags, ?)'; cp.push(JSON.stringify(tag)); }
    if (authorId) { cq += ' AND author_id = ?'; cp.push(authorId); }
    if (search) { cq += ' AND (title LIKE ? OR rule LIKE ? OR body LIKE ?)'; cp.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const [[{ total }]] = await pool.execute(cq, cp);

    return { bestPractices: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async update(id, { title, rule, body, antiPatterns, category, tags }) {
    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (rule !== undefined) { updates.push('rule = ?'); values.push(rule); }
    if (body !== undefined) { updates.push('body = ?'); values.push(body); }
    if (rule !== undefined || body !== undefined) {
      updates.push('excerpt = ?'); values.push(buildExcerpt(rule, body));
    }
    if (antiPatterns !== undefined) { updates.push('anti_patterns = ?'); values.push(antiPatterns); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
    if (!updates.length) throw new Error('Немає даних для оновлення');
    updates.push('updated_at = NOW()');
    values.push(id);
    await pool.execute(`UPDATE best_practices SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM best_practices WHERE id = ?', [id]);
  }

  static async getTags() {
    const [rows] = await pool.execute('SELECT tags FROM best_practices');
    const tagMap = new Map();
    rows.forEach((row) => {
      parseJson(row.tags, []).forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    });
    return Array.from(tagMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }
}

export default BestPractice;
