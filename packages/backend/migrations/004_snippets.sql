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

CREATE TABLE IF NOT EXISTS snippet_views (
  id INT PRIMARY KEY AUTO_INCREMENT,
  snippet_id INT NOT NULL,
  viewer_key VARCHAR(96) NOT NULL,
  viewed_at DATETIME NOT NULL,
  UNIQUE KEY uq_snippet_viewer (snippet_id, viewer_key),
  INDEX idx_snippet (snippet_id),
  FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
