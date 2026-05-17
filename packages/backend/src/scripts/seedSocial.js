/**
 * Seed: кімнати парного програмування + тижневі челенджі.
 * Запуск: node packages/backend/src/scripts/seedSocial.js
 */

import dotenv from 'dotenv';
import pool from '../config/database.js';
import Challenge from '../models/Challenge.js';
import PairRoom from '../models/PairRoom.js';

dotenv.config();

async function getFirstUserId() {
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

  const items = [
    {
      slug: `algo-${weekStart}`,
      title: 'Алгоритми: Two Sum за O(n)',
      description: 'Реалізуйте функцію twoSum(nums, target), що повертає індекси двох чисел. Додайте пояснення складності.',
      challengeType: 'algorithms',
      criteria: { timeLimit: 'O(n)', language: 'any' },
      pointsMax: 100,
    },
    {
      slug: `bugfix-${weekStart}`,
      title: 'Bug fixing: зламаний fetch',
      description: 'Знайдіть і виправте баг у коді, що ламає обробку помилок API. Опишіть root cause.',
      challengeType: 'bug_fixing',
      criteria: { mustInclude: 'PR або gist з diff' },
      pointsMax: 80,
    },
    {
      slug: `mini-${weekStart}`,
      title: 'Mini project: TODO з localStorage',
      description: 'Міні-додаток TODO (додати / видалити / фільтр) з збереженням у localStorage. UI — на ваш смак.',
      challengeType: 'mini_project',
      criteria: { deploy: 'optional', repo: 'required' },
      pointsMax: 120,
    },
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
    await Challenge.create({ ...ch, weekStart, weekEnd });
    console.log(`  ✓ челендж: ${ch.slug}`);
  }
}

async function main() {
  try {
    console.log('\n🌱 Seed соціальних фіч...\n');
    const hostId = await getFirstUserId();
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
