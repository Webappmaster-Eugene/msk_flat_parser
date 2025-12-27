import { getDatabase } from './index';
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
  created_at: string;
  updated_at: string;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getApartmentsByProfile(profileId: string): Apartment[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM apartments WHERE profile_id = ?
  `).all(profileId) as DbApartment[];
  
  return rows.map(mapDbToApartment);
}

export function getApartmentByExternalId(externalId: string, profileId: string): Apartment | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM apartments WHERE external_id = ? AND profile_id = ?
  `).get(externalId, profileId) as DbApartment | undefined;
  
  return row ? mapDbToApartment(row) : null;
}

export function upsertApartment(profileId: string, apt: ScrapedApartment): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO apartments (external_id, profile_id, status, price, price_per_meter, area, floor, rooms, address, building, link, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(external_id, profile_id) DO UPDATE SET
      status = excluded.status,
      price = excluded.price,
      price_per_meter = excluded.price_per_meter,
      area = excluded.area,
      floor = excluded.floor,
      rooms = excluded.rooms,
      address = excluded.address,
      building = excluded.building,
      link = excluded.link,
      updated_at = datetime('now')
  `).run(
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
  );
}

export function processScrapedApartments(
  profileId: string, 
  scrapedApartments: ScrapedApartment[],
  notifyOnNew: boolean,
  notifyOnAvailable: boolean,
  notifyOnPriceChange: boolean
): ApartmentChange[] {
  const changes: ApartmentChange[] = [];
  const existingApartments = getApartmentsByProfile(profileId);
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

    upsertApartment(profileId, scraped);
  }

  return changes;
}

export function getAvailableApartments(profileId?: string): Apartment[] {
  const db = getDatabase();
  
  if (profileId) {
    const rows = db.prepare(`
      SELECT * FROM apartments WHERE profile_id = ? AND status = 'available'
    `).all(profileId) as DbApartment[];
    return rows.map(mapDbToApartment);
  }
  
  const rows = db.prepare(`
    SELECT * FROM apartments WHERE status = 'available'
  `).all() as DbApartment[];
  return rows.map(mapDbToApartment);
}
