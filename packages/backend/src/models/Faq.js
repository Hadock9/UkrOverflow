/**
 * Модель Faq для knowledge hub.
 */

import pool from '../config/database.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';

function buildExcerpt(text) {
  const source = (text || '')
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
  row.qa_pairs = parseJson(row.qa_pairs, []);
  row.type = CONTENT_TYPES.FAQ;
  row.votes = 0;
  row.answers_count = 0;
  return row;
}

export class Faq {
  static async create({ title, topic, body, qaPairs, tags, authorId }) {
    const excerpt = buildExcerpt(body);
    const [result] = await pool.execute(
      `INSERT INTO faqs (title, topic, excerpt, body, qa_pairs, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, topic, excerpt, body, JSON.stringify(qaPairs || []), JSON.stringify(tags || []), authorId]
    );
    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT f.*, u.username as author_name FROM faqs f JOIN users u ON f.author_id = u.id WHERE f.id = ?`,
      [id]
    );
    return decorate(rows[0]) || null;
  }

  static async recordView(faqId, viewerKey) {
    if (!viewerKey || viewerKey.length > 96) throw new Error('Некоректний ключ глядача');
    const [exists] = await pool.execute('SELECT id FROM faqs WHERE id = ?', [faqId]);
    if (!exists.length) return null;
    try {
      const [r] = await pool.execute(
        `INSERT IGNORE INTO faq_views (faq_id, viewer_key, viewed_at) VALUES (?, ?, NOW())`,
        [faqId, viewerKey]
      );
      if (r.affectedRows === 1) {
        await pool.execute('UPDATE faqs SET views = views + 1 WHERE id = ?', [faqId]);
      }
      const [[{ views }]] = await pool.execute('SELECT views FROM faqs WHERE id = ?', [faqId]);
      return { counted: r.affectedRows === 1, views };
    } catch (err) {
      if (err?.code !== 'ER_NO_SUCH_TABLE' && err?.errno !== 1146) throw err;
      console.warn('[Faq] Немає faq_views — запустіть `npm run migrate`.');
      await pool.execute('UPDATE faqs SET views = views + 1 WHERE id = ?', [faqId]);
      const [[{ views }]] = await pool.execute('SELECT views FROM faqs WHERE id = ?', [faqId]);
      return { counted: true, views };
    }
  }

  static async list({ page = 1, limit = 20, sortBy = 'created_at', tag = null, authorId = null, search = null } = {}) {
    const offset = (page - 1) * limit;
    const sort = ['created_at', 'views'].includes(sortBy) ? sortBy : 'created_at';
    let q = `SELECT f.*, u.username as author_name FROM faqs f JOIN users u ON f.author_id = u.id WHERE 1=1`;
    const params = [];
    if (tag) { q += ' AND JSON_CONTAINS(f.tags, ?)'; params.push(JSON.stringify(tag)); }
    if (authorId) { q += ' AND f.author_id = ?'; params.push(authorId); }
    if (search) {
      q += ' AND (f.title LIKE ? OR f.topic LIKE ? OR f.body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    q += ` ORDER BY f.${sort} DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
    const [rows] = params.length ? await pool.execute(q, params) : await pool.query(q);
    rows.forEach(decorate);

    let cq = 'SELECT COUNT(*) as total FROM faqs WHERE 1=1';
    const cp = [];
    if (tag) { cq += ' AND JSON_CONTAINS(tags, ?)'; cp.push(JSON.stringify(tag)); }
    if (authorId) { cq += ' AND author_id = ?'; cp.push(authorId); }
    if (search) { cq += ' AND (title LIKE ? OR topic LIKE ? OR body LIKE ?)'; cp.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const [[{ total }]] = await pool.execute(cq, cp);

    return { faqs: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async update(id, { title, topic, body, qaPairs, tags }) {
    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (topic !== undefined) { updates.push('topic = ?'); values.push(topic); }
    if (body !== undefined) {
      updates.push('body = ?'); values.push(body);
      updates.push('excerpt = ?'); values.push(buildExcerpt(body));
    }
    if (qaPairs !== undefined) { updates.push('qa_pairs = ?'); values.push(JSON.stringify(qaPairs)); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
    if (!updates.length) throw new Error('Немає даних для оновлення');
    updates.push('updated_at = NOW()');
    values.push(id);
    await pool.execute(`UPDATE faqs SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM faqs WHERE id = ?', [id]);
  }

  static async getTags() {
    const [rows] = await pool.execute('SELECT tags FROM faqs');
    const tagMap = new Map();
    rows.forEach((row) => {
      parseJson(row.tags, []).forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    });
    return Array.from(tagMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }
}

export default Faq;
