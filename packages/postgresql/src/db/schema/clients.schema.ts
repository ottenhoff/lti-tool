import { index, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const clientsTable = pgTable(
  'clients',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    iss: varchar('iss', { length: 255 }).notNull(),
    clientId: varchar('client_id', { length: 255 }).notNull(),
    authUrl: text('auth_url').notNull(),
    tokenUrl: text('token_url').notNull(),
    jwksUrl: text('jwks_url').notNull(),
  },
  (table) => [
    index('issuer_client_idx').on(table.clientId, table.iss),
    uniqueIndex('iss_client_id_unique').on(table.iss, table.clientId),
  ],
);
