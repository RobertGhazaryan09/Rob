import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { query, initializeDatabase, getDatabaseStatus, getPool, dbConfig } from './server/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'social_network_jwt_secret_school_project_2026';

app.use(express.json());

// Interface for JWT payload
interface UserTokenPayload {
  id: number;
  username: string;
  email: string;
}

// Authentication middleware
function authenticateToken(req: Request & { user?: UserTokenPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, error: 'Требуется авторизация (токен отсутствует)' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      res.status(403).json({ success: false, error: 'Сессия истекла или недействительна' });
      return;
    }
    req.user = decoded as UserTokenPayload;
    next();
  });
}

// -------------------------------------------------------------
// 1. REGISTRATION ENDPOINT (INSERT into MySQL)
// -------------------------------------------------------------
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Server-side validation
    if (!username || !email || !password || !confirmPassword) {
      res.status(400).json({
        success: false,
        error: 'Пожалуйста, заполните все обязательные поля.'
      });
      return;
    }

    const trimmedUsername = String(username).trim();
    const trimmedEmail = String(email).trim().toLowerCase();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      res.status(400).json({
        success: false,
        error: 'Имя пользователя должно содержать от 3 до 50 символов.'
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 100) {
      res.status(400).json({
        success: false,
        error: 'Введите корректный адрес электронной почты (до 100 символов).'
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Пароль должен содержать минимум 6 символов.'
      });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        error: 'Пароли не совпадают. Пожалуйста, проверьте ввод.'
      });
      return;
    }

    // Step 1: Check in MySQL if username or email is already taken
    // Using parameterized prepared statement:
    const checkSql = 'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1';
    const [existingRows] = await query<any[]>(checkSql, [trimmedUsername, trimmedEmail]);

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
      if (existing.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        res.status(400).json({
          success: false,
          error: `Пользователь с именем "${trimmedUsername}" уже зарегистрирован. Выберите другое имя.`
        });
        return;
      }
      if (existing.email.toLowerCase() === trimmedEmail) {
        res.status(400).json({
          success: false,
          error: `Пользователь с адресом "${trimmedEmail}" уже зарегистрирован в системе.`
        });
        return;
      }
    }

    // Step 2: Securely hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Step 3: Insert new user into MySQL with prepared statement
    const insertSql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
    const [insertResult] = await query<any>(insertSql, [trimmedUsername, trimmedEmail, passwordHash]);
    const newUserId = insertResult.insertId;

    // Step 4: Fetch freshly created user record (excluding password_hash)
    const selectSql = 'SELECT id, username, email, created_at FROM users WHERE id = ?';
    const [userRows] = await query<any[]>(selectSql, [newUserId]);
    const newUser = userRows[0];

    // Generate JWT token
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
    console.error('[Register Error]', err);
    // Handle MySQL unique constraint violation error code (ER_DUP_ENTRY)
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({
        success: false,
        error: 'Ошибка ограничения уникальности MySQL: такое имя или email уже существуют.'
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: `Ошибка базы данных MySQL: ${err.message || 'Не удалось завершить регистрацию'}`
    });
  }
});

// -------------------------------------------------------------
// 2. LOGIN ENDPOINT (SELECT from MySQL by email & verify bcrypt)
// -------------------------------------------------------------
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Пожалуйста, введите электронную почту и пароль.'
      });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // Query user by email from MySQL using parameterized statement
    const selectSql = 'SELECT id, username, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1';
    const [rows] = await query<any[]>(selectSql, [trimmedEmail]);

    if (!rows || rows.length === 0) {
      res.status(401).json({
        success: false,
        error: 'Пользователь с такой электронной почтой не найден.'
      });
      return;
    }

    const user = rows[0];

    // Compare entered password with stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Неверный пароль. Пожалуйста, попробуйте снова.'
      });
      return;
    }

    // Do NOT send password_hash in response
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
    console.error('[Login Error]', err);
    res.status(500).json({
      success: false,
      error: `Ошибка базы данных MySQL при авторизации: ${err.message}`
    });
  }
});

