/**
 * Опитування в стилі DOU (зарплати, грейд, ринок).
 */

import pool from '../config/database.js';

function parseOptions(raw) {
  const opts = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(opts) ? opts : [];
}

export class NewsPoll {
  static async findActive() {
    const [rows] = await pool.execute(
      `SELECT * FROM news_polls WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
    );
    if (!rows[0]) return null;
    return this._decorate(rows[0]);
  }

  static async findBySlug(slug) {
    const [rows] = await pool.execute('SELECT * FROM news_polls WHERE slug = ?', [slug]);
    if (!rows[0]) return null;
    return this._decorate(rows[0]);
  }

  static async _decorate(row) {
    const options = parseOptions(row.options).map((o) => ({
      id: o.id,
      label: o.label,
      votes: 0,
    }));
    const pollId = row.id;
    const [voteRows] = await pool.execute(
      `SELECT option_id, COUNT(*) AS cnt FROM news_poll_votes WHERE poll_id = ? GROUP BY option_id`,
      [pollId],
    );
    const voteMap = Object.fromEntries(voteRows.map((v) => [v.option_id, v.cnt]));
    let totalVotes = 0;
    for (const opt of options) {
      opt.votes = voteMapsSafe(voteMap, opt.id);
      totalVotes += opt.votes;
    }
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      options,
      totalVotes,
      isActive: Boolean(row.is_active),
    };
  }

  static async vote(pollId, optionId, voterKey, userId = null) {
    const poll = await this.findByIdRaw(pollId);
    if (!poll || !poll.is_active) return { error: 'Опитування недоступне' };
    const options = parseOptions(poll.options);
    if (!options.some((o) => o.id === optionId)) {
      return { error: 'Невірний варіант' };
    }
    try {
      await pool.execute(
        `INSERT INTO news_poll_votes (poll_id, option_id, voter_key, user_id, voted_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [pollId, optionId, voterKey, userId],
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { error: 'Ви вже проголосували' };
      }
      throw err;
    }
    const fresh = await this.findByIdRaw(pollId);
    return { success: true, poll: await this._decorate(fresh) };
  }

  static async findByIdRaw(id) {
    const [rows] = await pool.execute('SELECT * FROM news_polls WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async getUserVote(pollId, voterKey) {
    const [rows] = await pool.execute(
      'SELECT option_id FROM news_poll_votes WHERE poll_id = ? AND voter_key = ?',
      [pollId, voterKey],
    );
    return rows[0]?.option_id || null;
  }

  static async upsertDefaultPoll() {
    const slug = 'dev-grade-2026';
    const [existing] = await pool.execute('SELECT id FROM news_polls WHERE slug = ?', [slug]);
    if (existing.length) return existing[0].id;

    const options = JSON.stringify([
      { id: 'junior', label: 'Junior' },
      { id: 'middle', label: 'Middle' },
      { id: 'senior', label: 'Senior' },
      { id: 'lead', label: 'Lead / Staff' },
      { id: 'manager', label: 'Engineering Manager' },
    ]);
    const [r] = await pool.execute(
      `INSERT INTO news_polls (slug, title, description, options, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [
        slug,
        'Ваш поточний грейд у 2026? (анонімно)',
        'Як на DOU Salary Report — допоможе зібрати зріз спільноти DevFlow.',
        options,
      ],
    );
    return r.insertId;
  }
}

function voteMapsSafe(map, id) {
  return map[id] || 0;
}

export default NewsPoll;
