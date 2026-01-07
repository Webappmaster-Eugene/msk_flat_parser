import { desc, count, avg, max, sql, isNull, isNotNull, gte } from 'drizzle-orm';
import { getDb } from './index';
import { parsingHistory, ParsingHistoryEntry } from './schema';
import { logger } from '../logger';

export type { ParsingHistoryEntry } from './schema';

export async function addParsingHistory(
  profileId: string,
  profileName: string,
  totalApartments: number,
  bookedApartments: number,
  availableApartments: number,
  durationMs: number | null,
  error: string | null = null
): Promise<void> {
  const db = getDb();
  
  try {
    await db.insert(parsingHistory).values({
      profileId,
      profileName,
      totalApartments,
      bookedApartments,
      availableApartments,
      durationMs,
      error,
    });
    logger.debug({ profileId }, 'Parsing history entry added');
  } catch (err) {
    logger.error({ err, profileId }, 'Failed to add parsing history');
  }
}

export async function getParsingHistory(limit: number = 50): Promise<ParsingHistoryEntry[]> {
  const db = getDb();
  
  const result = await db.select()
    .from(parsingHistory)
    .orderBy(desc(parsingHistory.parsedAt))
    .limit(limit);
  
  return result;
}

export async function getParsingStats(): Promise<{
  totalParses: number;
  successfulParses: number;
  failedParses: number;
  avgDurationMs: number;
  lastParseAt: Date | null;
  parsesToday: number;
  parsesLast24h: number;
}> {
  const db = getDb();
  
  const result = await db.select({
    totalParses: count(),
    successfulParses: count(sql`CASE WHEN ${parsingHistory.error} IS NULL THEN 1 END`),
    failedParses: count(sql`CASE WHEN ${parsingHistory.error} IS NOT NULL THEN 1 END`),
    avgDurationMs: sql<number>`COALESCE(AVG(${parsingHistory.durationMs}) FILTER (WHERE ${parsingHistory.error} IS NULL), 0)`,
    lastParseAt: max(parsingHistory.parsedAt),
    parsesToday: count(sql`CASE WHEN ${parsingHistory.parsedAt} >= CURRENT_DATE THEN 1 END`),
    parsesLast24h: count(sql`CASE WHEN ${parsingHistory.parsedAt} >= NOW() - INTERVAL '24 hours' THEN 1 END`),
  }).from(parsingHistory);
  
  const row = result[0];
  return {
    totalParses: row?.totalParses || 0,
    successfulParses: row?.successfulParses || 0,
    failedParses: row?.failedParses || 0,
    avgDurationMs: Math.round(Number(row?.avgDurationMs) || 0),
    lastParseAt: row?.lastParseAt || null,
    parsesToday: row?.parsesToday || 0,
    parsesLast24h: row?.parsesLast24h || 0,
  };
}
