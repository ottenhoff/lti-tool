import type { LTIDynamicRegistrationSession } from '@longsightgroup/lti-tool';
import { datetime, index, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

export const registrationSessionsTable = mysqlTable(
  'registrationSessions',
  {
    id: varchar({ length: 36 }).primaryKey(),
    data: json().$type<Omit<LTIDynamicRegistrationSession, 'sessionId'>>().notNull(),
    expiresAt: datetime().notNull(),
  },
  (table) => [index('expires_at_idx').on(table.expiresAt)],
);
