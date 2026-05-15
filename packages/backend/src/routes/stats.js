/**
 * API роути для статистики
 */

import express from 'express';
import pool from '../config/database.js';
import { sqlLimit } from '../utils/sqlLimit.js';

const router = express.Router();

/**
 * GET /api/stats/overview
 * Загальна статистика платформи
 */
router.get('/overview', async (req, res) => {
  try {
    const [totalStats] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM questions) as total_questions,
        (SELECT COUNT(*) FROM answers) as total_answers,
        (SELECT COUNT(*) FROM votes) as total_votes
    `);

    const [todayStats] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM questions WHERE DATE(created_at) = CURDATE()) as questions_today,
        (SELECT COUNT(*) FROM answers WHERE DATE(created_at) = CURDATE()) as answers_today,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()) as users_today
    `);

    const [weekStats] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM questions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as questions_week,
        (SELECT COUNT(*) FROM answers WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as answers_week,
        (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as users_week
    `);

    res.json({
      success: true,
      data: {
        total: totalStats[0],
        today: todayStats[0],
        week: weekStats[0],
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання статистики',
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/top-users
 * Топ користувачів за репутацією
 */
router.get('/top-users', async (req, res) => {
  const limit = sqlLimit(req.query.limit, 10, 50);

  const queryWithRole = `
    SELECT
      u.id,
      u.username,
      COALESCE(u.reputation, 0) AS reputation,
      (SELECT COUNT(*) FROM questions WHERE author_id = u.id) AS questions_count,
      (SELECT COUNT(*) FROM answers WHERE author_id = u.id) AS answers_count
    FROM users u
    WHERE COALESCE(u.role, 'user') != 'admin'
    ORDER BY COALESCE(u.reputation, 0) DESC, u.created_at ASC
    LIMIT ${limit}`;

  const queryFallback = `
    SELECT
      u.id,
      u.username,
      0 AS reputation,
      (SELECT COUNT(*) FROM questions WHERE author_id = u.id) AS questions_count,
      (SELECT COUNT(*) FROM answers WHERE author_id = u.id) AS answers_count
    FROM users u
    ORDER BY u.created_at ASC
    LIMIT ${limit}`;

  try {
    let users;
    try {
      [users] = await pool.execute(queryWithRole);
    } catch (inner) {
      if (inner?.errno === 1054) {
        console.warn('[stats/top-users] fallback query (missing role/reputation column)');
        [users] = await pool.execute(queryFallback);
      } else {
        throw inner;
      }
    }

    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    console.error('Error fetching top users:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання топ користувачів',
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/top-tags
 * Найпопулярніші теги
 */
router.get('/top-tags', async (req, res) => {
  try {
    const limit = sqlLimit(req.query.limit, 20, 100);

    const [questions] = await pool.execute('SELECT tags FROM questions');

    const tagCounts = {};
    for (const q of questions) {
      let tags = q.tags;
      if (typeof tags === 'string') {
        try {
          tags = JSON.parse(tags);
        } catch {
          tags = [];
        }
      }
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          const key = String(tag).toLowerCase();
          if (key) tagCounts[key] = (tagCounts[key] || 0) + 1;
        }
      }
    }

    const topTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    res.json({
      success: true,
      data: { tags: topTags },
    });
  } catch (error) {
    console.error('Error fetching top tags:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання топ тегів',
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/recent-activity
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const limit = sqlLimit(req.query.limit, 10, 50);

    const [recentQuestions] = await pool.execute(
      `SELECT
         q.id,
         q.title,
         q.created_at,
         u.username AS author_name
       FROM questions q
       JOIN users u ON q.author_id = u.id
       ORDER BY q.created_at DESC
       LIMIT ${limit}`,
    );

    const [recentAnswers] = await pool.execute(
      `SELECT
         a.id,
         a.created_at,
         q.id AS question_id,
         q.title AS question_title,
         u.username AS author_name
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       JOIN users u ON a.author_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ${limit}`,
    );

    res.json({
      success: true,
      data: {
        questions: recentQuestions,
        answers: recentAnswers,
      },
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання активності',
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/unanswered
 */
router.get('/unanswered', async (req, res) => {
  try {
    const limit = sqlLimit(req.query.limit, 10, 50);

    const [questions] = await pool.execute(
      `SELECT
         q.id,
         q.title,
         q.tags,
         q.views,
         q.created_at,
         u.username AS author_name,
         COALESCE(
           (SELECT SUM(CASE WHEN vote_type = 'up' THEN 1 WHEN vote_type = 'down' THEN -1 ELSE 0 END)
            FROM votes WHERE entity_type = 'question' AND entity_id = q.id),
           0
         ) AS votes
       FROM questions q
       JOIN users u ON q.author_id = u.id
       WHERE (SELECT COUNT(*) FROM answers WHERE question_id = q.id) = 0
       ORDER BY q.created_at DESC
       LIMIT ${limit}`,
    );

    const formattedQuestions = questions.map((q) => {
      let tags = q.tags;
      if (typeof tags === 'string') {
        try {
          tags = JSON.parse(tags);
        } catch {
          tags = [];
        }
      }
      return { ...q, tags };
    });

    res.json({
      success: true,
      data: { questions: formattedQuestions },
    });
  } catch (error) {
    console.error('Error fetching unanswered questions:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка отримання питань без відповідей',
      error: error.message,
    });
  }
});

export default router;
