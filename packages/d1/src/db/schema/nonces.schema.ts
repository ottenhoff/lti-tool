import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const noncesTable = sqliteTable(
  'lti_tool_nonces',
  {
    nonce: text('nonce').primaryKey(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [index('lti_tool_nonces_expires_at_idx').on(table.expiresAt)],
);
