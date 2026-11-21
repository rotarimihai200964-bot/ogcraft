CREATE TABLE IF NOT EXISTS ogcraft_chat_messages (
  id CHAR(36) PRIMARY KEY,
  category VARCHAR(32) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  author VARCHAR(16) NOT NULL,
  rank VARCHAR(24) NOT NULL,
  images JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category_created (category, created_at),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
