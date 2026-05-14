/**
 * API роути для статистики
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/stats/overview
 * Загальна статистика платформи
 */
router.get('/overview', async (req, res) => {
  try {
    // Загальна кількість
    const [totalStats] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM questions) as total_questions,
        (SELECT COUNT(*) FROM answers) as total_answers,
        (SELECT COUNT(*) FROM votes) as total_votes
    `);

    // Статистика за сьогодні
    const [todayStats] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM questions WHERE DATE(created_at) = CURDATE()) as questions_today,
        (SELECT COUNT(*) FROM answers WHERE DATE(created_at) = CURDATE()) as answers_today,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()) as users_today
    `);

    // Статистика за тиждень
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
  try {
    const { limit = 10 } = req.query;

    const [users] = await pool.execute(
      `SELECT
         u.id,
         u.username,
         u.reputation,
         (SELECT COUNT(*) FROM questions WHERE author_id = u.id) as questions_count,
         (SELECT COUNT(*) FROM answers WHERE author_id = u.id) as answers_count
       FROM users u
       WHERE u.role != 'admin'
       ORDER BY u.reputation DESC, u.created_at ASC
       LIMIT ?`,
      [parseInt(limit)]
    );

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
    const { limit = 20 } = req.query;

    // Отримати всі теги з питань
    const [questions] = await pool.execute('SELECT tags FROM questions');

    // Підрахунок тегів
    const tagCounts = {};
    questions.forEach(q => {
      const tags = typeof q.tags === 'string' ? JSON.parse(q.tags) : q.tags;
      if (Array.isArray(tags)) {
        tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    // Сортування та обмеження
    const topTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

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
 * Остання активність на платформі
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Останні питання
    const [recentQuestions] = await pool.execute(
      `SELECT
         q.id,
         q.title,
         q.created_at,
         u.username as author_name
       FROM questions q
       JOIN users u ON q.author_id = u.id
       ORDER BY q.created_at DESC
       LIMIT ?`,
      [parseInt(limit)]
    );

    // Останні відповіді
    const [recentAnswers] = await pool.execute(
      `SELECT
         a.id,
         a.created_at,
         q.id as question_id,
         q.title as question_title,
         u.username as author_name
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       JOIN users u ON a.author_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [parseInt(limit)]
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
 * Питання без відповідей
 */
router.get('/unanswered', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const [questions] = await pool.execute(
      `SELECT
         q.id,
         q.title,
         q.tags,
         q.views,
         q.created_at,
         u.username as author_name,
         COALESCE(
           (SELECT SUM(CASE WHEN vote_type = 'up' THEN 1 WHEN vote_type = 'down' THEN -1 ELSE 0 END)
            FROM votes WHERE entity_type = 'question' AND entity_id = q.id),
           0
         ) as votes
       FROM questions q
       JOIN users u ON q.author_id = u.id
       WHERE (SELECT COUNT(*) FROM answers WHERE question_id = q.id) = 0
       ORDER BY q.created_at DESC
       LIMIT ?`,
      [parseInt(limit)]
    );

    const formattedQuestions = questions.map(q => ({
      ...q,
      tags: typeof q.tags === 'string' ? JSON.parse(q.tags) : q.tags,
    }));

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
