import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { existsSync } from 'fs';
import { config } from '../config';
import { logger } from '../logger';
import * as schema from './schema';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function initDatabase(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (db) {
    return db;
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

  db = drizzle(pool, { schema });

  // Run migrations
  const migrationsFolder = './drizzle';
  
  if (existsSync(migrationsFolder)) {
    try {
      await migrate(db, { migrationsFolder });
      logger.info('Database migrations applied successfully');
    } catch (error: any) {
      // Check if error is about relation already exists (PostgreSQL code 42P07)
      // Drizzle wraps errors - need to check string representation
      const errorString = String(error) + JSON.stringify(error, Object.getOwnPropertyNames(error));
      const isTableExists = errorString.includes('42P07') || errorString.includes('already exists');
      
      if (isTableExists) {
        logger.info('Tables already exist, marking migrations as applied');
        // Create drizzle migrations table if not exists and mark migration as done
        try {
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
              id SERIAL PRIMARY KEY,
              hash text NOT NULL,
              created_at bigint
            )
          `);
          // Get list of migration files and mark them as applied
          const fs = await import('fs');
          const path = await import('path');
          const files = fs.readdirSync(migrationsFolder).filter(f => f.endsWith('.sql'));
          for (const file of files) {
            const hash = file.replace('.sql', '');
            await db.execute(sql`
              INSERT INTO "__drizzle_migrations" (hash, created_at)
              SELECT ${hash}, ${Date.now()}
              WHERE NOT EXISTS (SELECT 1 FROM "__drizzle_migrations" WHERE hash = ${hash})
            `);
          }
          logger.info('Migration journal updated for existing tables');
        } catch (journalError) {
          logger.error({ error: journalError }, 'Failed to update migration journal');
        }
      } else {
        logger.error({ error }, 'Database migration failed');
        throw error;
      }
    }
  } else {
    logger.warn({ migrationsFolder }, 'Migrations folder not found, skipping migrations');
  }

  logger.info('Database initialized with Drizzle ORM');
  return db;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
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
    db = null;
    logger.info('Database closed');
  }
}
