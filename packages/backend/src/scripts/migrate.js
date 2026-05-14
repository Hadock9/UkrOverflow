/**
 * Міграція бази даних
 * Створення нової схеми без Strapi
 */

import mysql from 'mysql2/promise';
import pool from '../config/database.js';

/** Підключення без вибору БД — створюємо схему, якщо її ще немає */
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

    // 1. Створення таблиці users
    console.log('📝 Створення таблиці users...');
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
    console.log('✓ Таблиця users створена\n');

    // 2. Створення таблиці questions
    console.log('📝 Створення таблиці questions...');
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
    console.log('✓ Таблиця questions створена\n');

    // 3. Створення таблиці answers
    console.log('📝 Створення таблиці answers...');
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
    console.log('✓ Таблиця answers створена\n');

    // 4. Створення таблиці votes
    console.log('📝 Створення таблиці votes...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS votes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        entity_type ENUM('question', 'answer') NOT NULL,
        entity_id INT NOT NULL,
        vote_type ENUM('up', 'down') NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_vote (user_id, entity_type, entity_id),
        INDEX idx_entity (entity_type, entity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Таблиця votes створена\n');

    // 5. Створення таблиці notifications
    console.log('📝 Створення таблиці notifications...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('question_answer', 'answer_comment', 'answer_accepted', 'vote', 'mention') NOT NULL,
        entity_type ENUM('question', 'answer') NOT NULL,
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
    console.log('✓ Таблиця notifications створена\n');

    // 6. Створення таблиці bookmarks
    console.log('📝 Створення таблиці bookmarks...');
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
    console.log('✓ Таблиця bookmarks створена\n');

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
