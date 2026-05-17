/**
 * Повідомлення в кімнатах парного програмування.
 */

import pool from '../config/database.js';

function decorate(row) {
  if (!row) return row;
  return {
    id: row.id,
    roomId: row.room_id,
    authorId: row.author_id,
    username: row.username,
    avatarUrl: row.avatar_url || row.github_avatar_url,
    body: row.body,
    messageType: row.message_type,
    createdAt: row.created_at,
  };
}

export class PairRoomMessage {
  static async create({ roomId, authorId, body, messageType = 'chat' }) {
    const [result] = await pool.execute(
      `INSERT INTO pair_room_messages (room_id, author_id, body, message_type, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [roomId, authorId, body, messageType]
    );

    const [rows] = await pool.execute(
      `SELECT m.*, u.username, u.avatar_url, u.github_avatar_url
       FROM pair_room_messages m
       JOIN users u ON u.id = m.author_id
       WHERE m.id = ?`,
      [result.insertId]
    );
    return decorate(rows[0]);
  }

  static async list(roomId, { limit = 80, beforeId = null } = {}) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 80, 1), 200);
    const params = [roomId];
    let cursor = '';
    if (beforeId) {
      cursor = 'AND m.id < ?';
      params.push(beforeId);
    }

    const [rows] = await pool.execute(
      `SELECT m.*, u.username, u.avatar_url, u.github_avatar_url
       FROM pair_room_messages m
       JOIN users u ON u.id = m.author_id
       WHERE m.room_id = ? ${cursor}
       ORDER BY m.id DESC
       LIMIT ${lim}`,
      params
    );
    return rows.map(decorate).reverse();
  }
}

export default PairRoomMessage;
