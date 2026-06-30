import { bigint, pgTable, varchar } from 'drizzle-orm/pg-core';

export const noncesTable = pgTable('nonces', {
  nonce: varchar('nonce', { length: 255 }).primaryKey(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
});
