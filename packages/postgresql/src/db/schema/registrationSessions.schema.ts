import type { LTIDynamicRegistrationSession } from '@longsightgroup/lti-tool';
import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const registrationSessionsTable = pgTable(
  'registration_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    data: jsonb('data')
      .$type<Omit<LTIDynamicRegistrationSession, 'sessionId'>>()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('reg_sessions_expires_at_idx').on(table.expiresAt)],
);