// -------------------------------------------------------------
// 3. CURRENT USER SESSION ENDPOINT
// -------------------------------------------------------------
app.get('/api/auth/me', authenticateToken, async (req: Request & { user?: UserTokenPayload }, res: Response) => {
  try {
    const userId = req.user!.id;
    const selectSql = 'SELECT id, username, email, created_at FROM users WHERE id = ? LIMIT 1';
    const [rows] = await query<any[]>(selectSql, [userId]);

    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, error: 'Пользователь не найден в базе данных' });
      return;
    }

    res.json({
      success: true,
      user: rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. USERS LIST & SEARCH ENDPOINT (SELECT ... WHERE ... LIKE)
// -------------------------------------------------------------
app.get('/api/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    let sql: string;
    let params: any[] = [];

    if (searchQuery) {
      // Parameterized LIKE search to protect from SQL injection:
      // SELECT id, username, email, created_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY created_at DESC
      sql = `
        SELECT id, username, email, created_at 
        FROM users 
        WHERE username LIKE ? OR email LIKE ? 
        ORDER BY created_at DESC
      `;
      const searchPattern = `%${searchQuery}%`;
      params = [searchPattern, searchPattern];
    } else {
      // Standard full list
      sql = `
        SELECT id, username, email, created_at 
        FROM users 
        ORDER BY created_at DESC
      `;
    }

    const [rows] = await query<any[]>(sql, params);

    res.json({
      success: true,
      users: rows || [],
      count: rows?.length || 0,
      search: searchQuery || null,
    });
  } catch (err: any) {
    console.error('[Fetch Users Error]', err);
    res.status(500).json({
      success: false,
      error: `Ошибка запроса к MySQL: ${err.message}`
    });
  }
});

// -------------------------------------------------------------
// 5. DELETE OWN ACCOUNT (DELETE FROM users WHERE id = ?)
// -------------------------------------------------------------
app.delete('/api/users/me', authenticateToken, async (req: Request & { user?: UserTokenPayload }, res: Response) => {
  try {
    const currentUserId = req.user!.id;

    // Parameterized DELETE query targeting strictly the authenticated user
    const deleteSql = 'DELETE FROM users WHERE id = ?';
    const [result] = await query<any>(deleteSql, [currentUserId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'Пользователь не найден или уже удален.' });
      return;
    }

    res.json({
      success: true,
      message: 'Ваш профиль был успешно удален из базы данных.'
    });
  } catch (err: any) {
    console.error('[Delete Profile Error]', err);
    res.status(500).json({
      success: false,
      error: `Ошибка при удалении профиля: ${err.message}`
    });
  }
});

// Also support DELETE /api/users/:id with strict permission check
app.delete('/api/users/:id', authenticateToken, async (req: Request & { user?: UserTokenPayload }, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const targetUserId = parseInt(req.params.id, 10);

    if (currentUserId !== targetUserId) {
      res.status(403).json({
        success: false,
        error: 'Доступ запрещен. Вы можете удалить только свой собственный профиль.'
      });
      return;
    }

    const deleteSql = 'DELETE FROM users WHERE id = ?';
    const [result] = await query<any>(deleteSql, [currentUserId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'Пользователь не найден или уже удален.' });
      return;
    }

    res.json({
      success: true,
      message: 'Ваш профиль был успешно удален из базы данных.'
    });
  } catch (err: any) {
    console.error('[Delete Profile Error]', err);
    res.status(500).json({
      success: false,
      error: `Ошибка при удалении профиля: ${err.message}`
    });
  }
});

// -------------------------------------------------------------
// 6. DATABASE STATUS
// -------------------------------------------------------------
app.get('/api/database/status', async (req: Request, res: Response) => {
  try {
    const status = getDatabaseStatus();

    let tableSchema: any[] = [];
    let rowCount = 0;
    let version = 'unknown';

    if (status.isConnected) {
      const p = await getPool();
      const [verRows] = await p.query('SELECT VERSION() as version');
      version = (verRows as any)[0]?.version || 'MySQL 10.11';

      const [descRows] = await p.query('DESCRIBE users');
      tableSchema = descRows as any[];

      const [countRows] = await p.query('SELECT COUNT(*) as total FROM users');
      rowCount = (countRows as any)[0]?.total || 0;
    }

    res.json({
      success: true,
      ...status,
      version,
      tableSchema,
      rowCount,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      isConnected: false
    });
  }
});

// Start Express and mount Vite
async function startServer() {
  // Initialize MySQL database and ensure tables
  await initializeDatabase();

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite middleware in development
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SocialSQL Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[SocialSQL Server] Database connected: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Start Failure]', err);
});
