import { bigint, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

export const noncesTable = mysqlTable('nonces', {
  nonce: varchar({ length: 255 }).primaryKey(),
  expiresAt: bigint({ mode: 'number' }).notNull(),
});
