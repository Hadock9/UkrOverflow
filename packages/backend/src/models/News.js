/**
 * Модель стрічки новин (news_posts).
 */

import pool from '../config/database.js';
import { slugify, uniqueSlug } from '../utils/slug.js';

function buildSummary(text, max = 500) {
  const source = (text || '')
    .replace(/[#>*_`\-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source) return '';
  return source.length > max ? `${source.slice(0, max - 3)}...` : source;
}

function parseJson(v, fallback) {
  if (v === null || v === undefined) return fallback;
  if (Array.isArray(v) || typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function decorate(row) {
  if (!row) return row;
  row.tags = parseJson(row.tags, []);
  row.is_pinned = Boolean(row.is_pinned);
  return row;
}

export class News {
  static async ensureUniqueSlug(title, excludeId = null) {
    const base = slugify(title) || 'news';
    const [rows] = await pool.execute(
      excludeId
        ? 'SELECT slug FROM news_posts WHERE slug IS NOT NULL AND id != ?'
        : 'SELECT slug FROM news_posts WHERE slug IS NOT NULL',
      excludeId ? [excludeId] : []
    );
    const taken = new Set(rows.map((r) => r.slug).filter(Boolean));
    return uniqueSlug(base, taken);
  }

  static async create({
    title,
    body,
    tags,
    authorId,
    publishedAt,
    isPinned = false,
    slug = null,
    category = 'tech',
  }) {
    const summary = buildSummary(body, 500);
    const finalSlug = slug || (await this.ensureUniqueSlug(title));
    const pubAt = publishedAt ? new Date(publishedAt) : new Date();
    const cat = category || 'tech';

    const [result] = await pool.execute(
      `INSERT INTO news_posts (title, summary, body, slug, author_id, published_at, is_pinned, tags, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        title,
        summary,
        body,
        finalSlug,
        authorId,
        pubAt,
        isPinned ? 1 : 0,
        JSON.stringify(tags || []),
        cat,
      ]
    );
    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT n.*, u.username AS author_name
       FROM news_posts n
       JOIN users u ON n.author_id = u.id
       WHERE n.id = ?`,
      [id]
    );
    return decorate(rows[0]) || null;
  }

  static async findBySlug(slug) {
    const [rows] = await pool.execute(
      `SELECT n.*, u.username AS author_name
       FROM news_posts n
       JOIN users u ON n.author_id = u.id
       WHERE n.slug = ?`,
      [slug]
    );
    return decorate(rows[0]) || null;
  }

  static async findByIdOrSlug(idOrSlug) {
    const raw = String(idOrSlug || '').trim();
    if (/^\d+$/.test(raw)) {
      return this.findById(parseInt(raw, 10));
    }
    return this.findBySlug(raw);
  }

  static async recordView(newsId, viewerKey) {
    if (!viewerKey || viewerKey.length > 96) throw new Error('Некоректний ключ глядача');
    const [exists] = await pool.execute('SELECT id FROM news_posts WHERE id = ?', [newsId]);
    if (!exists.length) return null;
    try {
      const [r] = await pool.execute(
        `INSERT IGNORE INTO news_post_views (news_post_id, viewer_key, viewed_at) VALUES (?, ?, NOW())`,
        [newsId, viewerKey]
      );
      if (r.affectedRows === 1) {
        await pool.execute('UPDATE news_posts SET views = views + 1 WHERE id = ?', [newsId]);
      }
      const [[{ views }]] = await pool.execute('SELECT views FROM news_posts WHERE id = ?', [newsId]);
      return { counted: r.affectedRows === 1, views };
    } catch (err) {
      if (err?.code !== 'ER_NO_SUCH_TABLE' && err?.errno !== 1146) throw err;
      await pool.execute('UPDATE news_posts SET views = views + 1 WHERE id = ?', [newsId]);
      const [[{ views }]] = await pool.execute('SELECT views FROM news_posts WHERE id = ?', [newsId]);
      return { counted: true, views };
    }
  }

  static async list({
    page = 1,
    limit = 20,
    sortBy = 'published_at',
    tag = null,
    category = null,
    search = null,
    pinnedOnly = false,
  } = {}) {
    const offset = (page - 1) * limit;
    const sort = sortBy === 'views' ? 'views' : 'published_at';
    let q = `SELECT n.*, u.username AS author_name
             FROM news_posts n
             JOIN users u ON n.author_id = u.id
             WHERE 1=1`;
    const params = [];
    if (tag) {
      q += ' AND JSON_CONTAINS(n.tags, ?)';
      params.push(JSON.stringify(tag));
    }
    if (category) {
      q += ' AND n.category = ?';
      params.push(category);
    }
    if (search) {
      q += ' AND (n.title LIKE ? OR n.summary LIKE ? OR n.body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (pinnedOnly) {
      q += ' AND n.is_pinned = 1';
    }
    q += ` ORDER BY n.is_pinned DESC, n.${sort} DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
    const [rows] = params.length ? await pool.execute(q, params) : await pool.query(q);
    rows.forEach(decorate);

    let cq = 'SELECT COUNT(*) AS total FROM news_posts WHERE 1=1';
    const cp = [];
    if (tag) {
      cq += ' AND JSON_CONTAINS(tags, ?)';
      cp.push(JSON.stringify(tag));
    }
    if (category) {
      cq += ' AND category = ?';
      cp.push(category);
    }
    if (search) {
      cq += ' AND (title LIKE ? OR summary LIKE ? OR body LIKE ?)';
      cp.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (pinnedOnly) {
      cq += ' AND is_pinned = 1';
    }
    const [[{ total }]] = await pool.execute(cq, cp);

    return {
      news: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async update(id, { title, body, tags, publishedAt, isPinned, slug, category }) {
    const updates = [];
    const values = [];
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (body !== undefined) {
      updates.push('body = ?');
      values.push(body);
      updates.push('summary = ?');
      values.push(buildSummary(body, 500));
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(tags));
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (publishedAt !== undefined) {
      updates.push('published_at = ?');
      values.push(new Date(publishedAt));
    }
    if (isPinned !== undefined) {
      updates.push('is_pinned = ?');
      values.push(isPinned ? 1 : 0);
    }
    if (slug !== undefined) {
      updates.push('slug = ?');
      values.push(slug);
    } else if (title !== undefined) {
      const existing = await this.findById(id);
      if (existing) {
        updates.push('slug = ?');
        values.push(await this.ensureUniqueSlug(title, id));
      }
    }
    if (!updates.length) throw new Error('Немає даних для оновлення');
    updates.push('updated_at = NOW()');
    values.push(id);
    await pool.execute(`UPDATE news_posts SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM news_posts WHERE id = ?', [id]);
  }

  /** DOU-style дайджест: тренди, теги, пульс ринку */
  static async getDigest() {
    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM news_posts');
    const [categoryRows] = await pool.execute(
      `SELECT category, COUNT(*) AS cnt FROM news_posts GROUP BY category ORDER BY cnt DESC`,
    );
    const [trending] = await pool.execute(
      `SELECT n.id, n.title, n.slug, n.views, n.category, n.published_at
       FROM news_posts n
       WHERE n.published_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY n.views DESC, n.published_at DESC
       LIMIT 6`,
    );
    const [salaryHot] = await pool.execute(
      `SELECT n.id, n.title, n.slug, n.views, n.summary
       FROM news_posts n
       WHERE n.category = 'salary'
       ORDER BY n.views DESC, n.published_at DESC
       LIMIT 3`,
    );
    const [tagRows] = await pool.execute(
      `SELECT tags FROM news_posts ORDER BY published_at DESC LIMIT 250`,
    );
    const tagCounts = {};
    for (const row of tagRows) {
      const tags = parseJson(row.tags, []);
      for (const t of tags) {
        const key = String(t).toLowerCase();
        if (key) tagCounts[key] = (tagCounts[key] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));

    const salaryCount = categoryRows.find((r) => r.category === 'salary')?.cnt || 0;
    const techCount = categoryRows.find((r) => r.category === 'tech')?.cnt || 0;

    return {
      totalPosts: total,
      categoryStats: categoryRows.map((r) => ({ category: r.category, count: r.cnt })),
      trendingWeek: trending,
      salarySpotlight: salaryHot,
      topTags,
      marketPulse: {
        salarySharePercent: total > 0 ? Math.round((salaryCount / total) * 100) : 0,
        techSharePercent: total > 0 ? Math.round((techCount / total) * 100) : 0,
        hint:
          'Огляд на основі стрічки DevFlow — натхнення форматом DOU: зарплати, карʼєра, спільнота.',
      },
    };
  }
}

export default News;
