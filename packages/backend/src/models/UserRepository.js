/**
 * Модель UserRepository — закешовані публічні GitHub-репозиторії користувача.
 */

import pool from '../config/database.js';

function parseJson(v, f) {
  if (v === null || v === undefined) return f;
  if (Array.isArray(v) || typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return f; }
}

function decorate(row) {
  if (!row) return row;
  row.languages = parseJson(row.languages, {});
  row.topics = parseJson(row.topics, []);
  row.is_pinned = !!row.is_pinned;
  row.is_fork = !!row.is_fork;
  row.is_archived = !!row.is_archived;
  return row;
}

export class UserRepository {
  static async upsertMany(userId, repos) {
    if (!Array.isArray(repos) || repos.length === 0) return 0;

    let count = 0;
    for (const r of repos) {
      await pool.execute(
        `INSERT INTO user_repositories (
           user_id, github_repo_id, name, full_name, html_url, description, homepage,
           language, languages, topics, stars, forks, watchers, open_issues,
           is_fork, is_archived, pushed_at, repo_created_at, synced_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           full_name = VALUES(full_name),
           html_url = VALUES(html_url),
           description = VALUES(description),
           homepage = VALUES(homepage),
           language = VALUES(language),
           languages = VALUES(languages),
           topics = VALUES(topics),
           stars = VALUES(stars),
           forks = VALUES(forks),
           watchers = VALUES(watchers),
           open_issues = VALUES(open_issues),
           is_fork = VALUES(is_fork),
           is_archived = VALUES(is_archived),
           pushed_at = VALUES(pushed_at),
           repo_created_at = VALUES(repo_created_at),
           synced_at = NOW()`,
        [
          userId,
          r.id,
          (r.name || '').slice(0, 120),
          (r.full_name || '').slice(0, 200),
          r.html_url || '',
          r.description ?? null,
          r.homepage ?? null,
          r.language ?? null,
          JSON.stringify(r.languages || {}),
          JSON.stringify(r.topics || []),
          r.stargazers_count ?? 0,
          r.forks_count ?? 0,
          r.watchers_count ?? 0,
          r.open_issues_count ?? 0,
          r.fork ? 1 : 0,
          r.archived ? 1 : 0,
          r.pushed_at ? new Date(r.pushed_at) : null,
          r.created_at ? new Date(r.created_at) : null,
        ]
      );
      count += 1;
    }
    return count;
  }

  static async removeMissing(userId, keepIds) {
    if (!Array.isArray(keepIds) || keepIds.length === 0) {
      await pool.execute('DELETE FROM user_repositories WHERE user_id = ?', [userId]);
      return;
    }
    const placeholders = keepIds.map(() => '?').join(',');
    await pool.execute(
      `DELETE FROM user_repositories WHERE user_id = ? AND github_repo_id NOT IN (${placeholders})`,
      [userId, ...keepIds]
    );
  }

  static async listByUser(userId, { onlyPinned = false, limit = 50 } = {}) {
    const limitNum = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const query = `
      SELECT * FROM user_repositories
      WHERE user_id = ? ${onlyPinned ? 'AND is_pinned = 1' : ''}
      ORDER BY is_pinned DESC, stars DESC, pushed_at DESC
      LIMIT ${limitNum}
    `;
    const [rows] = await pool.execute(query, [userId]);
    rows.forEach(decorate);
    return rows;
  }

  static async setPinned(userId, repoIds) {
    await pool.execute('UPDATE user_repositories SET is_pinned = 0 WHERE user_id = ?', [userId]);
    if (!Array.isArray(repoIds) || repoIds.length === 0) return [];
    const limited = repoIds.slice(0, 6);
    const placeholders = limited.map(() => '?').join(',');
    await pool.execute(
      `UPDATE user_repositories SET is_pinned = 1
       WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...limited]
    );
    return limited;
  }

  static async deleteAllForUser(userId) {
    await pool.execute('DELETE FROM user_repositories WHERE user_id = ?', [userId]);
  }
}

export default UserRepository;
