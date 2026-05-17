/**
 * Тижневі челенджі та рейтинг.
 */

import pool from '../config/database.js';

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function decorate(row) {
  if (!row) return row;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    challengeType: row.challenge_type,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    criteria: parseJson(row.criteria, {}),
    pointsMax: row.points_max,
    status: row.status,
    submissionCount: row.submission_count,
    createdAt: row.created_at,
  };
}

function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

export class Challenge {
  static get CHALLENGE_TYPES() {
    return ['algorithms', 'bug_fixing', 'mini_project'];
  }

  static getWeekBounds(date) {
    return getWeekBounds(date);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT c.*,
        (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.challenge_id = c.id) AS submission_count
       FROM challenges c WHERE c.id = ?`,
      [id]
    );
    return decorate(rows[0]);
  }

  static async findBySlug(slug) {
    const [rows] = await pool.execute(
      `SELECT c.*,
        (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.challenge_id = c.id) AS submission_count
       FROM challenges c WHERE c.slug = ?`,
      [slug]
    );
    return decorate(rows[0]);
  }

  static async getCurrent() {
    const { weekStart } = getWeekBounds();
    const [rows] = await pool.execute(
      `SELECT c.*,
        (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.challenge_id = c.id) AS submission_count
       FROM challenges c
       WHERE c.week_start = ? AND c.status = 'active'
       ORDER BY c.id ASC`,
      [weekStart]
    );
    return rows.map(decorate);
  }

  static async list({ page = 1, limit = 20, status = null } = {}) {
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';
    if (status) {
      where = 'WHERE c.status = ?';
      params.push(status);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM challenges c ${where}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT c.*,
        (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.challenge_id = c.id) AS submission_count
       FROM challenges c
       ${where}
       ORDER BY c.week_start DESC, c.id ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return {
      challenges: rows.map(decorate),
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    };
  }

  static async create(data) {
    const [result] = await pool.execute(
      `INSERT INTO challenges (slug, title, description, challenge_type, week_start, week_end, criteria, points_max, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [
        data.slug,
        data.title,
        data.description,
        data.challengeType,
        data.weekStart,
        data.weekEnd,
        JSON.stringify(data.criteria || {}),
        data.pointsMax || 100,
      ]
    );
    return this.findById(result.insertId);
  }

  static async submit({ challengeId, userId, solutionUrl, solutionText, score = null }) {
    const challenge = await this.findById(challengeId);
    if (!challenge) return { error: 'not_found' };
    if (challenge.status !== 'active') return { error: 'closed' };

    const [existing] = await pool.execute(
      'SELECT id, score FROM challenge_submissions WHERE challenge_id = ? AND user_id = ?',
      [challengeId, userId]
    );

    if (existing.length > 0) {
      await pool.execute(
        `UPDATE challenge_submissions
         SET solution_url = ?, solution_text = ?, score = COALESCE(?, score), submitted_at = NOW()
         WHERE id = ?`,
        [solutionUrl, solutionText, score, existing[0].id]
      );
      return this.getSubmission(existing[0].id);
    }

    const autoScore = score ?? Math.floor(Math.random() * 30) + 50;
    const [result] = await pool.execute(
      `INSERT INTO challenge_submissions (challenge_id, user_id, solution_url, solution_text, score, submitted_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [challengeId, userId, solutionUrl, solutionText, autoScore]
    );
    return this.getSubmission(result.insertId);
  }

  static async getSubmission(id) {
    const [rows] = await pool.execute(
      `SELECT cs.*, u.username, u.avatar_url, u.github_avatar_url, u.reputation,
              c.title AS challenge_title, c.slug AS challenge_slug
       FROM challenge_submissions cs
       JOIN users u ON u.id = cs.user_id
       JOIN challenges c ON c.id = cs.challenge_id
       WHERE cs.id = ?`,
      [id]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      challengeId: r.challenge_id,
      challengeTitle: r.challenge_title,
      challengeSlug: r.challenge_slug,
      userId: r.user_id,
      username: r.username,
      avatarUrl: r.avatar_url || r.github_avatar_url,
      reputation: r.reputation,
      solutionUrl: r.solution_url,
      solutionText: r.solution_text,
      score: r.score,
      submittedAt: r.submitted_at,
    };
  }

  static async getLeaderboard(challengeId, { limit = 20 } = {}) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const [rows] = await pool.execute(
      `SELECT cs.*, u.username, u.avatar_url, u.github_avatar_url, u.reputation,
              RANK() OVER (ORDER BY cs.score DESC, cs.submitted_at ASC) AS rank_pos
       FROM challenge_submissions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.challenge_id = ?
       ORDER BY cs.score DESC, cs.submitted_at ASC
       LIMIT ${lim}`,
      [challengeId]
    );
    return rows.map((r, i) => ({
      rank: r.rank_pos ?? i + 1,
      userId: r.user_id,
      username: r.username,
      avatarUrl: r.avatar_url || r.github_avatar_url,
      reputation: r.reputation,
      score: r.score,
      solutionUrl: r.solution_url,
      submittedAt: r.submitted_at,
    }));
  }

  static async getWeeklyLeaderboard({ limit = 15 } = {}) {
    const { weekStart } = getWeekBounds();
    const lim = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 50);
    const [rows] = await pool.execute(
      `SELECT u.id AS user_id, u.username, u.avatar_url, u.github_avatar_url, u.reputation,
              SUM(cs.score) AS total_score,
              COUNT(cs.id) AS submissions_count
       FROM challenge_submissions cs
       JOIN challenges c ON c.id = cs.challenge_id
       JOIN users u ON u.id = cs.user_id
       WHERE c.week_start = ?
       GROUP BY u.id, u.username, u.avatar_url, u.github_avatar_url, u.reputation
       ORDER BY total_score DESC, submissions_count DESC
       LIMIT ${lim}`,
      [weekStart]
    );
    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      username: r.username,
      avatarUrl: r.avatar_url || r.github_avatar_url,
      reputation: r.reputation,
      totalScore: r.total_score,
      submissionsCount: r.submissions_count,
    }));
  }

  static async getUserSubmission(challengeId, userId) {
    const [rows] = await pool.execute(
      'SELECT id FROM challenge_submissions WHERE challenge_id = ? AND user_id = ?',
      [challengeId, userId]
    );
    if (!rows[0]) return null;
    return this.getSubmission(rows[0].id);
  }
}

export default Challenge;
