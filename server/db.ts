import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

export interface SqlLogEntry {
  id: string;
  sql: string;
  params: (string | number | boolean | null)[];
  durationMs: number;
  rowCount: number;
  timestamp: string;
  error?: string;
}

const queryLogs: SqlLogEntry[] = [];
const MAX_LOGS = 50;

function logQuery(sql: string, params: any[], durationMs: number, rowCount: number, error?: string) {
  // Sanitize passwords from logs so they are never leaked
  const sanitizedParams = (params || []).map((p, idx) => {
    if (typeof p === 'string' && (p.startsWith('$2a$') || p.startsWith('$2b$') || p.length > 50)) {
      return '[PROTECTED_BCRYPT_HASH]';
    }
    return p;
  });

  queryLogs.unshift({
    id: Math.random().toString(36).substring(2, 9),
    sql: sql.trim().replace(/\s+/g, ' '),
    params: sanitizedParams,
    durationMs,
    rowCount,
    timestamp: new Date().toLocaleTimeString('ru-RU', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0'),
    error
  });

  if (queryLogs.length > MAX_LOGS) {
    queryLogs.pop();
  }
}

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
let lastError: string | null = null;

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Wrapper for parameterized queries with logging
export async function query<T = any>(sql: string, params: any[] = []): Promise<[T, mysql.FieldPacket[]]> {
  const p = await getPool();
  const startTime = Date.now();
  try {
    const result = await p.execute(sql, params);
    const duration = Date.now() - startTime;
    const rows = result[0];
    const rowCount = Array.isArray(rows) ? rows.length : (rows as any)?.affectedRows || 0;
    logQuery(sql, params, duration, rowCount);
    return result as [T, mysql.FieldPacket[]];
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logQuery(sql, params, duration, 0, err.message);
    throw err;
  }
}

// Startup check: verifies connection and creates table if not existing
export async function initializeDatabase(): Promise<boolean> {
  console.log(`[MySQL] Connecting to ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`);

  // Attempt initial ping
  try {
    const p = await getPool();
    const [verResult] = await p.query('SELECT VERSION() as version');
    const version = (verResult as any)[0]?.version;
    console.log(`[MySQL] Connection established! Server version: ${version}`);
    isConnected = true;
    lastError = null;
  } catch (err: any) {
    console.warn(`[MySQL] Initial connection failed (${err.message}). Checking local daemon...`);
    // If local daemon is not running, try starting it
    try {
      await execAsync('mkdir -p /var/run/mysqld && chown -R mysql:mysql /var/run/mysqld /var/lib/mysql && mariadbd-safe --user=mysql &');
      // Wait 2.5s for socket
      await new Promise((r) => setTimeout(r, 2500));
      pool = mysql.createPool(dbConfig);
      const [verResult] = await pool.query('SELECT VERSION() as version');
      console.log(`[MySQL] Daemon started! Server version: ${(verResult as any)[0]?.version}`);
      isConnected = true;
      lastError = null;
    } catch (startupErr: any) {
      console.error('[MySQL] Failed to start local database daemon:', startupErr.message);
      lastError = startupErr.message;
      isConnected = false;
      return false;
    }
  }

  // Ensure table exists according to assignment requirements
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
    console.log('[MySQL] Table `users` verified successfully.');
    return true;
  } catch (tableErr: any) {
    console.error('[MySQL] Error verifying `users` table:', tableErr.message);
    lastError = tableErr.message;
    return false;
  }
}

export function getDatabaseStatus() {
  return {
    isConnected,
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    lastError,
    queryLogs,
  };
}
