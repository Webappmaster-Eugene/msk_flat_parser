export interface Apartment {
  id: string;
  externalId: string;
  profileId: string;
  status: ApartmentStatus;
  price: number | null;
  pricePerMeter: number | null;
  area: number | null;
  floor: number | null;
  rooms: number | null;
  address: string | null;
  building: string | null;
  link: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApartmentStatus = 'available' | 'booked' | 'sold' | 'unknown';

export interface SearchProfile {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  notifyOnNew: boolean;
  notifyOnAvailable: boolean;
  notifyOnPriceChange: boolean;
}

export interface ScrapedApartment {
  externalId: string;
  status: ApartmentStatus;
  price: number | null;
  pricePerMeter: number | null;
  area: number | null;
  floor: number | null;
  rooms: number | null;
  address: string | null;
  building: string | null;
  link: string | null;
}

export interface ScrapeResult {
  profileId: string;
  profileName: string;
  apartments: ScrapedApartment[];
  scrapedAt: Date;
  error?: string;
}

export interface ApartmentChange {
  type: 'new' | 'available' | 'price_change' | 'status_change';
  apartment: ScrapedApartment;
  previousPrice?: number | null;
  previousStatus?: ApartmentStatus;
}

export interface NotificationPayload {
  profileName: string;
  changes: ApartmentChange[];
}
