import type { LTISession } from '@longsightgroup/lti-tool';
import { bigint, index, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

export const sessionsTable = mysqlTable(
  'sessions',
  {
    id: varchar({ length: 36 }).primaryKey(),
    data: json().$type<Omit<LTISession, 'id'>>().notNull(),
    expiresAt: bigint({ mode: 'number' }).notNull(),
  },
  (table) => [index('expires_at_idx').on(table.expiresAt)],
);
