/**
 * Додає демонстраційні рядки сповіщень у БД для обраного користувача.
 *
 * Вимоги:
 *   - мінімум 2 користувачі в `users` (один отримувач, інший — «актор» у подіях);
 *   - бажано наявність питань/відповідей/спільнот (інакше частина типів пропуститься).
 *
 * Використання:
 *   cd packages/backend && node src/scripts/seedNotifications.js --user=1
 *   SEED_NOTIFICATIONS_USER_ID=3 node src/scripts/seedNotifications.js
 *
 * Повторний запуск видаляє попередні демо-сповіщення (позначені seedDemo у data).
 */

import 'dotenv/config';
import pool from '../config/database.js';
import Notification from '../models/Notification.js';

const DEMO_FLAG = { seedDemo: true };

function parseUserId(argv, env) {
  const fromEnv = env.SEED_NOTIFICATIONS_USER_ID;
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    const n = parseInt(fromEnv, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--user' || a === '-u') {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) return n;
      i += 1;
    } else if (a.startsWith('--user=')) {
      const n = parseInt(a.slice('--user='.length), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  const n = parseInt(argv[2], 10);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

async function clearDemoForUser(userId) {
  await pool.execute(
    `DELETE FROM notifications
     WHERE user_id = ?
       AND (
         JSON_EXTRACT(data, '$.seedDemo') = true
         OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.seedDemo')) = 'true'
       )`,
    [userId]
  );
}

async function main() {
  const userId = parseUserId(process.argv, process.env);
  if (!userId) {
    console.error('Вкажіть користувача: --user=ID або SEED_NOTIFICATIONS_USER_ID=ID');
    process.exit(1);
  }

  const [[urow]] = await pool.execute(
    'SELECT id, username FROM users WHERE id = ?',
    [userId]
  );
  if (!urow) {
    console.error(`Користувача id=${userId} не знайдено`);
    process.exit(1);
  }

  const [others] = await pool.execute(
    'SELECT id, username FROM users WHERE id != ? ORDER BY id ASC LIMIT 5',
    [userId]
  );
  if (!others.length) {
    console.error('У БД має бути хоча б 2 користувачі (створи другий акаунт або npm run seed).');
    process.exit(1);
  }
  const actor = others[0];

  await clearDemoForUser(userId);
  let n = 0;

  const qAuthor = await pool.execute(
    'SELECT id FROM questions WHERE author_id = ? LIMIT 1',
    [userId]
  );
  const qMine = qAuthor[0][0];
  if (qMine) {
    await Notification.create(
      userId,
      'question_answer',
      'question',
      qMine.id,
      { ...DEMO_FLAG, answerAuthorId: actor.id }
    );
    n += 1;
    await Notification.create(
      userId,
      'vote',
      'question',
      qMine.id,
      { ...DEMO_FLAG, voteType: 'up', voterId: actor.id, actorId: actor.id }
    );
    n += 1;
  }

  const ansRow = await pool.execute(
    'SELECT id, question_id FROM answers WHERE author_id = ? LIMIT 1',
    [userId]
  );
  if (ansRow[0][0]) {
    const a = ansRow[0][0];
    await Notification.create(
      userId,
      'answer_accepted',
      'answer',
      a.id,
      { ...DEMO_FLAG, questionId: a.question_id }
    );
    n += 1;
    await Notification.create(
      userId,
      'vote',
      'answer',
      a.id,
      {
        ...DEMO_FLAG,
        voteType: 'up',
        voterId: actor.id,
        actorId: actor.id,
        questionId: a.question_id,
      }
    );
    n += 1;
  }

  const qBookmark = await pool.execute(
    'SELECT id, title FROM questions WHERE author_id = ? LIMIT 1 OFFSET 0',
    [userId]
  );
  if (qBookmark[0][0]) {
    const q = qBookmark[0][0];
    await Notification.create(
      userId,
      'question_bookmark',
      'question',
      q.id,
      { ...DEMO_FLAG, actorId: actor.id, title: q.title }
    );
    n += 1;
  }

  const postRow = await pool.execute(
    'SELECT p.id, p.title FROM community_posts p WHERE p.author_id = ? LIMIT 1',
    [userId]
  );
  if (postRow[0][0]) {
    const p = postRow[0][0];
    await Notification.create(
      userId,
      'community_post_comment',
      'community_post',
      p.id,
      { ...DEMO_FLAG, actorId: actor.id, commentId: 0 }
    );
    n += 1;
    await Notification.create(
      userId,
      'community_post_reply',
      'community_post',
      p.id,
      { ...DEMO_FLAG, actorId: actor.id, commentId: 0, parentId: 0 }
    );
    n += 1;
  }

  const commOwner = await pool.execute(
    'SELECT id FROM communities WHERE owner_id = ? LIMIT 1',
    [userId]
  );
  if (commOwner[0][0]) {
    const cid = commOwner[0][0].id;
    const [slugRow] = await pool.execute(
      'SELECT slug, name FROM communities WHERE id = ?',
      [cid]
    );
    const slug = slugRow[0]?.slug;
    const postAny = await pool.execute(
      'SELECT id FROM community_posts WHERE community_id = ? ORDER BY id DESC LIMIT 1',
      [cid]
    );
    if (postAny[0][0]) {
      await Notification.create(
        userId,
        'community_new_post',
        'community_post',
        postAny[0][0].id,
        { ...DEMO_FLAG, actorId: actor.id, communityId: cid, slug }
      );
      n += 1;
    }
    await Notification.create(
      userId,
      'community_join',
      'community',
      cid,
      {
        ...DEMO_FLAG,
        memberId: actor.id,
        actorId: actor.id,
        slug,
        communityName: slugRow[0]?.name || '',
      }
    );
    n += 1;
  }

  console.log(`✓ Користувач @${urow.username} (id=${userId}): додано ${n} демо-сповіщень (актор: ${actor.username}, id=${actor.id}).`);
  if (n === 0) {
    console.warn('⚠ Жодного рядка не вставлено: створіть питання/відповіді/спільноти від імені цього користувача або запустіть seedForUser.');
  }
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
