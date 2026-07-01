import { bigint, pgTable, varchar } from 'drizzle-orm/pg-core';

import { LTI_COLUMNS, LTI_NONCE_LENGTH, LTI_TABLES } from '#storage/schema-definitions';

export const noncesTable = pgTable(LTI_TABLES.nonces, {
  nonce: varchar(LTI_COLUMNS.nonce, { length: LTI_NONCE_LENGTH }).primaryKey(),
  expiresAt: bigint(LTI_COLUMNS.expiresAt, { mode: 'number' }).notNull(),
});
