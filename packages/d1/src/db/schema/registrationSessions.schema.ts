import type { LTIDynamicRegistrationSession } from '@longsightgroup/lti-tool';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const registrationSessionsTable = sqliteTable(
  'lti_tool_registration_sessions',
  {
    id: text('id').primaryKey(),
    data: text('data', { mode: 'json' }).$type<LTIDynamicRegistrationSession>().notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [index('lti_tool_registration_sessions_expires_at_idx').on(table.expiresAt)],
);
