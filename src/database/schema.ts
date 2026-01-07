import { pgTable, serial, text, numeric, integer, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';

// Apartments table
export const apartments = pgTable('apartments', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull(),
  profileId: text('profile_id').notNull(),
  status: text('status').notNull().default('unknown'),
  price: numeric('price'),
  pricePerMeter: numeric('price_per_meter'),
  area: numeric('area'),
  floor: integer('floor'),
  rooms: integer('rooms'),
  address: text('address'),
  building: text('building'),
  link: text('link'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  profileIdx: index('idx_apartments_profile').on(table.profileId),
  statusIdx: index('idx_apartments_status').on(table.status),
  externalIdx: index('idx_apartments_external').on(table.externalId),
  uniqueExtProfile: unique('apartments_external_id_profile_id_key').on(table.externalId, table.profileId),
}));

// Subscribers table
export const subscribers = pgTable('subscribers', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull().unique(),
  username: text('username'),
  firstName: text('first_name'),
  subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
}, (table) => ({
  chatIdIdx: index('idx_subscribers_chat_id').on(table.chatId),
  activeIdx: index('idx_subscribers_active').on(table.isActive),
}));

// Parsing history table
export const parsingHistory = pgTable('parsing_history', {
  id: serial('id').primaryKey(),
  profileId: text('profile_id').notNull(),
  profileName: text('profile_name').notNull(),
  totalApartments: integer('total_apartments').notNull().default(0),
  bookedApartments: integer('booked_apartments').notNull().default(0),
  availableApartments: integer('available_apartments').notNull().default(0),
  error: text('error'),
  durationMs: integer('duration_ms'),
  parsedAt: timestamp('parsed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  profileIdx: index('idx_parsing_history_profile').on(table.profileId),
  parsedAtIdx: index('idx_parsing_history_parsed_at').on(table.parsedAt),
}));

// Parsed apartments table
export const parsedApartments = pgTable('parsed_apartments', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull(),
  profileId: text('profile_id').notNull(),
  status: text('status').notNull().default('unknown'),
  price: numeric('price'),
  pricePerMeter: numeric('price_per_meter'),
  area: numeric('area'),
  floor: integer('floor'),
  rooms: integer('rooms'),
  address: text('address'),
  building: text('building'),
  link: text('link'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
  previousStatus: text('previous_status'),
}, (table) => ({
  profileIdx: index('idx_parsed_apartments_profile').on(table.profileId),
  statusIdx: index('idx_parsed_apartments_status').on(table.status),
  externalIdx: index('idx_parsed_apartments_external').on(table.externalId),
  lastSeenIdx: index('idx_parsed_apartments_last_seen').on(table.lastSeenAt),
  uniqueExtProfile: unique('parsed_apartments_external_id_profile_id_key').on(table.externalId, table.profileId),
}));

// Bot usage analytics table
export const botUsage = pgTable('bot_usage', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  command: text('command').notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  chatIdIdx: index('idx_bot_usage_chat_id').on(table.chatId),
  commandIdx: index('idx_bot_usage_command').on(table.command),
  executedAtIdx: index('idx_bot_usage_executed_at').on(table.executedAt),
}));

// Type exports
export type Apartment = typeof apartments.$inferSelect;
export type NewApartment = typeof apartments.$inferInsert;

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;

export type ParsingHistoryEntry = typeof parsingHistory.$inferSelect;
export type NewParsingHistoryEntry = typeof parsingHistory.$inferInsert;

export type ParsedApartment = typeof parsedApartments.$inferSelect;
export type NewParsedApartment = typeof parsedApartments.$inferInsert;

export type BotUsageEntry = typeof botUsage.$inferSelect;
export type NewBotUsageEntry = typeof botUsage.$inferInsert;
