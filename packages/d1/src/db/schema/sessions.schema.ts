import type { LTISession } from '@longsightgroup/lti-tool';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessionsTable = sqliteTable(
  'lti_tool_sessions',
  {
    id: text('id').primaryKey(),
    data: text('data', { mode: 'json' }).$type<Omit<LTISession, 'id'>>().notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [index('lti_tool_sessions_expires_at_idx').on(table.expiresAt)],
);
