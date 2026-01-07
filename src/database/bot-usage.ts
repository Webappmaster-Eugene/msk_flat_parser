import { eq, desc, count, countDistinct, sql } from 'drizzle-orm';
import { getDb } from './index';
import { botUsage, BotUsageEntry } from './schema';
import { logger } from '../logger';

export type { BotUsageEntry } from './schema';

export async function logBotUsage(chatId: string, command: string): Promise<void> {
  const db = getDb();
  
  try {
    await db.insert(botUsage).values({ chatId, command });
  } catch (err) {
    logger.error({ err, chatId, command }, 'Failed to log bot usage');
  }
}

export async function getBotUsageStats(): Promise<{
  totalCommands: number;
  uniqueUsers: number;
  commandsToday: number;
  commandsLast24h: number;
  commandsLast7d: number;
  topCommands: { command: string; count: number }[];
  topUsers: { chatId: string; count: number }[];
  dailyUsage: { date: string; count: number }[];
}> {
  const db = getDb();
  
  // Total stats
  const totalResult = await db.select({
    totalCommands: count(),
    uniqueUsers: countDistinct(botUsage.chatId),
    commandsToday: count(sql`CASE WHEN ${botUsage.executedAt} >= CURRENT_DATE THEN 1 END`),
    commandsLast24h: count(sql`CASE WHEN ${botUsage.executedAt} >= NOW() - INTERVAL '24 hours' THEN 1 END`),
    commandsLast7d: count(sql`CASE WHEN ${botUsage.executedAt} >= NOW() - INTERVAL '7 days' THEN 1 END`),
  }).from(botUsage);
  
  // Top commands
  const commandsResult = await db.select({
    command: botUsage.command,
    count: count(),
  })
    .from(botUsage)
    .groupBy(botUsage.command)
    .orderBy(sql`count DESC`)
    .limit(10);
  
  // Top users
  const usersResult = await db.select({
    chatId: botUsage.chatId,
    count: count(),
  })
    .from(botUsage)
    .groupBy(botUsage.chatId)
    .orderBy(sql`count DESC`)
    .limit(10);
  
  // Daily usage for last 14 days
  const dailyResult = await db.select({
    date: sql<string>`DATE(${botUsage.executedAt})`,
    count: count(),
  })
    .from(botUsage)
    .where(sql`${botUsage.executedAt} >= NOW() - INTERVAL '14 days'`)
    .groupBy(sql`DATE(${botUsage.executedAt})`)
    .orderBy(sql`DATE(${botUsage.executedAt}) DESC`);
  
  const row = totalResult[0];
  return {
    totalCommands: row?.totalCommands || 0,
    uniqueUsers: row?.uniqueUsers || 0,
    commandsToday: row?.commandsToday || 0,
    commandsLast24h: row?.commandsLast24h || 0,
    commandsLast7d: row?.commandsLast7d || 0,
    topCommands: commandsResult.map(r => ({ command: r.command, count: r.count })),
    topUsers: usersResult.map(r => ({ chatId: r.chatId, count: r.count })),
    dailyUsage: dailyResult.map(r => ({ date: r.date, count: r.count })),
  };
}

export async function getUserActivity(chatId: string): Promise<BotUsageEntry[]> {
  const db = getDb();
  
  const result = await db.select()
    .from(botUsage)
    .where(eq(botUsage.chatId, chatId))
    .orderBy(desc(botUsage.executedAt))
    .limit(50);
  
  return result;
}
