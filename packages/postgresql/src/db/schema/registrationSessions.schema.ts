import type { LTIDynamicRegistrationSession } from '@longsightgroup/lti-tool';
import { bigint, index, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';

import {
  LTI_COLUMNS,
  LTI_ID_LENGTH,
  LTI_INDEXES,
  LTI_TABLES,
} from '#storage/schema-definitions';

export const registrationSessionsTable = pgTable(
  LTI_TABLES.registrationSessions,
  {
    id: varchar(LTI_COLUMNS.id, { length: LTI_ID_LENGTH }).primaryKey(),
    data: jsonb(LTI_COLUMNS.payload).$type<LTIDynamicRegistrationSession>().notNull(),
    expiresAt: bigint(LTI_COLUMNS.expiresAt, { mode: 'number' }).notNull(),
  },
  (table) => [index(LTI_INDEXES.registrationSessionsExpiresAt).on(table.expiresAt)],
);
