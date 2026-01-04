import { getDatabase } from './index';
import { logger } from '../logger';

export interface Subscriber {
  id: number;
  chat_id: string;
  username: string | null;
  first_name: string | null;
  subscribed_at: string;
  is_active: boolean;
}

export function initSubscribersTable(): void {
  const db = getDatabase();
  
  db.exec(`
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
  
  logger.info('Subscribers table initialized');
}

export function addSubscriber(chatId: string, username?: string, firstName?: string): boolean {
  const db = getDatabase();
  
  try {
    const existing = db.prepare('SELECT id, is_active FROM subscribers WHERE chat_id = ?').get(chatId) as { id: number; is_active: number } | undefined;
    
    if (existing) {
      if (existing.is_active === 0) {
        // Reactivate subscription
        db.prepare('UPDATE subscribers SET is_active = 1, username = ?, first_name = ? WHERE chat_id = ?')
          .run(username || null, firstName || null, chatId);
        logger.info({ chatId, username }, 'Subscriber reactivated');
        return true;
      }
      // Already subscribed
      return false;
    }
    
    db.prepare('INSERT INTO subscribers (chat_id, username, first_name) VALUES (?, ?, ?)')
      .run(chatId, username || null, firstName || null);
    
    logger.info({ chatId, username }, 'New subscriber added');
    return true;
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to add subscriber');
    return false;
  }
}

export function removeSubscriber(chatId: string): boolean {
  const db = getDatabase();
  
  try {
    const result = db.prepare('UPDATE subscribers SET is_active = 0 WHERE chat_id = ? AND is_active = 1').run(chatId);
    
    if (result.changes > 0) {
      logger.info({ chatId }, 'Subscriber removed');
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to remove subscriber');
    return false;
  }
}

export function isSubscriber(chatId: string): boolean {
  const db = getDatabase();
  const result = db.prepare('SELECT 1 FROM subscribers WHERE chat_id = ? AND is_active = 1').get(chatId);
  return !!result;
}

export function getAllSubscribers(): string[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT chat_id FROM subscribers WHERE is_active = 1').all() as { chat_id: string }[];
  return rows.map(row => row.chat_id);
}

export function getSubscriberCount(): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM subscribers WHERE is_active = 1').get() as { count: number };
  return result.count;
}
