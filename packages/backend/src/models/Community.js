/**
 * Модель Community — спільноти DevFlow (місто/університет/online/dev_club тощо).
 */

import pool from '../config/database.js';

const ALLOWED_TYPES = ['city', 'university', 'dev_club', 'project_team', 'study_group', 'company', 'online'];
const ALLOWED_SORTS = ['created_at', 'member_count', 'post_count'];

// Спрощена транслітерація українська → латинська
const UA_TO_EN = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '',
};

function slugify(input) {
  const lower = String(input || '').toLowerCase().trim();
  let out = '';
  for (const ch of lower) {
    if (UA_TO_EN[ch] !== undefined) {
      out += UA_TO_EN[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else {
      out += '-';
    }
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!out) out = 'community';
  return out.slice(0, 100);
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
  return row;
}

export class Community {
  static parseTags(value) {
    return parseJsonColumn(value, []);
  }

  static async generateUniqueSlug(name) {
    const base = slugify(name);
    let candidate = base;
    for (let i = 2; i < 200; i += 1) {
      const [rows] = await pool.execute('SELECT id FROM communities WHERE slug = ?', [candidate]);
      if (rows.length === 0) return candidate;
      candidate = `${base}-${i}`;
    }
    return `${base}-${Date.now()}`;
  }

  static async create({ slug, name, type, description, location, website, tags, ownerId, isPublic = 1, bannerUrl = null, avatarUrl = null }) {
    const cleanType = ALLOWED_TYPES.includes(type) ? type : 'dev_club';
    const finalSlug = slug ? slugify(slug) : await this.generateUniqueSlug(name);

    const [result] = await pool.execute(
      `INSERT INTO communities (slug, name, type, description, location, website, banner_url, avatar_url, owner_id, member_count, post_count, is_public, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      [
        finalSlug,
        name,
        cleanType,
        description || null,
        location || null,
        website || null,
        bannerUrl,
        avatarUrl,
        ownerId,
        isPublic ? 1 : 0,
        JSON.stringify(tags || []),
      ]
    );

    // Автоматично додаємо власника як owner у membership
    try {
      await pool.execute(
        `INSERT INTO community_memberships (community_id, user_id, role) VALUES (?, ?, 'owner')`,
        [result.insertId, ownerId]
      );
    } catch (e) {
      if (e?.code !== 'ER_DUP_ENTRY') throw e;
    }

    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT c.*, u.username as owner_username, u.avatar_url as owner_avatar
       FROM communities c
       LEFT JOIN users u ON c.owner_id = u.id
       WHERE c.id = ?`,
      [id]
    );
    return decorate(rows[0]) || null;
  }

  static async findBySlug(slug) {
    const [rows] = await pool.execute(
      `SELECT c.*, u.username as owner_username, u.avatar_url as owner_avatar
       FROM communities c
       LEFT JOIN users u ON c.owner_id = u.id
       WHERE c.slug = ?`,
      [slug]
    );
    return decorate(rows[0]) || null;
  }

  static async list({ type, location, search, page = 1, limit = 20, sort = 'created_at' } = {}) {
    const sortField = ALLOWED_SORTS.includes(sort) ? sort : 'created_at';
    const limitN = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitN;

    let where = 'WHERE 1=1';
    const params = [];

    if (type && ALLOWED_TYPES.includes(type)) {
      where += ' AND c.type = ?';
      params.push(type);
    }
    if (location) {
      where += ' AND c.location LIKE ?';
      params.push(`%${location}%`);
    }
    if (search) {
      where += ' AND (c.name LIKE ? OR c.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const sql = `SELECT c.*, u.username as owner_username
                 FROM communities c
                 LEFT JOIN users u ON c.owner_id = u.id
                 ${where}
                 ORDER BY c.${sortField} DESC
                 LIMIT ${limitN} OFFSET ${offset}`;

    const [rows] = params.length ? await pool.execute(sql, params) : await pool.query(sql);
    rows.forEach(decorate);

    const countSql = `SELECT COUNT(*) as total FROM communities c ${where}`;
    const [[{ total }]] = params.length ? await pool.execute(countSql, params) : await pool.query(countSql);

    return {
      communities: rows,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: limitN,
        total,
        totalPages: Math.ceil(total / limitN),
      },
    };
  }

  static async update(id, { name, type, description, location, website, tags, isPublic, bannerUrl, avatarUrl }) {
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (type !== undefined && ALLOWED_TYPES.includes(type)) { updates.push('type = ?'); values.push(type); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description || null); }
    if (location !== undefined) { updates.push('location = ?'); values.push(location || null); }
    if (website !== undefined) { updates.push('website = ?'); values.push(website || null); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags || [])); }
    if (isPublic !== undefined) { updates.push('is_public = ?'); values.push(isPublic ? 1 : 0); }
    if (bannerUrl !== undefined) { updates.push('banner_url = ?'); values.push(bannerUrl || null); }
    if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); values.push(avatarUrl || null); }

    if (!updates.length) return this.findById(id);
    values.push(id);
    await pool.execute(`UPDATE communities SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM communities WHERE id = ?', [id]);
  }

  static async incrementMemberCount(id) {
    await pool.execute('UPDATE communities SET member_count = member_count + 1 WHERE id = ?', [id]);
  }

  static async decrementMemberCount(id) {
    await pool.execute('UPDATE communities SET member_count = GREATEST(0, member_count - 1) WHERE id = ?', [id]);
  }

  static async incrementPostCount(id) {
    await pool.execute('UPDATE communities SET post_count = post_count + 1 WHERE id = ?', [id]);
  }

  static async decrementPostCount(id) {
    await pool.execute('UPDATE communities SET post_count = GREATEST(0, post_count - 1) WHERE id = ?', [id]);
  }
}

export default Community;
