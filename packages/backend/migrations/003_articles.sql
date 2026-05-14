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

CREATE TABLE IF NOT EXISTS article_views (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT NOT NULL,
  viewer_key VARCHAR(96) NOT NULL,
  viewed_at DATETIME NOT NULL,
  UNIQUE KEY uq_article_viewer (article_id, viewer_key),
  INDEX idx_article (article_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
