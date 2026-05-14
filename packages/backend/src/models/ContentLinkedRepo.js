/**
 * Модель ContentLinkedRepo — GitHub-репозиторії, прив'язані до контент-сутностей
 * (питань, статей, гайдів, snippets, roadmap-ів тощо).
 */

import pool from '../config/database.js';

const SUPPORTED_TARGETS = new Set([
  'question',
  'article',
  'guide',
  'snippet',
  'roadmap',
  'best_practice',
  'faq',
  'content',
]);

function parseJson(v, f) {
  if (v === null || v === undefined) return f;
  if (Array.isArray(v) || typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return f; }
}

function decorate(row) {
  if (!row) return row;
  row.topics = parseJson(row.topics, []);
  row.is_fork = !!row.is_fork;
  row.is_archived = !!row.is_archived;
  return row;
}

export class ContentLinkedRepo {
  static isSupportedTarget(t) {
    return SUPPORTED_TARGETS.has(t);
  }

  static async create({ targetType, targetId, ghRepo, addedByUserId, note }) {
    if (!this.isSupportedTarget(targetType)) {
      throw new Error(`Непідтримуваний target_type: ${targetType}`);
    }
    if (!ghRepo?.id || !ghRepo?.full_name) {
      throw new Error('Невалідні дані репозиторію GitHub');
    }

    try {
      const [result] = await pool.execute(
        `INSERT INTO content_linked_repos (
           target_type, target_id, github_repo_id, name, full_name, html_url,
           description, homepage, language, topics, stars, forks, open_issues,
           is_fork, is_archived, added_by_user_id, added_note, pushed_at, added_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          targetType,
          Number(targetId),
          ghRepo.id,
          (ghRepo.name || '').slice(0, 120),
          (ghRepo.full_name || '').slice(0, 200),
          ghRepo.html_url || '',
          ghRepo.description ?? null,
          ghRepo.homepage ?? null,
          ghRepo.language ?? null,
          JSON.stringify(ghRepo.topics || []),
          ghRepo.stargazers_count ?? 0,
          ghRepo.forks_count ?? 0,
          ghRepo.open_issues_count ?? 0,
          ghRepo.fork ? 1 : 0,
          ghRepo.archived ? 1 : 0,
          addedByUserId,
          (note || '').slice(0, 280) || null,
          ghRepo.pushed_at ? new Date(ghRepo.pushed_at) : null,
        ]
      );
      return this.findById(result.insertId);
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') {
        const existing = await this.findByTargetAndRepo(targetType, targetId, ghRepo.id);
        const e = new Error('Цей репозиторій уже прив’язано до контенту');
        e.code = 'DUP_LINK';
        e.existing = existing;
        throw e;
      }
      throw err;
    }
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT r.*, u.username AS added_by_username
       FROM content_linked_repos r
       JOIN users u ON u.id = r.added_by_user_id
       WHERE r.id = ?`,
      [id]
    );
    return decorate(rows[0]) || null;
  }

  static async findByTargetAndRepo(targetType, targetId, githubRepoId) {
    const [rows] = await pool.execute(
      `SELECT r.*, u.username AS added_by_username
       FROM content_linked_repos r
       JOIN users u ON u.id = r.added_by_user_id
       WHERE r.target_type = ? AND r.target_id = ? AND r.github_repo_id = ?`,
      [targetType, Number(targetId), githubRepoId]
    );
    return decorate(rows[0]) || null;
  }

  static async listByTarget(targetType, targetId, { limit = 25 } = {}) {
    if (!this.isSupportedTarget(targetType)) return [];
    const limitNum = Math.max(1, Math.min(parseInt(limit, 10) || 25, 100));
    const [rows] = await pool.execute(
      `SELECT r.*, u.username AS added_by_username
       FROM content_linked_repos r
       JOIN users u ON u.id = r.added_by_user_id
       WHERE r.target_type = ? AND r.target_id = ?
       ORDER BY r.stars DESC, r.added_at DESC
       LIMIT ${limitNum}`,
      [targetType, Number(targetId)]
    );
    rows.forEach(decorate);
    return rows;
  }

  static async listByUser(userId, { limit = 50 } = {}) {
    const limitNum = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
    const [rows] = await pool.execute(
      `SELECT * FROM content_linked_repos
       WHERE added_by_user_id = ?
       ORDER BY added_at DESC
       LIMIT ${limitNum}`,
      [userId]
    );
    rows.forEach(decorate);
    return rows;
  }

  static async delete(id, { userId, isAdmin = false } = {}) {
    const existing = await this.findById(id);
    if (!existing) return null;
    if (!isAdmin && existing.added_by_user_id !== userId) {
      const e = new Error('Видалити це посилання може лише автор або адмін');
      e.code = 'FORBIDDEN';
      throw e;
    }
    await pool.execute('DELETE FROM content_linked_repos WHERE id = ?', [id]);
    return existing;
  }

  /** Оновити закешовані метадані (stars/forks/тощо) для всіх посилань на цей github_repo_id. */
  static async refreshMetadata(githubRepoId, ghRepo) {
    if (!ghRepo) return 0;
    const [r] = await pool.execute(
      `UPDATE content_linked_repos
       SET name = ?, full_name = ?, description = ?, homepage = ?, language = ?,
           topics = ?, stars = ?, forks = ?, open_issues = ?,
           is_fork = ?, is_archived = ?, pushed_at = ?
       WHERE github_repo_id = ?`,
      [
        (ghRepo.name || '').slice(0, 120),
        (ghRepo.full_name || '').slice(0, 200),
        ghRepo.description ?? null,
        ghRepo.homepage ?? null,
        ghRepo.language ?? null,
        JSON.stringify(ghRepo.topics || []),
        ghRepo.stargazers_count ?? 0,
        ghRepo.forks_count ?? 0,
        ghRepo.open_issues_count ?? 0,
        ghRepo.fork ? 1 : 0,
        ghRepo.archived ? 1 : 0,
        ghRepo.pushed_at ? new Date(ghRepo.pushed_at) : null,
        githubRepoId,
      ]
    );
    return r.affectedRows;
  }
}

export default ContentLinkedRepo;
