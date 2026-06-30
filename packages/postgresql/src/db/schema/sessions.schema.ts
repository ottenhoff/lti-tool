import type { LTISession } from '@longsightgroup/lti-tool';
import { bigint, index, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';

export const sessionsTable = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    data: jsonb('data').$type<Omit<LTISession, 'id'>>().notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  },
  (table) => [index('sessions_expires_at_idx').on(table.expiresAt)],
);
