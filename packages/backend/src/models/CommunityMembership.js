/**
 * Модель CommunityMembership — учасники спільнот.
 */

import pool from '../config/database.js';
import Community from './Community.js';

const ALLOWED_ROLES = ['owner', 'admin', 'member'];

export class CommunityMembership {
  static async join(communityId, userId, role = 'member') {
    const cleanRole = ALLOWED_ROLES.includes(role) ? role : 'member';

    try {
      const [result] = await pool.execute(
        `INSERT INTO community_memberships (community_id, user_id, role) VALUES (?, ?, ?)`,
        [communityId, userId, cleanRole]
      );
      await Community.incrementMemberCount(communityId);
      return { id: result.insertId, community_id: communityId, user_id: userId, role: cleanRole };
    } catch (e) {
      if (e?.code === 'ER_DUP_ENTRY') {
        return this.findRow(communityId, userId);
      }
      throw e;
    }
  }

  static async leave(communityId, userId) {
    const existing = await this.findRow(communityId, userId);
    if (!existing) return false;
    if (existing.role === 'owner') return false;
    await pool.execute(
      `DELETE FROM community_memberships WHERE community_id = ? AND user_id = ?`,
      [communityId, userId]
    );
    await Community.decrementMemberCount(communityId);
    return true;
  }

  static async findRow(communityId, userId) {
    const [rows] = await pool.execute(
      `SELECT * FROM community_memberships WHERE community_id = ? AND user_id = ?`,
      [communityId, userId]
    );
    return rows[0] || null;
  }

  static async findRole(communityId, userId) {
    const row = await this.findRow(communityId, userId);
    return row?.role || null;
  }

  static async listMembers(communityId, { page = 1, limit = 50 } = {}) {
    const limitN = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitN;

    const [rows] = await pool.query(
      `SELECT m.id, m.community_id, m.user_id, m.role, m.joined_at,
              u.username, u.avatar_url, u.github_login, u.reputation
       FROM community_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.community_id = ${parseInt(communityId, 10)}
       ORDER BY FIELD(m.role,'owner','admin','member'), m.joined_at ASC
       LIMIT ${limitN} OFFSET ${offset}`
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM community_memberships WHERE community_id = ?`,
      [communityId]
    );

    return {
      members: rows,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: limitN,
        total,
        totalPages: Math.ceil(total / limitN),
      },
    };
  }

  static async listUserCommunities(userId) {
    const [rows] = await pool.execute(
      `SELECT c.*, m.role as my_role
       FROM community_memberships m
       JOIN communities c ON c.id = m.community_id
       WHERE m.user_id = ?
       ORDER BY m.joined_at DESC`,
      [userId]
    );
    rows.forEach((r) => { r.tags = Community.parseTags(r.tags); });
    return rows;
  }
}

export default CommunityMembership;
