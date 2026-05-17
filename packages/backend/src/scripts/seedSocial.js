/**
 * Seed: кімнати парного програмування + тижневі челенджі.
 *
 * Локально:
 *   node src/scripts/seedSocial.js
 *   node src/scripts/seedSocial.js --user 11
 *
 * Docker (з кореня проєкту, сервіс api):
 *   docker compose --env-file .env exec api node src/scripts/seedSocial.js
 *   docker compose --env-file .env exec api node src/scripts/seedSocial.js --user 11
 */

import 'dotenv/config';
import pool from '../config/database.js';
import Challenge from '../models/Challenge.js';
import PairRoom from '../models/PairRoom.js';
import { CHALLENGE_WEEK_SETS } from './challengeWeekTemplates.js';

function parseArgs(argv) {
  const args = { user: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--user' || a === '-u') {
      const n = parseInt(argv[i + 1], 10);
      if (!Number.isFinite(n)) throw new Error(`Невалідне значення для --user: "${argv[i + 1]}"`);
      args.user = n;
      i += 1;
    } else if (a.startsWith('--user=')) {
      const n = parseInt(a.slice('--user='.length), 10);
      if (!Number.isFinite(n)) throw new Error(`Невалідне значення для --user`);
      args.user = n;
    }
  }
  return args;
}

async function resolveHostId(preferredUserId) {
  if (preferredUserId) {
    const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [preferredUserId]);
    if (rows.length === 0) {
      throw new Error(`Користувача з id=${preferredUserId} не знайдено`);
    }
    return preferredUserId;
  }
  const [rows] = await pool.execute('SELECT id FROM users ORDER BY id ASC LIMIT 1');
  return rows[0]?.id || null;
}

async function seedPairRooms(hostId) {
  if (!hostId) {
    console.log('⚠ Немає користувачів — пропускаємо кімнати');
    return;
  }

  const defaults = [
    {
      title: 'Debug this — разом розбираємо баг',
      topic: 'debug this',
      roomType: 'debug',
      description: 'Приносьте stack trace, логи та код — розберемо разом.',
      codeSnippet: '// Вставте проблемний фрагмент\nfunction mystery() {\n  return undefined;\n}\n',
    },
    {
      title: 'Study JS — вечірня сесія',
      topic: 'study JS',
      roomType: 'study',
      description: 'Практика JavaScript: closures, async, масиви.',
      codeSnippet: '// const arr = [1, 2, 3];\n// console.log(arr.map(x => x * 2));\n',
    },
    {
      title: 'React hooks — live coding',
      topic: 'react',
      roomType: 'study',
      description: 'useState, useEffect, custom hooks.',
      codeSnippet: 'import { useState } from "react";\n\nexport function Counter() {\n  const [n, setN] = useState(0);\n  return null;\n}\n',
    },
  ];

  for (const room of defaults) {
    const [existing] = await pool.execute(
      'SELECT id FROM pair_rooms WHERE title = ? LIMIT 1',
      [room.title]
    );
    if (existing.length > 0) {
      console.log(`  · кімната вже є: ${room.title}`);
      continue;
    }
    const created = await PairRoom.create({ ...room, hostId });
    console.log(`  ✓ кімната: ${created.slug}`);
  }
}

async function seedChallenges() {
  const { weekStart, weekEnd } = Challenge.getWeekBounds();
  const tpl = CHALLENGE_WEEK_SETS[0];
  const items = [
    { ...tpl.algorithms, slug: `algo-${weekStart}`, challengeType: 'algorithms' },
    { ...tpl.bug_fixing, slug: `bugfix-${weekStart}`, challengeType: 'bug_fixing' },
    { ...tpl.mini_project, slug: `mini-${weekStart}`, challengeType: 'mini_project' },
  ];

  for (const ch of items) {
    const [existing] = await pool.execute(
      'SELECT id FROM challenges WHERE slug = ? LIMIT 1',
      [ch.slug]
    );
    if (existing.length > 0) {
      console.log(`  · челендж вже є: ${ch.slug}`);
      continue;
    }
    await Challenge.create({
      slug: ch.slug,
      title: ch.title,
      description: ch.description,
      challengeType: ch.challengeType,
      criteria: ch.criteria,
      pointsMax: ch.pointsMax,
      weekStart,
      weekEnd,
      status: 'active',
    });
    console.log(`  ✓ челендж: ${ch.slug}`);
  }
}

async function main() {
  const { user: preferredUserId } = parseArgs(process.argv);

  try {
    console.log('\n🌱 Seed соціальних фіч...\n');
    const hostId = await resolveHostId(preferredUserId);
    if (hostId) console.log(`  Хост кімнат: user #${hostId}\n`);
    await seedPairRooms(hostId);
    await seedChallenges();
    console.log('\n✅ Seed завершено\n');
  } catch (e) {
    console.error('❌ Помилка seed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
