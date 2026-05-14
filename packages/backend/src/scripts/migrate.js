/**
 * Міграція бази даних
 * Knowledge Hub: ядро content_items + спеціалізовані таблиці.
 * Старі таблиці questions/answers лишаються (legacy) для сумісності з існуючими сторінками.
 */

import mysql from 'mysql2/promise';
import pool from '../config/database.js';

async function ensureDatabaseExists() {
  const dbName = process.env.DB_NAME;
  if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error('DB_NAME має містити лише літери, цифри та підкреслення');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✓ База даних "${dbName}" готова\n`);
  } finally {
    await connection.end();
  }
}

async function migrate() {
  await ensureDatabaseExists();

  const connection = await pool.getConnection();

  try {
    console.log('🔄 Початок міграції бази даних...\n');

    // 1. users
    console.log('📝 users...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(30) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        reputation INT DEFAULT 0,
        role ENUM('user', 'moderator', 'admin') DEFAULT 'user',
        bio TEXT,
        location VARCHAR(100),
        website VARCHAR(255),
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_reputation (reputation)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ users\n');

    // 2. legacy questions
    console.log('📝 questions (legacy)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        tags JSON NOT NULL,
        author_id INT NOT NULL,
        views INT DEFAULT 0,
        upvotes INT DEFAULT 0,
        downvotes INT DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_author (author_id),
        INDEX idx_created (created_at),
        INDEX idx_views (views),
        FULLTEXT INDEX idx_search (title, body)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ questions\n');

    // 3. legacy answers
    console.log('📝 answers (legacy)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS answers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        body TEXT NOT NULL,
        question_id INT NOT NULL,
        author_id INT NOT NULL,
        is_accepted BOOLEAN DEFAULT FALSE,
        upvotes INT DEFAULT 0,
        downvotes INT DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_question (question_id),
        INDEX idx_author (author_id),
        INDEX idx_accepted (is_accepted),
        FULLTEXT INDEX idx_search (body)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ answers\n');

    // 4. votes
    console.log('📝 votes...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS votes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        entity_type ENUM('question', 'answer', 'content', 'content_answer') NOT NULL,
        entity_id INT NOT NULL,
        vote_type ENUM('up', 'down') NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_vote (user_id, entity_type, entity_id),
        INDEX idx_entity (entity_type, entity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    // Якщо таблиця існувала зі старим enum — мовчки розширюємо
    try {
      await connection.execute(`
        ALTER TABLE votes
        MODIFY COLUMN entity_type ENUM('question','answer','content','content_answer') NOT NULL
      `);
    } catch (e) {
      if (!String(e?.message || '').includes('cannot be null')) {
        // ігноруємо
      }
    }
    console.log('✓ votes\n');

    // 5. notifications
    console.log('📝 notifications...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('question_answer', 'answer_comment', 'answer_accepted', 'vote', 'mention', 'content_answer') NOT NULL,
        entity_type ENUM('question', 'answer', 'content', 'content_answer') NOT NULL,
        entity_id INT NOT NULL,
        data JSON,
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_read (is_read),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    try {
      await connection.execute(`
        ALTER TABLE notifications
        MODIFY COLUMN type ENUM('question_answer','answer_comment','answer_accepted','vote','mention','content_answer') NOT NULL
      `);
      await connection.execute(`
        ALTER TABLE notifications
        MODIFY COLUMN entity_type ENUM('question','answer','content','content_answer') NOT NULL
      `);
    } catch {
      /* ігноруємо */
    }
    console.log('✓ notifications\n');

    // 6. bookmarks (legacy)
    console.log('📝 bookmarks (legacy)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        question_id INT NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        UNIQUE KEY unique_bookmark (user_id, question_id),
        INDEX idx_user (user_id),
        INDEX idx_question (question_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ bookmarks\n');

    // 7. question_views (legacy)
    console.log('📝 question_views (legacy)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS question_views (
        id INT PRIMARY KEY AUTO_INCREMENT,
        question_id INT NOT NULL,
        viewer_key VARCHAR(96) NOT NULL,
        viewed_at DATETIME NOT NULL,
        UNIQUE KEY uq_question_viewer (question_id, viewer_key),
        INDEX idx_question (question_id),
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ question_views\n');

    // === KNOWLEDGE HUB: окремі таблиці на тип ===

    // 8. articles
    console.log('📝 articles...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS articles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        excerpt VARCHAR(280) NOT NULL,
        tags JSON NOT NULL,
        author_id INT NOT NULL,
        views INT DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_author (author_id),
        INDEX idx_created (created_at),
        INDEX idx_views (views),
        FULLTEXT INDEX idx_article_search (title, body, excerpt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS article_views (
        id INT PRIMARY KEY AUTO_INCREMENT,
        article_id INT NOT NULL,
        viewer_key VARCHAR(96) NOT NULL,
        viewed_at DATETIME NOT NULL,
        UNIQUE KEY uq_article_viewer (article_id, viewer_key),
        INDEX idx_article (article_id),
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ articles\n');

    // 9. guides
    console.log('📝 guides...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS guides (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        summary VARCHAR(280) NOT NULL,
        excerpt VARCHAR(280) NOT NULL,
        body TEXT NOT NULL,
        difficulty ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
        estimated_minutes INT NOT NULL DEFAULT 15,
        tags JSON NOT NULL,
        author_id INT NOT NULL,
        views INT DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_author (author_id),
        INDEX idx_created (created_at),
        INDEX idx_views (views),
        INDEX idx_difficulty (difficulty),
        FULLTEXT INDEX idx_guide_search (title, summary, body, excerpt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS guide_views (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guide_id INT NOT NULL,
        viewer_key VARCHAR(96) NOT NULL,
        viewed_at DATETIME NOT NULL,
        UNIQUE KEY uq_guide_viewer (guide_id, viewer_key),
        INDEX idx_guide (guide_id),
        FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ guides\n');

    // 10. snippets
    console.log('📝 snippets...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS snippets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        excerpt VARCHAR(280) NOT NULL,
        code MEDIUMTEXT NOT NULL,
        language VARCHAR(40) NOT NULL,
        tags JSON NOT NULL,
        author_id INT NOT NULL,
        views INT DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_author (author_id),
        INDEX idx_created (created_at),
        INDEX idx_views (views),
        INDEX idx_language (language),
        FULLTEXT INDEX idx_snippet_search (title, description, excerpt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS snippet_views (
        id INT PRIMARY KEY AUTO_INCREMENT,
        snippet_id INT NOT NULL,
        viewer_key VARCHAR(96) NOT NULL,
        viewed_at DATETIME NOT NULL,
        UNIQUE KEY uq_snippet_viewer (snippet_id, viewer_key),
        INDEX idx_snippet (snippet_id),
        FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ snippets\n');

    // 11. roadmaps
    console.log('📝 roadmaps...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS roadmaps (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        summary VARCHAR(280) NOT NULL,
        excerpt VARCHAR(280) NOT NULL,
        body TEXT NOT NULL,
        steps JSON NOT NULL,
        difficulty ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
        estimated_weeks INT NOT NULL DEFAULT 4,
        tags JSON NOT NULL,
        author_id INT NOT NULL,
        views INT DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_author (author_id),
        INDEX idx_created (created_at),
        INDEX idx_views (views),
        INDEX idx_difficulty (difficulty),
        FULLTEXT INDEX idx_roadmap_search (title, summary, body, excerpt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS roadmap_views (
        id INT PRIMARY KEY AUTO_INCREMENT,
        roadmap_id INT NOT NULL,
        viewer_key VARCHAR(96) NOT NULL,
        viewed_at DATETIME NOT NULL,
        UNIQUE KEY uq_roadmap_viewer (roadmap_id, viewer_key),
        INDEX idx_roadmap (roadmap_id),
        FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ roadmaps\n');

    // 12. best_practices
    console.log('📝 best_practices...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS best_practices (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        rule VARCHAR(500) NOT NULL,
        excerpt VARCHAR(280) NOT NULL,
        body TEXT NOT NULL,
        anti_patterns TEXT NULL,
        category VARCHAR(80) NULL,
        tags JSON NOT NULL,
        author_id INT NOT NULL,
        views INT DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_author (author_id),
        INDEX idx_created (created_at),
        INDEX idx_views (views),
        INDEX idx_category (category),
        FULLTEXT INDEX idx_bp_search (title, rule, body, excerpt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS best_practice_views (
        id INT PRIMARY KEY AUTO_INCREMENT,
        best_practice_id INT NOT NULL,
        viewer_key VARCHAR(96) NOT NULL,
        viewed_at DATETIME NOT NULL,
        UNIQUE KEY uq_bp_viewer (best_practice_id, viewer_key),
        INDEX idx_bp (best_practice_id),
        FOREIGN KEY (best_practice_id) REFERENCES best_practices(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ best_practices\n');

    // 13. faqs
    console.log('📝 faqs...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS faqs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        topic VARCHAR(120) NOT NULL,
        excerpt VARCHAR(280) NOT NULL,
        body TEXT NOT NULL,
        qa_pairs JSON NOT NULL,
        tags JSON NOT NULL,
        author_id INT NOT NULL,
        views INT DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_author (author_id),
        INDEX idx_created (created_at),
        INDEX idx_views (views),
        INDEX idx_topic (topic),
        FULLTEXT INDEX idx_faq_search (title, topic, body, excerpt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS faq_views (
        id INT PRIMARY KEY AUTO_INCREMENT,
        faq_id INT NOT NULL,
        viewer_key VARCHAR(96) NOT NULL,
        viewed_at DATETIME NOT NULL,
        UNIQUE KEY uq_faq_viewer (faq_id, viewer_key),
        INDEX idx_faq (faq_id),
        FOREIGN KEY (faq_id) REFERENCES faqs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ faqs\n');

    // === KNOWLEDGE HUB CORE (універсальне сховище) ===

    // 14. content_items — універсальне ядро (питання, статті, гайди, snippets, roadmaps, best_practices, faq)
    console.log('📝 content_items (knowledge hub)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS content_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        type ENUM('question','article','guide','snippet','roadmap','best_practice','faq') NOT NULL,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(280) NOT NULL,
        body MEDIUMTEXT NOT NULL,
        excerpt VARCHAR(500) NULL,
        tags JSON NULL,
        author_id INT NOT NULL,
        status ENUM('draft','published','archived') DEFAULT 'published',
        difficulty ENUM('beginner','intermediate','advanced') NULL,
        technology VARCHAR(80) NULL,
        estimated_read_time INT NULL,
        meta JSON NULL,
        views INT DEFAULT 0,
        is_featured BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        published_at DATETIME NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_slug (slug),
        INDEX idx_type (type),
        INDEX idx_type_published (type, published_at),
        INDEX idx_author (author_id),
        INDEX idx_views (views),
        INDEX idx_technology (technology),
        FULLTEXT INDEX idx_search (title, body, excerpt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ content_items\n');

    // 9. content_answers — відповіді лише на content_items типу 'question'
    console.log('📝 content_answers...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS content_answers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        content_id INT NOT NULL,
        body MEDIUMTEXT NOT NULL,
        author_id INT NOT NULL,
        is_accepted BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_content (content_id),
        INDEX idx_author (author_id),
        INDEX idx_accepted (is_accepted),
        FULLTEXT INDEX idx_search (body)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ content_answers\n');

    // 10. content_views — унікальні перегляди (дедуплікація)
    console.log('📝 content_views...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS content_views (
        id INT PRIMARY KEY AUTO_INCREMENT,
        content_id INT NOT NULL,
        viewer_key VARCHAR(96) NOT NULL,
        viewed_at DATETIME NOT NULL,
        UNIQUE KEY uq_content_viewer (content_id, viewer_key),
        INDEX idx_content (content_id),
        FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ content_views\n');

    // 11. content_bookmarks
    console.log('📝 content_bookmarks...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS content_bookmarks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        content_id INT NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
        UNIQUE KEY unique_bookmark (user_id, content_id),
        INDEX idx_user (user_id),
        INDEX idx_content (content_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ content_bookmarks\n');

    console.log('✅ Міграція завершена успішно!');
  } catch (error) {
    console.error('❌ Помилка міграції:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Фатальна помилка:', error);
  process.exit(1);
});
