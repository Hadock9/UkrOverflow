/**
 * Seed тижневих челенджів за минулі тижні (+ опційно демо-рішення).
 *
 *   node src/scripts/seedChallengesHistory.js
 *   node src/scripts/seedChallengesHistory.js --weeks 12
 *   node src/scripts/seedChallengesHistory.js --weeks 8 --with-submissions
 *
 * Docker:
 *   docker compose --env-file .env exec api node src/scripts/seedChallengesHistory.js --weeks 12
 */

import 'dotenv/config';
import pool from '../config/database.js';
import Challenge from '../models/Challenge.js';
import {
  CHALLENGE_WEEK_SETS,
  shiftWeeksFromToday,
} from './challengeWeekTemplates.js';

const TYPE_ORDER = ['algorithms', 'bug_fixing', 'mini_project'];
const SLUG_PREFIX = { algorithms: 'algo', bug_fixing: 'bugfix', mini_project: 'mini' };

function parseArgs(argv) {
  const args = { weeks: 8, withSubmissions: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--weeks' || a === '-w') {
      args.weeks = Math.min(52, Math.max(1, parseInt(argv[i + 1], 10) || 8));
      i += 1;
    } else if (a.startsWith('--weeks=')) {
      args.weeks = Math.min(52, Math.max(1, parseInt(a.slice('--weeks='.length), 10) || 8));
    } else if (a === '--with-submissions') {
      args.withSubmissions = true;
    }
  }
  return args;
}

async function seedWeek(weeksAgo, setIndex) {
  const { weekStart, weekEnd } = shiftWeeksFromToday(weeksAgo);
  const templateSet = CHALLENGE_WEEK_SETS[setIndex % CHALLENGE_WEEK_SETS.length];
  const status = weeksAgo === 0 ? 'active' : 'closed';
  let created = 0;

  console.log(`\n📅 Тиждень −${weeksAgo}: ${weekStart} — ${weekEnd} (${status})`);

  for (const type of TYPE_ORDER) {
    const tpl = templateSet[type];
    const slug = `${SLUG_PREFIX[type]}-${weekStart}`;

    const [existing] = await pool.execute('SELECT id FROM challenges WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      console.log(`  · вже є: ${slug}`);
      continue;
    }

    await Challenge.create({
      slug,
      title: tpl.title,
      description: tpl.description,
      challengeType: type,
      weekStart,
      weekEnd,
      criteria: tpl.criteria,
      pointsMax: tpl.pointsMax,
      status,
    });
    console.log(`  ✓ ${slug}`);
    created += 1;
  }

  return { weekStart, weekEnd, created };
}

async function seedDemoSubmissions(weeksCount) {
  const [users] = await pool.execute(
    'SELECT id, username FROM users ORDER BY id ASC LIMIT 15'
  );
  if (users.length === 0) {
    console.log('\n⚠ Немає користувачів — пропускаємо демо-рішення');
    return;
  }

  console.log(`\n📝 Демо-рішення (користувачів: ${users.length})...`);

  for (let weeksAgo = 1; weeksAgo <= weeksCount; weeksAgo += 1) {
    const { weekStart } = shiftWeeksFromToday(weeksAgo);
    const [challenges] = await pool.execute(
      'SELECT id, title, challenge_type, points_max FROM challenges WHERE week_start = ?',
      [weekStart]
    );

    for (const ch of challenges) {
      const participantCount = 2 + Math.floor(Math.random() * Math.min(4, users.length));
      const shuffled = [...users].sort(() => Math.random() - 0.5).slice(0, participantCount);

      for (const u of shuffled) {
        const [has] = await pool.execute(
          'SELECT id FROM challenge_submissions WHERE challenge_id = ? AND user_id = ?',
          [ch.id, u.id]
        );
        if (has.length > 0) continue;

        const maxPts = ch.points_max || 100;
        const score = Math.floor(maxPts * (0.45 + Math.random() * 0.5));
        const text = `Демо-рішення від ${u.username} для «${ch.title}».\n\nОпис підходу, фрагмент коду та висновки для архіву тижня ${weekStart}.`;
        const feedback = 'Автоматична демо-оцінка для історії челенджів.';

        await pool.execute(
          `INSERT INTO challenge_submissions
           (challenge_id, user_id, solution_url, solution_text, score, ai_feedback, submitted_at)
           VALUES (?, ?, NULL, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
          [ch.id, u.id, text, score, feedback, weeksAgo * 7 + 2]
        );
      }
    }
    console.log(`  ✓ тиждень ${weekStart}`);
  }
}

async function main() {
  const { weeks, withSubmissions } = parseArgs(process.argv);

  try {
    console.log(`\n🌱 Seed челенджів за ${weeks} минулих тижнів (+ поточний)...\n`);

    let totalCreated = 0;
    for (let weeksAgo = weeks; weeksAgo >= 0; weeksAgo -= 1) {
      const setIndex = weeks - weeksAgo;
      const { created } = await seedWeek(weeksAgo, setIndex);
      totalCreated += created;
    }

    if (withSubmissions) {
      await seedDemoSubmissions(weeks);
    }

    const [weekRows] = await pool.execute(
      'SELECT COUNT(DISTINCT week_start) AS w FROM challenges'
    );
    console.log(`\n✅ Готово. Створено челенджів: ${totalCreated}. Тижнів у БД: ${weekRows[0]?.w || 0}\n`);
  } catch (e) {
    console.error('❌ Помилка:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
