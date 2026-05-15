/**
 * Seed стрічки новин DevFlow.
 *
 * Запуск (з кореня репозиторію):
 *   npm run migrate
 *   npm run seed:news              # 8 зразкових новин (пропуск, якщо вже є записи)
 *   npm run seed:news:large        # ~400 новин, bulk INSERT (пропуск, якщо вже >= 400)
 *   npm run seed:news:large -- --force   # очистити news_posts і засіяти знову
 *
 * З packages/backend:
 *   node src/scripts/seedNews.js
 *   node src/scripts/seedNews.js --large
 *   node src/scripts/seedNews.js --large --force
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../config/database.js';
import { buildNewsDataset, generateBulkNews, SAMPLE_NEWS } from './newsSeedGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendRoot, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });

const LARGE_TARGET = 400;
const BATCH_SIZE = 50;
const MS_DAY = 24 * 60 * 60 * 1000;
const SPAN_DAYS = 540; // ~18 місяців

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    large: args.includes('--large') || args.includes('-l'),
    force: args.includes('--force') || args.includes('-f'),
  };
}

async function resolveAuthorIds() {
  const [rows] = await pool.execute(`SELECT id FROM users ORDER BY id ASC`);
  if (!rows.length) {
    throw new Error('Немає користувачів у БД. Спочатку запустіть npm run seed або створіть акаунт.');
  }
  return rows.map((r) => r.id);
}

async function clearNews() {
  try {
    await pool.execute('DELETE FROM news_post_views');
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE' && err?.errno !== 1146) throw err;
  }
  await pool.execute('DELETE FROM news_posts');
}

function publishedAtForIndex(index, total) {
  const dayOffset = Math.floor((index / Math.max(total - 1, 1)) * SPAN_DAYS);
  const jitterHours = (index * 37) % 20;
  return new Date(Date.now() - dayOffset * MS_DAY - jitterHours * 60 * 60 * 1000);
}

async function bulkInsertNews(items, authorIds) {
  let inserted = 0;
  const total = items.length;

  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(', ');
    const values = [];

    batch.forEach((item, batchIndex) => {
      const globalIndex = offset + batchIndex;
      const authorId = authorIds[globalIndex % authorIds.length];
      values.push(
        item.title,
        item.summary,
        item.body,
        item.slug,
        authorId,
        publishedAtForIndex(globalIndex, total),
        item.isPinned ? 1 : 0,
        JSON.stringify(item.tags || []),
        item.category || 'tech',
        item.views ?? 0
      );
    });

    await pool.execute(
      `INSERT INTO news_posts (title, summary, body, slug, author_id, published_at, is_pinned, tags, category, views, created_at, updated_at)
       VALUES ${placeholders}`,
      values
    );
    inserted += batch.length;
    process.stdout.write(`\r  … вставлено ${inserted}/${total}`);
  }
  process.stdout.write('\n');
  return inserted;
}

async function seedNews() {
  const { large, force } = parseArgs();
  const targetCount = large ? LARGE_TARGET : SAMPLE_NEWS.length;

  try {
    const authorIds = await resolveAuthorIds();
    const [[{ c: existingCount }]] = await pool.execute('SELECT COUNT(*) AS c FROM news_posts');

    if (large) {
      if (!force && existingCount >= LARGE_TARGET) {
        console.log(`ℹ️ У таблиці news_posts вже ${existingCount} записів (>= ${LARGE_TARGET}). Пропускаємо. Додайте --force для пересіву.`);
        return;
      }
      if (force && existingCount > 0) {
        console.log('🗑️  --force: очищення news_posts…');
        await clearNews();
      } else if (!force && existingCount > 0 && existingCount < LARGE_TARGET) {
        console.log(`ℹ️ Є ${existingCount} новин — додаємо ще ${LARGE_TARGET - existingCount} до ${LARGE_TARGET}…`);
      }
    } else if (!force && existingCount > 0) {
      console.log(`ℹ️ У таблиці news_posts вже є ${existingCount} запис(ів). Пропускаємо seed. Додайте --force або npm run seed:news:large`);
      return;
    } else if (force && existingCount > 0) {
      console.log('🗑️  --force: очищення news_posts…');
      await clearNews();
    }

    const needTotal = large ? LARGE_TARGET : targetCount;
    const [[{ c: afterClear }]] = await pool.execute('SELECT COUNT(*) AS c FROM news_posts');
    const toInsert = Math.max(0, needTotal - afterClear);

    if (toInsert === 0) {
      console.log('ℹ️ Нічого додавати.');
      return;
    }

    let dataset;
    if (large && afterClear === 0) {
      dataset = buildNewsDataset(LARGE_TARGET);
    } else if (large) {
      dataset = generateBulkNews(toInsert, { seedOffset: afterClear });
    } else {
      dataset = buildNewsDataset(SAMPLE_NEWS.length);
    }

    console.log(
      `📰 Додаємо ${dataset.length} новин (режим: ${large ? 'large' : 'sample'}, авторів: ${authorIds.length})…\n`
    );
    const inserted = await bulkInsertNews(dataset, authorIds);
    const [[{ c: finalCount }]] = await pool.execute('SELECT COUNT(*) AS c FROM news_posts');
    console.log(`\n✅ Seed новин завершено. Вставлено: ${inserted}, всього в БД: ${finalCount}.`);
  } finally {
    await pool.end();
  }
}

seedNews().catch((err) => {
  console.error('❌ Помилка seed новин:', err);
  process.exit(1);
});
