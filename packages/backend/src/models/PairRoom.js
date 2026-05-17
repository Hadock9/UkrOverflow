/**
 * Кімнати парного програмування.
 */

import pool from '../config/database.js';

const ROOM_TYPES = ['debug', 'study', 'code_review', 'general'];
const ALLOWED_TOPICS = ['debug this', 'study JS', 'study Python', 'react', 'algorithms', 'general'];

function slugify(input) {
  return String(input || 'room')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'room';
}

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
    topic: row.topic,
    roomType: row.room_type,
    description: row.description,
    codeSnippet: row.code_snippet,
    hostId: row.host_id,
    hostUsername: row.host_username,
    hostAvatar: row.host_avatar || row.host_github_avatar,
    maxParticipants: row.max_participants,
    memberCount: row.member_count,
    status: row.status,
    stack: parseJson(row.stack, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PairRoom {
  static get ROOM_TYPES() {
    return ROOM_TYPES;
  }

  static async generateUniqueSlug(title) {
    const base = slugify(title);
    let candidate = base;
    for (let i = 2; i < 200; i += 1) {
      const [rows] = await pool.execute('SELECT id FROM pair_rooms WHERE slug = ?', [candidate]);
      if (rows.length === 0) return candidate;
      candidate = `${base}-${i}`;
    }
    return `${base}-${Date.now()}`;
  }

  static async create({
    title,
    topic = 'general',
    roomType = 'general',
    description = null,
    codeSnippet = '',
    hostId,
    maxParticipants = 6,
    stack = [],
  }) {
    const slug = await this.generateUniqueSlug(title);
    const cleanType = ROOM_TYPES.includes(roomType) ? roomType : 'general';
    const cleanTopic = ALLOWED_TOPICS.includes(topic) ? topic : topic.slice(0, 60);

    const [result] = await pool.execute(
      `INSERT INTO pair_rooms (slug, title, topic, room_type, description, code_snippet, host_id, max_participants, member_count, status, stack, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'open', ?, NOW(), NOW())`,
      [
        slug,
        title,
        cleanTopic,
        cleanType,
        description,
        codeSnippet || '',
        hostId,
        maxParticipants,
        JSON.stringify(Array.isArray(stack) ? stack : []),
      ]
    );

    await pool.execute(
      `INSERT INTO pair_room_members (room_id, user_id, role, joined_at)
       VALUES (?, ?, 'host', NOW())`,
      [result.insertId, hostId]
    );

    return this.findById(result.insertId);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT pr.*, u.username AS host_username, u.avatar_url AS host_avatar, u.github_avatar_url AS host_github_avatar
       FROM pair_rooms pr
       JOIN users u ON u.id = pr.host_id
       WHERE pr.id = ?`,
      [id]
    );
    return decorate(rows[0]);
  }

  static async findBySlug(slug) {
    const [rows] = await pool.execute(
      `SELECT pr.*, u.username AS host_username, u.avatar_url AS host_avatar, u.github_avatar_url AS host_github_avatar
       FROM pair_rooms pr
       JOIN users u ON u.id = pr.host_id
       WHERE pr.slug = ?`,
      [slug]
    );
    return decorate(rows[0]);
  }

  static async list({ topic, roomType, status = 'open', page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('pr.status = ?');
      params.push(status);
    }
    if (topic) {
      conditions.push('pr.topic = ?');
      params.push(topic);
    }
    if (roomType) {
      conditions.push('pr.room_type = ?');
      params.push(roomType);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM pair_rooms pr ${where}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT pr.*, u.username AS host_username, u.avatar_url AS host_avatar, u.github_avatar_url AS host_github_avatar
       FROM pair_rooms pr
       JOIN users u ON u.id = pr.host_id
       ${where}
       ORDER BY pr.member_count DESC, pr.updated_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return {
      rooms: rows.map(decorate),
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    };
  }

  static async join(roomId, userId) {
    const room = await this.findById(roomId);
    if (!room) return null;
    if (room.status !== 'open') return { error: 'closed' };
    if (room.memberCount >= room.maxParticipants) return { error: 'full' };

    const [existing] = await pool.execute(
      'SELECT id FROM pair_room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    if (existing.length > 0) return { room, alreadyMember: true };

    await pool.execute(
      `INSERT INTO pair_room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', NOW())`,
      [roomId, userId]
    );
    await pool.execute(
      'UPDATE pair_rooms SET member_count = member_count + 1, updated_at = NOW() WHERE id = ?',
      [roomId]
    );
    return { room: await this.findById(roomId) };
  }

  static async leave(roomId, userId) {
    const [result] = await pool.execute(
      'DELETE FROM pair_room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    if (result.affectedRows > 0) {
      await pool.execute(
        'UPDATE pair_rooms SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW() WHERE id = ?',
        [roomId]
      );
    }
    return result.affectedRows > 0;
  }

  static async getMembers(roomId) {
    const [rows] = await pool.execute(
      `SELECT prm.*, u.username, u.avatar_url, u.github_avatar_url, u.reputation
       FROM pair_room_members prm
       JOIN users u ON u.id = prm.user_id
       WHERE prm.room_id = ?
       ORDER BY prm.joined_at ASC`,
      [roomId]
    );
    return rows.map((r) => ({
      userId: r.user_id,
      role: r.role,
      username: r.username,
      avatarUrl: r.avatar_url || r.github_avatar_url,
      reputation: r.reputation,
      joinedAt: r.joined_at,
    }));
  }

  static async updateCode(roomId, userId, codeSnippet) {
    const [member] = await pool.execute(
      'SELECT role FROM pair_room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    if (member.length === 0) return null;

    await pool.execute(
      'UPDATE pair_rooms SET code_snippet = ?, updated_at = NOW() WHERE id = ?',
      [codeSnippet, roomId]
    );
    return this.findById(roomId);
  }

  static async isMember(roomId, userId) {
    const [rows] = await pool.execute(
      'SELECT id FROM pair_room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    return rows.length > 0;
  }
}

export default PairRoom;
