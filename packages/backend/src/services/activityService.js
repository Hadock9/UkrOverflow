/**
 * Сервіс живої активності: події, присутність, WebSocket broadcast.
 */

import pool from '../config/database.js';

const PRESENCE_TTL_MS = 5 * 60 * 1000;

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function broadcast(channel, data) {
  if (typeof global.broadcast === 'function') {
    global.broadcast(channel, data);
  }
}

export async function logActivity({
  actorId,
  verb,
  entityType = null,
  entityId = null,
  title = null,
  meta = null,
}) {
  const payload = meta ? JSON.stringify(meta) : null;
  const [result] = await pool.execute(
    `INSERT INTO activity_events (actor_id, verb, entity_type, entity_id, title, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [actorId, verb, entityType, entityId, title, payload]
  );

  const [rows] = await pool.execute(
    `SELECT ae.*, u.username, u.avatar_url, u.github_avatar_url
     FROM activity_events ae
     JOIN users u ON u.id = ae.actor_id
     WHERE ae.id = ?`,
    [result.insertId]
  );

  const event = decorateEvent(rows[0]);
  broadcast('activity', { type: 'event', event });
  return event;
}

export async function setPresence(userId, { status, context = null, entityType = null, entityId = null }) {
  const ctx = context ? JSON.stringify(context) : null;
  await pool.execute(
    `INSERT INTO user_presence (user_id, status, context, entity_type, entity_id, last_seen_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       context = VALUES(context),
       entity_type = VALUES(entity_type),
       entity_id = VALUES(entity_id),
       last_seen_at = NOW()`,
    [userId, status, ctx, entityType, entityId]
  );

  const [rows] = await pool.execute(
    `SELECT up.*, u.username, u.avatar_url, u.github_avatar_url, u.reputation
     FROM user_presence up
     JOIN users u ON u.id = up.user_id
     WHERE up.user_id = ?`,
    [userId]
  );

  const presence = decoratePresence(rows[0]);
  broadcast('activity', { type: 'presence', presence });
  return presence;
}

export async function clearStalePresence() {
  await pool.execute(
    'DELETE FROM user_presence WHERE last_seen_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)'
  );
}

function decorateEvent(row) {
  if (!row) return row;
  return {
    id: row.id,
    actorId: row.actor_id,
    verb: row.verb,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    meta: parseJson(row.meta, {}),
    createdAt: row.created_at,
    username: row.username,
    avatarUrl: row.avatar_url || row.github_avatar_url,
  };
}

function decoratePresence(row) {
  if (!row) return row;
  return {
    userId: row.user_id,
    status: row.status,
    context: parseJson(row.context, {}),
    entityType: row.entity_type,
    entityId: row.entity_id,
    lastSeenAt: row.last_seen_at,
    username: row.username,
    avatarUrl: row.avatar_url || row.github_avatar_url,
    reputation: row.reputation,
  };
}

export async function getLiveFeed({ limit = 40 } = {}) {
  await clearStalePresence();

  const lim = Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100);

  const [events] = await pool.execute(
    `SELECT ae.*, u.username, u.avatar_url, u.github_avatar_url
     FROM activity_events ae
     JOIN users u ON u.id = ae.actor_id
     ORDER BY ae.created_at DESC
     LIMIT ${lim}`
  );

  const [presence] = await pool.execute(
    `SELECT up.*, u.username, u.avatar_url, u.github_avatar_url, u.reputation
     FROM user_presence up
     JOIN users u ON u.id = up.user_id
     WHERE up.last_seen_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
     ORDER BY up.last_seen_at DESC
     LIMIT 50`
  );

  const byStatus = { asking: [], answering: [], learning: [], in_room: [] };
  for (const p of presence) {
    const item = decoratePresence(p);
    if (byStatus[item.status]) byStatus[item.status].push(item);
  }

  return {
    events: events.map(decorateEvent),
    liveNow: byStatus,
    totals: {
      asking: byStatus.asking.length,
      answering: byStatus.answering.length,
      learning: byStatus.learning.length,
      inRoom: byStatus.in_room.length,
    },
  };
}

export async function getRecentEvents({ limit = 30, verb = null } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const params = [];
  let where = '';
  if (verb) {
    where = 'WHERE ae.verb = ?';
    params.push(verb);
  }
  const [rows] = await pool.execute(
    `SELECT ae.*, u.username, u.avatar_url, u.github_avatar_url
     FROM activity_events ae
     JOIN users u ON u.id = ae.actor_id
     ${where}
     ORDER BY ae.created_at DESC
     LIMIT ${lim}`,
    params
  );
  return rows.map(decorateEvent);
}

export { broadcast, PRESENCE_TTL_MS };
