import type { LTISession } from '@longsightgroup/lti-tool';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessionsTable = sqliteTable(
  'lti_tool_sessions',
  {
    id: text('id').primaryKey(),
    data: text('data', { mode: 'json' }).$type<Omit<LTISession, 'id'>>().notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [index('lti_tool_sessions_expires_at_idx').on(table.expiresAt)],
);
