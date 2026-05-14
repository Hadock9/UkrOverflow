/**
 * Модель Question
 */

import pool from '../config/database.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';

export class Question {
  /**
   * Створення питання
   */
  static async create({ title, body, tags, authorId }) {
    const [result] = await pool.execute(
      `INSERT INTO questions (title, body, tags, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [title, body, JSON.stringify(tags), authorId]
    );

    return this.findById(result.insertId);
  }

  /**
   * Пошук питання за ID (без зміни лічильника переглядів — див. recordView)
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT q.*, u.username as author_name,
              (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count,
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'question' AND entity_id = q.id AND vote_type = 'up') as upvotes,
              (SELECT COUNT(*) FROM votes WHERE entity_type = 'question' AND entity_id = q.id AND vote_type = 'down') as downvotes
       FROM questions q
       JOIN users u ON q.author_id = u.id
       WHERE q.id = ?`,
      [id]
    );

    if (rows[0]) {
      try {
        rows[0].tags = typeof rows[0].tags === 'string' ? JSON.parse(rows[0].tags) : rows[0].tags || [];
      } catch (e) {
        console.error('Failed to parse tags:', rows[0].tags, e);
        rows[0].tags = [];
      }
      rows[0].votes = rows[0].upvotes - rows[0].downvotes;
      rows[0].type = CONTENT_TYPES.QUESTION;
    }

    return rows[0] || null;
  }

  /**
   * Один унікальний перегляд на viewer_key (користувач або анонімний UUID).
   * Повертає поточне значення views і чи було збільшення.
   */
  static async recordView(questionId, viewerKey) {
    if (!viewerKey || viewerKey.length > 96) {
      throw new Error('Некоректний ключ глядача');
    }

    const [exists] = await pool.execute('SELECT id FROM questions WHERE id = ?', [questionId]);
    if (!exists.length) {
      return null;
    }

    try {
      const [insertResult] = await pool.execute(
        `INSERT IGNORE INTO question_views (question_id, viewer_key, viewed_at)
         VALUES (?, ?, NOW())`,
        [questionId, viewerKey]
      );

      if (insertResult.affectedRows === 1) {
        await pool.execute('UPDATE questions SET views = views + 1 WHERE id = ?', [questionId]);
      }

      const [[{ views }]] = await pool.execute('SELECT views FROM questions WHERE id = ?', [questionId]);
      return {
        counted: insertResult.affectedRows === 1,
        views
      };
    } catch (err) {
      const noTable =
        err?.code === 'ER_NO_SUCH_TABLE' ||
        err?.errno === 1146 ||
        String(err?.sqlMessage || err?.message || '').includes('question_views');
      if (!noTable) {
        throw err;
      }
      console.warn(
        '[Question] Немає таблиці question_views — виконайте `npm run migrate` у packages/backend. Тимчасовий режим: +1 без дедуплікації.'
      );
      await pool.execute('UPDATE questions SET views = views + 1 WHERE id = ?', [questionId]);
      const [[{ views }]] = await pool.execute('SELECT views FROM questions WHERE id = ?', [questionId]);
      return { counted: true, views };
    }
  }

  /**
   * Список питань
   */
  static async list({ page = 1, limit = 20, sortBy = 'created_at', tag = null, authorId = null, search = null } = {}) {
    const offset = (page - 1) * limit;
    const allowedSorts = ['created_at', 'views', 'votes'];
    const sort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';

    let query = `
      SELECT q.*, u.username as author_name,
             (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count,
             (SELECT COUNT(*) FROM votes WHERE entity_type = 'question' AND entity_id = q.id AND vote_type = 'up') -
             (SELECT COUNT(*) FROM votes WHERE entity_type = 'question' AND entity_id = q.id AND vote_type = 'down') as votes
      FROM questions q
      JOIN users u ON q.author_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (tag) {
      query += ' AND JSON_CONTAINS(q.tags, ?)';
      params.push(JSON.stringify(tag));
    }

    if (authorId) {
      query += ' AND q.author_id = ?';
      params.push(authorId);
    }

    if (search) {
      query += ' AND (q.title LIKE ? OR q.body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const orderCol = sort === 'votes' ? 'votes' : `q.${sort}`;
    query += ` ORDER BY ${orderCol} DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

    const [rows] = params.length > 0 ? await pool.execute(query, params) : await pool.query(query);

    // Парсинг тегів + тип для уніфікованого фіду /api/content
    rows.forEach(row => {
      try {
        row.tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
      } catch (e) {
        console.error('Failed to parse tags:', row.tags, e);
        row.tags = [];
      }
      row.type = CONTENT_TYPES.QUESTION;
    });

    // Підрахунок загальної кількості
    let countQuery = 'SELECT COUNT(*) as total FROM questions WHERE 1=1';
    const countParams = [];

    if (tag) {
      countQuery += ' AND JSON_CONTAINS(tags, ?)';
      countParams.push(JSON.stringify(tag));
    }

    if (authorId) {
      countQuery += ' AND author_id = ?';
      countParams.push(authorId);
    }

    if (search) {
      countQuery += ' AND (title LIKE ? OR body LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await pool.execute(countQuery, countParams);

    return {
      questions: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Оновлення питання
   */
  static async update(id, { title, body, tags }) {
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (body !== undefined) {
      updates.push('body = ?');
      values.push(body);
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(tags));
    }

    if (updates.length === 0) {
      throw new Error('Немає даних для оновлення');
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(
      `UPDATE questions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  /**
   * Видалення питання
   */
  static async delete(id) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Видалення голосів на відповіді
      await connection.execute(
        'DELETE v FROM votes v JOIN answers a ON v.entity_id = a.id WHERE a.question_id = ? AND v.entity_type = "answer"',
        [id]
      );

      // Видалення відповідей
      await connection.execute('DELETE FROM answers WHERE question_id = ?', [id]);

      // Видалення голосів на питання
      await connection.execute(
        'DELETE FROM votes WHERE entity_type = "question" AND entity_id = ?',
        [id]
      );

      // Видалення питання
      await connection.execute('DELETE FROM questions WHERE id = ?', [id]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Отримання унікальних тегів
   */
  static async getTags() {
    const [rows] = await pool.execute('SELECT tags FROM questions');

    const tagMap = new Map();

    rows.forEach(row => {
      try {
        const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
        tags.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      } catch (e) {
        console.error('Failed to parse tags:', row.tags, e);
      }
    });

    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}

export default Question;
