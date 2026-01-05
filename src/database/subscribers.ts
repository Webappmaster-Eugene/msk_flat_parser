import { getPool } from './index';
import { logger } from '../logger';

export interface Subscriber {
  id: number;
  chatId: string;
  username: string | null;
  firstName: string | null;
  subscribedAt: Date;
  isActive: boolean;
}

export async function addSubscriber(chatId: string, username?: string, firstName?: string): Promise<boolean> {
  const pool = getPool();
  
  try {
    const existing = await pool.query(
      'SELECT id, is_active FROM subscribers WHERE chat_id = $1',
      [chatId]
    );
    
    if (existing.rows.length > 0) {
      if (!existing.rows[0].is_active) {
        await pool.query(
          'UPDATE subscribers SET is_active = TRUE, username = $1, first_name = $2 WHERE chat_id = $3',
          [username || null, firstName || null, chatId]
        );
        logger.info({ chatId, username }, 'Subscriber reactivated');
        return true;
      }
      return false;
    }
    
    await pool.query(
      'INSERT INTO subscribers (chat_id, username, first_name) VALUES ($1, $2, $3)',
      [chatId, username || null, firstName || null]
    );
    
    logger.info({ chatId, username }, 'New subscriber added');
    return true;
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to add subscriber');
    return false;
  }
}

export async function removeSubscriber(chatId: string): Promise<boolean> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'UPDATE subscribers SET is_active = FALSE WHERE chat_id = $1 AND is_active = TRUE',
      [chatId]
    );
    
    if (result.rowCount && result.rowCount > 0) {
      logger.info({ chatId }, 'Subscriber removed');
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to remove subscriber');
    return false;
  }
}

export async function isSubscriber(chatId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT 1 FROM subscribers WHERE chat_id = $1 AND is_active = TRUE',
    [chatId]
  );
  return result.rows.length > 0;
}

export async function getAllSubscribers(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ chat_id: string }>(
    'SELECT chat_id FROM subscribers WHERE is_active = TRUE'
  );
  return result.rows.map(row => row.chat_id);
}

export async function getSubscriberCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM subscribers WHERE is_active = TRUE'
  );
  return parseInt(result.rows[0].count);
}
