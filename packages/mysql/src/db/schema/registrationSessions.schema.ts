import type { LTIDynamicRegistrationSession } from '@longsightgroup/lti-tool';
import { bigint, index, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

import {
  LTI_COLUMNS,
  LTI_ID_LENGTH,
  LTI_INDEXES,
  LTI_TABLES,
} from '#storage/schema-definitions';

export const registrationSessionsTable = mysqlTable(
  LTI_TABLES.registrationSessions,
  {
    id: varchar(LTI_COLUMNS.id, { length: LTI_ID_LENGTH }).primaryKey(),
    data: json(LTI_COLUMNS.payload).$type<LTIDynamicRegistrationSession>().notNull(),
    expiresAt: bigint(LTI_COLUMNS.expiresAt, { mode: 'number' }).notNull(),
  },
  (table) => [index(LTI_INDEXES.registrationSessionsExpiresAt).on(table.expiresAt)],
);
