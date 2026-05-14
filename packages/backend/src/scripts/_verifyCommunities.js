import 'dotenv/config';
import pool from '../config/database.js';

(async () => {
  try {
    const tables = ['communities', 'community_memberships', 'community_posts', 'community_post_comments', 'mentor_profiles'];
    for (const t of tables) {
      const [[r]] = await pool.execute(`SELECT COUNT(*) as c FROM ${t}`);
      console.log(`${t}: ${r.c}`);
    }
  } finally {
    await pool.end();
  }
})();
