/**
 * Модель MentorProfile — профілі менторів (1:1 з users).
 */

import pool from '../config/database.js';

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function decorate(row) {
  if (!row) return row;
  row.stack = parseJson(row.stack, []);
  row.topics = parseJson(row.topics, []);
  row.languages = parseJson(row.languages, []);
  return row;
}

export class MentorProfile {
  static async upsert({ userId, bio, stack, topics, languages, availabilityHoursWeek, priceNote, contactMethod, isActive }) {
    const existing = await this.findByUserIdRaw(userId);

    const stackJson = JSON.stringify(stack || []);
    const topicsJson = JSON.stringify(topics || []);
    const langsJson = JSON.stringify(languages || []);
    const avail = Number.isFinite(availabilityHoursWeek) ? Math.max(0, availabilityHoursWeek) : 0;
    const active = isActive === false || isActive === 0 ? 0 : 1;

    if (existing) {
      await pool.execute(
        `UPDATE mentor_profiles
         SET is_active = ?, bio = ?, stack = ?, topics = ?, languages = ?,
             availability_hours_week = ?, price_note = ?, contact_method = ?
         WHERE user_id = ?`,
        [active, bio || null, stackJson, topicsJson, langsJson, avail, priceNote || null, contactMethod || null, userId]
      );
    } else {
      await pool.execute(
        `INSERT INTO mentor_profiles
           (user_id, is_active, bio, stack, topics, languages, availability_hours_week, price_note, contact_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, active, bio || null, stackJson, topicsJson, langsJson, avail, priceNote || null, contactMethod || null]
      );
    }
    return this.findByUserId(userId);
  }

  static async findByUserIdRaw(userId) {
    const [rows] = await pool.execute(
      `SELECT * FROM mentor_profiles WHERE user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  }

  static async findByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT m.*, u.username, u.avatar_url, u.github_login, u.reputation, u.location, u.github_stack
       FROM mentor_profiles m
       JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ?`,
      [userId]
    );
    return decorate(rows[0]) || null;
  }

  static async list({ stack, language, topic, search, page = 1, limit = 20 } = {}) {
    const limitN = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitN;

    let where = 'WHERE m.is_active = 1';
    const params = [];

    if (Array.isArray(stack) && stack.length > 0) {
      const orClauses = stack.map(() => 'JSON_CONTAINS(LOWER(m.stack), LOWER(?))');
      where += ` AND (${orClauses.join(' OR ')})`;
      stack.forEach((s) => params.push(JSON.stringify(String(s))));
    }
    if (language) {
      where += ' AND JSON_CONTAINS(LOWER(m.languages), LOWER(?))';
      params.push(JSON.stringify(String(language)));
    }
    if (topic) {
      where += ' AND JSON_CONTAINS(LOWER(m.topics), LOWER(?))';
      params.push(JSON.stringify(String(topic)));
    }
    if (search) {
      where += ' AND (m.bio LIKE ? OR u.username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const sql = `SELECT m.*, u.username, u.avatar_url, u.github_login, u.reputation, u.location, u.github_stack
                 FROM mentor_profiles m
                 JOIN users u ON u.id = m.user_id
                 ${where}
                 ORDER BY m.updated_at DESC
                 LIMIT ${limitN} OFFSET ${offset}`;

    const [rows] = params.length ? await pool.execute(sql, params) : await pool.query(sql);
    rows.forEach(decorate);

    const countSql = `SELECT COUNT(*) as total FROM mentor_profiles m JOIN users u ON u.id = m.user_id ${where}`;
    const [[{ total }]] = params.length ? await pool.execute(countSql, params) : await pool.query(countSql);

    return {
      mentors: rows,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: limitN,
        total,
        totalPages: Math.ceil(total / limitN),
      },
    };
  }

  static async delete(userId) {
    await pool.execute('DELETE FROM mentor_profiles WHERE user_id = ?', [userId]);
  }
}

export default MentorProfile;
