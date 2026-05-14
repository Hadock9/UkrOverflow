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

CREATE TABLE IF NOT EXISTS faq_views (
  id INT PRIMARY KEY AUTO_INCREMENT,
  faq_id INT NOT NULL,
  viewer_key VARCHAR(96) NOT NULL,
  viewed_at DATETIME NOT NULL,
  UNIQUE KEY uq_faq_viewer (faq_id, viewer_key),
  INDEX idx_faq (faq_id),
  FOREIGN KEY (faq_id) REFERENCES faqs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
