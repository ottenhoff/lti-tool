import type { LTISession } from '@longsightgroup/lti-tool';
import { bigint, index, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

import {
  LTI_COLUMNS,
  LTI_ID_LENGTH,
  LTI_INDEXES,
  LTI_TABLES,
} from '#storage/schema-definitions';

export const sessionsTable = mysqlTable(
  LTI_TABLES.sessions,
  {
    id: varchar(LTI_COLUMNS.id, { length: LTI_ID_LENGTH }).primaryKey(),
    data: json(LTI_COLUMNS.payload).$type<Omit<LTISession, 'id'>>().notNull(),
    expiresAt: bigint(LTI_COLUMNS.expiresAt, { mode: 'number' }).notNull(),
  },
  (table) => [index(LTI_INDEXES.sessionsExpiresAt).on(table.expiresAt)],
);
