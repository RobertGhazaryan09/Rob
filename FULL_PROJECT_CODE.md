# ПОЛНЫЙ ИСХОДНЫЙ КОД ПРОЕКТА "SocialNet"
# Backend (Node.js/Express) + Frontend (React) + База данных (MySQL)

---

## 1. Скрипт базы данных MySQL (`init.sql`)

```sql
-- 1. Создание базы данных
CREATE DATABASE IF NOT EXISTS social_network
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE social_network;

-- 2. Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. SQL-запросы, используемые в приложении:

-- Проверка существования пользователя:
-- SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1;

-- Регистрация пользователя:
-- INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?);

-- Авторизация:
-- SELECT id, username, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1;

-- Получение списка пользователей:
-- SELECT id, username, email, created_at FROM users ORDER BY created_at DESC;

-- Поиск пользователей:
-- SELECT id, username, email, created_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY created_at DESC;
```

---

## 2. Подключение к MySQL (`server/db.ts`)

```typescript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

export const dbConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'social_user',
  password: process.env.MYSQL_PASSWORD || 'social_pass_2026',
  database: process.env.MYSQL_DATABASE || 'social_network',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
};

let pool: mysql.Pool | null = null;
let isConnected = false;

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<[T, mysql.FieldPacket[]]> {
  const p = await getPool();
  return (await p.execute(sql, params)) as [T, mysql.FieldPacket[]];
}

export async function initializeDatabase(): Promise<boolean> {
  try {
    const p = await getPool();
    await p.query('SELECT VERSION() as version');
    isConnected = true;
  } catch (err: any) {
    try {
      await execAsync('mkdir -p /var/run/mysqld && chown -R mysql:mysql /var/run/mysqld /var/lib/mysql && mariadbd-safe --user=mysql &');
      await new Promise((r) => setTimeout(r, 2500));
      pool = mysql.createPool(dbConfig);
      await pool.query('SELECT VERSION() as version');
      isConnected = true;
    } catch {
      isConnected = false;
      return false;
    }
  }

  try {
    const p = await getPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return true;
  } catch {
    return false;
  }
}

export function getDatabaseStatus() {
  return {
    isConnected,
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
  };
}
```

---

## 3. Сервер Express (`server.ts`)

```typescript
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { query, initializeDatabase, getDatabaseStatus } from './server/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'social_network_jwt_secret_key_2026';

app.use(express.json());

interface UserTokenPayload {
  id: number;
  username: string;
  email: string;
}

function authenticateToken(req: Request & { user?: UserTokenPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, error: 'Требуется авторизация' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      res.status(403).json({ success: false, error: 'Сессия истекла' });
      return;
    }
    req.user = decoded as UserTokenPayload;
    next();
  });
}

// 1. РЕГИСТРАЦИЯ
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      res.status(400).json({ success: false, error: 'Пожалуйста, заполните все обязательные поля.' });
      return;
    }

    const trimmedUsername = String(username).trim();
    const trimmedEmail = String(email).trim().toLowerCase();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      res.status(400).json({ success: false, error: 'Имя пользователя должно содержать от 3 до 50 символов.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 100) {
      res.status(400).json({ success: false, error: 'Введите корректный адрес электронной почты.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Пароль должен содержать минимум 6 символов.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, error: 'Пароли не совпадают.' });
      return;
    }

    // Проверка дубликатов в MySQL
    const checkSql = 'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1';
    const [existingRows] = await query<any[]>(checkSql, [trimmedUsername, trimmedEmail]);

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
      if (existing.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        res.status(400).json({ success: false, error: `Имя пользователя "${trimmedUsername}" уже занято.` });
        return;
      }
      if (existing.email.toLowerCase() === trimmedEmail) {
        res.status(400).json({ success: false, error: `Email "${trimmedEmail}" уже зарегистрирован.` });
        return;
      }
    }

    // Хеширование пароля через bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Вставка в MySQL
    const insertSql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
    const [insertResult] = await query<any>(insertSql, [trimmedUsername, trimmedEmail, passwordHash]);
    const newUserId = insertResult.insertId;

    const selectSql = 'SELECT id, username, email, created_at FROM users WHERE id = ?';
    const [userRows] = await query<any[]>(selectSql, [newUserId]);
    const newUser = userRows[0];

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Вы успешно зарегистрированы!',
      user: newUser,
      token,
    });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, error: 'Такой логин или email уже существуют.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Ошибка сервера при регистрации.' });
  }
});

// 2. ВХОД
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Введите email и пароль.' });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const selectSql = 'SELECT id, username, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1';
    const [rows] = await query<any[]>(selectSql, [trimmedEmail]);

    if (!rows || rows.length === 0) {
      res.status(401).json({ success: false, error: 'Неверный email или пароль.' });
      return;
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, error: 'Неверный email или пароль.' });
      return;
    }

    const userSafe = {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
    };

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: `С возвращением, @${user.username}!`,
      user: userSafe,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Ошибка сервера при авторизации.' });
  }
});

// 3. ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
app.get('/api/auth/me', authenticateToken, async (req: Request & { user?: UserTokenPayload }, res: Response) => {
  try {
    const userId = req.user!.id;
    const selectSql = 'SELECT id, username, email, created_at FROM users WHERE id = ? LIMIT 1';
    const [rows] = await query<any[]>(selectSql, [userId]);

    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, error: 'Пользователь не найден' });
      return;
    }
    res.json({ success: true, user: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. СПИСОК ПОЛЬЗОВАТЕЛЕЙ И ПОИСК
app.get('/api/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    let sql: string;
    let params: any[] = [];

    if (searchQuery) {
      sql = 'SELECT id, username, email, created_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY created_at DESC';
      const pattern = `%${searchQuery}%`;
      params = [pattern, pattern];
    } else {
      sql = 'SELECT id, username, email, created_at FROM users ORDER BY created_at DESC';
    }

    const [rows] = await query<any[]>(sql, params);

    res.json({
      success: true,
      users: rows || [],
      count: rows?.length || 0,
      search: searchQuery || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Ошибка при получении списка пользователей.' });
  }
});

// 5. СТАТУС БАЗЫ
app.get('/api/database/status', async (req: Request, res: Response) => {
  const status = getDatabaseStatus();
  res.json({ success: true, ...status });
});

async function startServer() {
  await initializeDatabase();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
  });
}

startServer();
```

---

## 4. Конфигурация окружения (`.env`)

```env
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"
MYSQL_USER="social_user"
MYSQL_PASSWORD="social_pass_2026"
MYSQL_DATABASE="social_network"
JWT_SECRET="social_network_jwt_secret_key_2026"
```
