/**
 * DOU-style опитування для стрічки новин.
 * npm run seed:news-poll
 */

import pool from '../config/database.js';
import NewsPoll from '../models/NewsPoll.js';

async function main() {
  const id = await NewsPoll.upsertDefaultPoll();
  console.log(`✓ Опитування створено або вже існує (id=${id})`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
