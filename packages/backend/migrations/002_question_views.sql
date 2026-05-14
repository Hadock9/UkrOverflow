-- Унікальні перегляди питань (один рядок на пару питання + глядач)
-- Запуск: mysql ... < migrations/002_question_views.sql
-- Або: npm run migrate (таблиця також створюється у migrate.js)

CREATE TABLE IF NOT EXISTS question_views (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question_id INT NOT NULL,
  viewer_key VARCHAR(96) NOT NULL,
  viewed_at DATETIME NOT NULL,
  UNIQUE KEY uq_question_viewer (question_id, viewer_key),
  INDEX idx_question (question_id),
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
