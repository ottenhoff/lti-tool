import { index, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { clientsTable } from './clients.schema.js';

export const deploymentsTable = pgTable(
  'deployments',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    deploymentId: varchar('deployment_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    clientId: varchar('client_id', { length: 36 })
      .notNull()
      .references(() => clientsTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('deployment_id_idx').on(table.deploymentId),
    uniqueIndex('client_deployment_unique').on(table.clientId, table.deploymentId),
  ],
);
