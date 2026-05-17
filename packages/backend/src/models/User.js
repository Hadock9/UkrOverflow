/**
 * Модель User
 */

import pool from '../config/database.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export class User {
  /**
   * Створення користувача
   */
  static async create({ username, email, password }) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [username, email, hashedPassword]
    );

    return {
      id: result.insertId,
      username,
      email
    };
  }

  /**
   * Пошук користувача за ID. Повертає public-fields + GitHub-секцію.
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT id, username, email, reputation, role, bio, location, website, avatar_url,
              github_id, github_login, github_avatar_url, github_profile, github_stack,
              github_contributions, github_badges, github_synced_at,
              google_id, google_email, google_avatar_url, google_profile,
              created_at, updated_at,
              (SELECT COUNT(*) FROM questions WHERE author_id = ?) as questions_count,
              (SELECT COUNT(*) FROM answers WHERE author_id = ?) as answers_count
       FROM users WHERE id = ?`,
      [id, id, id]
    );

    const u = rows[0];
    if (!u) return null;

    const parseJson = (v, f) => {
      if (v === null || v === undefined) return f;
      if (typeof v === 'object') return v;
      try { return JSON.parse(v); } catch { return f; }
    };

    return {
      ...u,
      reputation: Math.max(0, Number(u.reputation) || 0),
      github_profile: parseJson(u.github_profile, null),
      github_stack: parseJson(u.github_stack, null),
      github_contributions: parseJson(u.github_contributions, null),
      github_badges: parseJson(u.github_badges, null),
      github_connected: !!u.github_id,
    };
  }

  /**
   * Пошук користувача за email
   */
  static async findByEmail(email) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    return rows[0] || null;
  }

  /**
   * Пошук користувача за username
   */
  static async findByUsername(username) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    return rows[0] || null;
  }

  /**
   * Перевірка паролю
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    if (
      plainPassword == null ||
      String(plainPassword) === '' ||
      hashedPassword == null ||
      typeof hashedPassword !== 'string' ||
      hashedPassword.trim() === ''
    ) {
      return false;
    }
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch {
      return false;
    }
  }

  /**
   * Оновлення репутації (не нижче 0)
   */
  static async updateReputation(userId, delta) {
    if (!userId || !delta) return;
    await pool.execute(
      'UPDATE users SET reputation = GREATEST(0, reputation + ?) WHERE id = ?',
      [delta, userId]
    );
  }

  /**
   * Оновлення профілю
   */
  static async update(userId, data) {
    const allowedFields = ['username', 'email', 'bio', 'location', 'website'];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      throw new Error('Немає даних для оновлення');
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(userId);
  }

  /**
   * Видалення користувача
   */
  static async delete(userId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Видалення голосів
      await connection.execute('DELETE FROM votes WHERE user_id = ?', [userId]);

      // Видалення відповідей
      await connection.execute('DELETE FROM answers WHERE author_id = ?', [userId]);

      // Видалення питань
      await connection.execute('DELETE FROM questions WHERE author_id = ?', [userId]);

      // Видалення користувача
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Список користувачів
   */
  static async list({ page = 1, limit = 20, sortBy = 'reputation' } = {}) {
    const offset = (page - 1) * limit;
    const allowedSorts = ['reputation', 'created_at', 'username'];
    const sort = allowedSorts.includes(sortBy) ? sortBy : 'reputation';

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.reputation, u.created_at,
              COUNT(DISTINCT q.id) as questions_count,
              COUNT(DISTINCT a.id) as answers_count
       FROM users u
       LEFT JOIN questions q ON q.author_id = u.id
       LEFT JOIN answers a ON a.author_id = u.id
       GROUP BY u.id
       ORDER BY u.${sort} DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );

    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) as total FROM users'
    );

    return {
      users: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Пошук користувача за github_id
   */
  static async findByGithubId(githubId) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE github_id = ?',
      [githubId]
    );
    return rows[0] || null;
  }

  /**
   * Згенерувати унікальне ім'я користувача на основі GitHub-логіну.
   */
  static async generateUniqueUsernameFromGithub(login) {
    const base = String(login || 'github_user')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'github_user';

    let candidate = base;
    for (let i = 0; i < 50; i += 1) {
      const existing = await this.findByUsername(candidate);
      if (!existing) return candidate;
      candidate = `${base}_${i + 2}`;
    }
    return `${base}_${Date.now()}`;
  }

  /**
   * Створити нового користувача з GitHub-OAuth (без пароля).
   */
  static async createFromGithub({ ghUser, primaryEmail, accessToken, profile }) {
    const username = await this.generateUniqueUsernameFromGithub(ghUser.login);
    const email = (primaryEmail || ghUser.email || `${username}@github.local`).slice(0, 255);

    const [result] = await pool.execute(
      `INSERT INTO users (
         username, email, password, reputation, role,
         bio, location, website, avatar_url,
         github_id, github_login, github_avatar_url, github_access_token, github_profile,
         created_at, updated_at
       ) VALUES (?, ?, NULL, 0, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        username,
        email,
        ghUser.bio ?? null,
        ghUser.location ?? null,
        ghUser.blog ?? null,
        ghUser.avatar_url ?? null,
        ghUser.id,
        ghUser.login ?? null,
        ghUser.avatar_url ?? null,
        accessToken ?? null,
        JSON.stringify(profile || {}),
      ]
    );

    return this.findById(result.insertId);
  }

  /**
   * Прив'язати GitHub до існуючого користувача.
   */
  static async linkGithub(userId, { ghUser, accessToken, profile }) {
    await pool.execute(
      `UPDATE users SET
         github_id = ?, github_login = ?, github_avatar_url = ?,
         github_access_token = ?, github_profile = ?,
         avatar_url = COALESCE(avatar_url, ?),
         updated_at = NOW()
       WHERE id = ?`,
      [
        ghUser.id,
        ghUser.login ?? null,
        ghUser.avatar_url ?? null,
        accessToken ?? null,
        JSON.stringify(profile || {}),
        ghUser.avatar_url ?? null,
        userId,
      ]
    );
    return this.findById(userId);
  }

  static async unlinkGithub(userId) {
    await pool.execute(
      `UPDATE users SET
         github_id = NULL, github_login = NULL, github_avatar_url = NULL,
         github_access_token = NULL, github_profile = NULL, github_stack = NULL,
         github_synced_at = NULL, updated_at = NOW()
       WHERE id = ?`,
      [userId]
    );
    return this.findById(userId);
  }

  static async findByGoogleId(googleId) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE google_id = ?',
      [String(googleId)]
    );
    return rows[0] || null;
  }

  static async generateUniqueUsernameFromGoogle(googleUser) {
    const fromEmail = googleUser?.email?.split('@')?.[0];
    const base = String(fromEmail || googleUser?.given_name || googleUser?.name || 'google_user')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'google_user';

    let candidate = base;
    for (let i = 0; i < 50; i += 1) {
      const existing = await this.findByUsername(candidate);
      if (!existing) return candidate;
      candidate = `${base}_${i + 2}`;
    }
    return `${base}_${Date.now()}`;
  }

  static async createFromGoogle({ googleUser, profile }) {
    const username = await this.generateUniqueUsernameFromGoogle(googleUser);
    const email = String(googleUser.email || `${username}@google.local`).slice(0, 255);

    const [result] = await pool.execute(
      `INSERT INTO users (
         username, email, password, reputation, role,
         bio, location, website, avatar_url,
         google_id, google_email, google_avatar_url, google_profile,
         created_at, updated_at
       ) VALUES (?, ?, NULL, 0, 'user', NULL, NULL, NULL, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        username,
        email,
        googleUser.picture ?? null,
        String(googleUser.sub),
        email,
        googleUser.picture ?? null,
        JSON.stringify(profile || {}),
      ]
    );

    return this.findById(result.insertId);
  }

  static async linkGoogle(userId, { googleUser, profile }) {
    const email = String(googleUser.email || '').slice(0, 255);
    await pool.execute(
      `UPDATE users SET
         google_id = ?, google_email = ?, google_avatar_url = ?, google_profile = ?,
         avatar_url = COALESCE(avatar_url, ?),
         updated_at = NOW()
       WHERE id = ?`,
      [
        String(googleUser.sub),
        email || null,
        googleUser.picture ?? null,
        JSON.stringify(profile || {}),
        googleUser.picture ?? null,
        userId,
      ]
    );
    return this.findById(userId);
  }

  static async unlinkGoogle(userId) {
    await pool.execute(
      `UPDATE users SET
         google_id = NULL, google_email = NULL, google_avatar_url = NULL,
         google_profile = NULL, updated_at = NOW()
       WHERE id = ?`,
      [userId]
    );
    return this.findById(userId);
  }

  static async updateGithubSync(userId, { profile, stack, contributions, badges, accessToken }) {
    const sets = ['github_synced_at = NOW()', 'updated_at = NOW()'];
    const values = [];
    if (profile !== undefined) { sets.push('github_profile = ?'); values.push(JSON.stringify(profile)); }
    if (stack !== undefined) { sets.push('github_stack = ?'); values.push(JSON.stringify(stack)); }
    if (contributions !== undefined) { sets.push('github_contributions = ?'); values.push(contributions ? JSON.stringify(contributions) : null); }
    if (badges !== undefined) { sets.push('github_badges = ?'); values.push(JSON.stringify(badges || [])); }
    if (accessToken !== undefined && accessToken !== null) {
      sets.push('github_access_token = ?');
      values.push(accessToken);
    }
    values.push(userId);
    await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(userId);
  }

  static async getGithubAccessToken(userId) {
    const [rows] = await pool.execute(
      'SELECT github_access_token FROM users WHERE id = ?',
      [userId]
    );
    return rows[0]?.github_access_token || null;
  }

  /**
   * Блокування користувача
   */
  static async block(userId) {
    await pool.execute(
      'UPDATE users SET blocked = 1, blocked_at = NOW() WHERE id = ?',
      [userId]
    );

    return this.findById(userId);
  }

  /**
   * Розблокування користувача
   */
  static async unblock(userId) {
    await pool.execute(
      'UPDATE users SET blocked = 0, blocked_at = NULL WHERE id = ?',
      [userId]
    );

    return this.findById(userId);
  }
}

export default User;
