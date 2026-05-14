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

CREATE TABLE IF NOT EXISTS roadmap_views (
  id INT PRIMARY KEY AUTO_INCREMENT,
  roadmap_id INT NOT NULL,
  viewer_key VARCHAR(96) NOT NULL,
  viewed_at DATETIME NOT NULL,
  UNIQUE KEY uq_roadmap_viewer (roadmap_id, viewer_key),
  INDEX idx_roadmap (roadmap_id),
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
