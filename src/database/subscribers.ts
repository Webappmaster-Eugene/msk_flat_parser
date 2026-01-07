import { eq, and, count, sql } from 'drizzle-orm';
import { getDb } from './index';
import { subscribers, Subscriber } from './schema';
import { logger } from '../logger';

export type { Subscriber } from './schema';

export async function addSubscriber(chatId: string, username?: string, firstName?: string): Promise<boolean> {
  const db = getDb();
  
  try {
    const existing = await db.select({ id: subscribers.id, isActive: subscribers.isActive })
      .from(subscribers)
      .where(eq(subscribers.chatId, chatId))
      .limit(1);
    
    if (existing.length > 0) {
      if (!existing[0].isActive) {
        await db.update(subscribers)
          .set({ isActive: true, username: username || null, firstName: firstName || null })
          .where(eq(subscribers.chatId, chatId));
        logger.info({ chatId, username }, 'Subscriber reactivated');
        return true;
      }
      return false;
    }
    
    await db.insert(subscribers).values({
      chatId,
      username: username || null,
      firstName: firstName || null,
    });
    
    logger.info({ chatId, username }, 'New subscriber added');
    return true;
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to add subscriber');
    return false;
  }
}

export async function removeSubscriber(chatId: string): Promise<boolean> {
  const db = getDb();
  
  try {
    const result = await db.update(subscribers)
      .set({ isActive: false })
      .where(and(eq(subscribers.chatId, chatId), eq(subscribers.isActive, true)))
      .returning({ id: subscribers.id });
    
    if (result.length > 0) {
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
  const db = getDb();
  const result = await db.select({ id: subscribers.id })
    .from(subscribers)
    .where(and(eq(subscribers.chatId, chatId), eq(subscribers.isActive, true)))
    .limit(1);
  return result.length > 0;
}

export async function getAllSubscribers(): Promise<string[]> {
  const db = getDb();
  const result = await db.select({ chatId: subscribers.chatId })
    .from(subscribers)
    .where(eq(subscribers.isActive, true));
  return result.map(row => row.chatId);
}

export async function getSubscriberCount(): Promise<number> {
  const db = getDb();
  const result = await db.select({ count: count() })
    .from(subscribers)
    .where(eq(subscribers.isActive, true));
  return result[0]?.count || 0;
}

export async function getAllSubscribersDetails(): Promise<Subscriber[]> {
  const db = getDb();
  const result = await db.select()
    .from(subscribers)
    .orderBy(sql`${subscribers.subscribedAt} DESC`);
  return result;
}

export async function getSubscriberStats(): Promise<{
  totalSubscribers: number;
  activeSubscribers: number;
  inactiveSubscribers: number;
}> {
  const db = getDb();
  const result = await db.select({
    total: count(),
    active: count(sql`CASE WHEN ${subscribers.isActive} = true THEN 1 END`),
    inactive: count(sql`CASE WHEN ${subscribers.isActive} = false THEN 1 END`),
  }).from(subscribers);
  
  const row = result[0];
  return {
    totalSubscribers: row?.total || 0,
    activeSubscribers: row?.active || 0,
    inactiveSubscribers: row?.inactive || 0,
  };
}
