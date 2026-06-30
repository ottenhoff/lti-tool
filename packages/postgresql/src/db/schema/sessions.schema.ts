import type { LTISession } from '@longsightgroup/lti-tool';
import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessionsTable = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    data: jsonb('data').$type<Omit<LTISession, 'id'>>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_expires_at_idx').on(table.expiresAt)],
);
