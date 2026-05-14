-- Міграція для додавання блокування користувачів

-- Додавання колонок blocked та blocked_at
ALTER TABLE users
ADD COLUMN blocked TINYINT(1) DEFAULT 0 AFTER role,
ADD COLUMN blocked_at DATETIME NULL AFTER blocked;
