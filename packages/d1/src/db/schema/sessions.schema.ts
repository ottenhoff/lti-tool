import type { LTISession } from '@longsightgroup/lti-tool';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { LTI_COLUMNS, LTI_INDEXES, LTI_TABLES } from '#storage/schema-definitions';

export const sessionsTable = sqliteTable(
  LTI_TABLES.sessions,
  {
    id: text(LTI_COLUMNS.id).primaryKey(),
    data: text(LTI_COLUMNS.payload, { mode: 'json' })
      .$type<Omit<LTISession, 'id'>>()
      .notNull(),
    expiresAt: integer(LTI_COLUMNS.expiresAt).notNull(),
  },
  (table) => [index(LTI_INDEXES.sessionsExpiresAt).on(table.expiresAt)],
);
