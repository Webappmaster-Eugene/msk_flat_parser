import { eq, and, desc, count, sql } from 'drizzle-orm';
import { getDb } from './index';
import { parsedApartments, ParsedApartment } from './schema';
import { logger } from '../logger';

export type { ParsedApartment } from './schema';

export async function upsertParsedApartment(
  externalId: string,
  profileId: string,
  status: string,
  price: number | null = null,
  pricePerMeter: number | null = null,
  area: number | null = null,
  floor: number | null = null,
  rooms: number | null = null,
  address: string | null = null,
  building: string | null = null,
  link: string | null = null
): Promise<void> {
  const db = getDb();
  
  try {
    const existing = await db.select({ status: parsedApartments.status })
      .from(parsedApartments)
      .where(and(
        eq(parsedApartments.externalId, externalId),
        eq(parsedApartments.profileId, profileId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      const currentStatus = existing[0].status;
      const statusChanged = currentStatus !== status;
      
      await db.update(parsedApartments)
        .set({
          status,
          price: price?.toString() || null,
          pricePerMeter: pricePerMeter?.toString() || null,
          area: area?.toString() || null,
          floor,
          rooms,
          address,
          building,
          link,
          lastSeenAt: new Date(),
          ...(statusChanged ? { statusChangedAt: new Date(), previousStatus: currentStatus } : {}),
        })
        .where(and(
          eq(parsedApartments.externalId, externalId),
          eq(parsedApartments.profileId, profileId)
        ));
    } else {
      await db.insert(parsedApartments).values({
        externalId,
        profileId,
        status,
        price: price?.toString() || null,
        pricePerMeter: pricePerMeter?.toString() || null,
        area: area?.toString() || null,
        floor,
        rooms,
        address,
        building,
        link,
      });
    }
  } catch (err) {
    logger.error({ err, externalId, profileId }, 'Failed to upsert parsed apartment');
  }
}

export async function getParsedApartments(profileId?: string, limit: number = 100): Promise<ParsedApartment[]> {
  const db = getDb();
  
  let query = db.select().from(parsedApartments);
  
  if (profileId) {
    query = query.where(eq(parsedApartments.profileId, profileId)) as typeof query;
  }
  
  const result = await query
    .orderBy(desc(parsedApartments.lastSeenAt))
    .limit(limit);
  
  return result;
}

export async function getParsedApartmentsStats(): Promise<{
  totalApartments: number;
  availableCount: number;
  bookedCount: number;
  soldCount: number;
  unknownCount: number;
  apartmentsWithStatusChange: number;
}> {
  const db = getDb();
  
  const result = await db.select({
    total: count(),
    availableCount: count(sql`CASE WHEN ${parsedApartments.status} = 'available' THEN 1 END`),
    bookedCount: count(sql`CASE WHEN ${parsedApartments.status} = 'booked' THEN 1 END`),
    soldCount: count(sql`CASE WHEN ${parsedApartments.status} = 'sold' THEN 1 END`),
    unknownCount: count(sql`CASE WHEN ${parsedApartments.status} = 'unknown' THEN 1 END`),
    statusChanged: count(sql`CASE WHEN ${parsedApartments.statusChangedAt} IS NOT NULL THEN 1 END`),
  }).from(parsedApartments);
  
  const row = result[0];
  return {
    totalApartments: row?.total || 0,
    availableCount: row?.availableCount || 0,
    bookedCount: row?.bookedCount || 0,
    soldCount: row?.soldCount || 0,
    unknownCount: row?.unknownCount || 0,
    apartmentsWithStatusChange: row?.statusChanged || 0,
  };
}
