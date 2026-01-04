import Database from 'better-sqlite3';
import { config } from '../config';
import { logger } from '../logger';
import fs from 'fs';
import path from 'path';

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dir = path.dirname(config.paths.database);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(config.paths.database);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS apartments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      price REAL,
      price_per_meter REAL,
      area REAL,
      floor INTEGER,
      rooms INTEGER,
      address TEXT,
      building TEXT,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(external_id, profile_id)
    );

    CREATE INDEX IF NOT EXISTS idx_apartments_profile ON apartments(profile_id);
    CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status);
    CREATE INDEX IF NOT EXISTS idx_apartments_external ON apartments(external_id);
    
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1
    );
    
    CREATE INDEX IF NOT EXISTS idx_subscribers_chat_id ON subscribers(chat_id);
    CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active);
  `);

  logger.info('Database initialized');
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database closed');
  }
}
