import { getPool } from './index';
import { Apartment, ScrapedApartment, ApartmentStatus, ApartmentChange } from '../types';
import { logger } from '../logger';

interface DbApartment {
  id: number;
  external_id: string;
  profile_id: string;
  status: string;
  price: number | null;
  price_per_meter: number | null;
  area: number | null;
  floor: number | null;
  rooms: number | null;
  address: string | null;
  building: string | null;
  link: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapDbToApartment(row: DbApartment): Apartment {
  return {
    id: String(row.id),
    externalId: row.external_id,
    profileId: row.profile_id,
    status: row.status as ApartmentStatus,
    price: row.price,
    pricePerMeter: row.price_per_meter,
    area: row.area,
    floor: row.floor,
    rooms: row.rooms,
    address: row.address,
    building: row.building,
    link: row.link,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getApartmentsByProfile(profileId: string): Promise<Apartment[]> {
  const pool = getPool();
  const result = await pool.query<DbApartment>(
    'SELECT * FROM apartments WHERE profile_id = $1',
    [profileId]
  );
  
  return result.rows.map(mapDbToApartment);
}

export async function getApartmentByExternalId(externalId: string, profileId: string): Promise<Apartment | null> {
  const pool = getPool();
  const result = await pool.query<DbApartment>(
    'SELECT * FROM apartments WHERE external_id = $1 AND profile_id = $2',
    [externalId, profileId]
  );
  
  return result.rows.length > 0 ? mapDbToApartment(result.rows[0]) : null;
}

export async function upsertApartment(profileId: string, apt: ScrapedApartment): Promise<void> {
  const pool = getPool();
  
  await pool.query(`
    INSERT INTO apartments (external_id, profile_id, status, price, price_per_meter, area, floor, rooms, address, building, link, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT(external_id, profile_id) DO UPDATE SET
      status = EXCLUDED.status,
      price = EXCLUDED.price,
      price_per_meter = EXCLUDED.price_per_meter,
      area = EXCLUDED.area,
      floor = EXCLUDED.floor,
      rooms = EXCLUDED.rooms,
      address = EXCLUDED.address,
      building = EXCLUDED.building,
      link = EXCLUDED.link,
      updated_at = NOW()
  `, [
    apt.externalId,
    profileId,
    apt.status,
    apt.price,
    apt.pricePerMeter,
    apt.area,
    apt.floor,
    apt.rooms,
    apt.address,
    apt.building,
    apt.link
  ]);
}

export async function processScrapedApartments(
  profileId: string, 
  scrapedApartments: ScrapedApartment[],
  notifyOnNew: boolean,
  notifyOnAvailable: boolean,
  notifyOnPriceChange: boolean
): Promise<ApartmentChange[]> {
  const changes: ApartmentChange[] = [];
  const existingApartments = await getApartmentsByProfile(profileId);
  const existingMap = new Map(existingApartments.map(a => [a.externalId, a]));

  for (const scraped of scrapedApartments) {
    const existing = existingMap.get(scraped.externalId);

    if (!existing) {
      if (notifyOnNew && scraped.status === 'available') {
        changes.push({
          type: 'new',
          apartment: scraped,
        });
        logger.info({ externalId: scraped.externalId }, 'New available apartment found');
      }
    } else {
      if (notifyOnAvailable && 
          existing.status !== 'available' && 
          scraped.status === 'available') {
        changes.push({
          type: 'available',
          apartment: scraped,
          previousStatus: existing.status,
        });
        logger.info({ externalId: scraped.externalId }, 'Apartment became available');
      }

      if (notifyOnPriceChange && 
          existing.price !== null && 
          scraped.price !== null && 
          existing.price !== scraped.price) {
        changes.push({
          type: 'price_change',
          apartment: scraped,
          previousPrice: existing.price,
        });
        logger.info({ 
          externalId: scraped.externalId, 
          oldPrice: existing.price, 
          newPrice: scraped.price 
        }, 'Apartment price changed');
      }

      if (existing.status !== scraped.status && 
          scraped.status !== 'available') {
        logger.debug({ 
          externalId: scraped.externalId, 
          oldStatus: existing.status, 
          newStatus: scraped.status 
        }, 'Apartment status changed');
      }
    }

    await upsertApartment(profileId, scraped);
  }

  return changes;
}

export async function getAvailableApartments(profileId?: string): Promise<Apartment[]> {
  const pool = getPool();
  
  if (profileId) {
    const result = await pool.query<DbApartment>(
      "SELECT * FROM apartments WHERE profile_id = $1 AND status = 'available'",
      [profileId]
    );
    return result.rows.map(mapDbToApartment);
  }
  
  const result = await pool.query<DbApartment>(
    "SELECT * FROM apartments WHERE status = 'available'"
  );
  return result.rows.map(mapDbToApartment);
}
