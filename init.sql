-- ====================================================================
-- База данных: MySQL / MariaDB
-- Проект: Социальная сеть "SocialNet"
-- ====================================================================

-- 1. Создание базы данных (если не создана)
CREATE DATABASE IF NOT EXISTS social_network
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE social_network;

-- 2. Создание таблицы пользователей (users)
-- Поля:
--   - id: уникальный идентификатор (первичный ключ, автоинкремент)
--   - username: уникальное имя пользователя (до 50 символов)
--   - email: уникальный адрес электронной почты (до 100 символов)
--   - password_hash: хеш пароля bcrypt (255 символов)
--   - created_at: дата и время регистрации (по умолчанию текущее время)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Примеры типовых SQL-запросов, используемых в приложении:

-- А. Проверка существования пользователя перед регистрацией:
-- SELECT id, username, email FROM users WHERE username = ? OR email = ?;

-- Б. Регистрация нового пользователя (INSERT):
-- INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?);

-- В. Аутентификация / Вход (SELECT по email):
-- SELECT id, username, email, password_hash, created_at FROM users WHERE email = ?;

-- Г. Получение списка всех пользователей без паролей (SELECT с сортировкой):
-- SELECT id, username, email, created_at FROM users ORDER BY created_at DESC;

-- Д. Поиск пользователей по имени или email (WHERE ... LIKE):
-- SELECT id, username, email, created_at FROM users 
-- WHERE username LIKE ? OR email LIKE ? 
-- ORDER BY created_at DESC;

-- Е. Удаление собственного профиля (DELETE):
-- DELETE FROM users WHERE id = ?;
