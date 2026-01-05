import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../logger';

let pool: Pool | null = null;

export async function initDatabase(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: config.database.url,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Проверяем подключение
  try {
    const client = await pool.connect();
    client.release();
    logger.info('PostgreSQL connected');
  } catch (error) {
    const safeUrl = config.database.url.replace(/:[^:@]+@/, ':***@');
    logger.error({ error, url: safeUrl }, 'Failed to connect to PostgreSQL');
    throw error;
  }

  // Создаём таблицы
  await pool.query(`
    CREATE TABLE IF NOT EXISTS apartments (
      id SERIAL PRIMARY KEY,
      external_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      price NUMERIC,
      price_per_meter NUMERIC,
      area NUMERIC,
      floor INTEGER,
      rooms INTEGER,
      address TEXT,
      building TEXT,
      link TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(external_id, profile_id)
    );

    CREATE INDEX IF NOT EXISTS idx_apartments_profile ON apartments(profile_id);
    CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status);
    CREATE INDEX IF NOT EXISTS idx_apartments_external ON apartments(external_id);
    
    CREATE TABLE IF NOT EXISTS subscribers (
      id SERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );
    
    CREATE INDEX IF NOT EXISTS idx_subscribers_chat_id ON subscribers(chat_id);
    CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active);
  `);

  logger.info('Database tables initialized');
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database closed');
  }
}
