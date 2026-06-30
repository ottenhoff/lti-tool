import { index, mysqlTable, text, unique, varchar } from 'drizzle-orm/mysql-core';

import { clientsTable } from './clients.schema.js';

export const deploymentsTable = mysqlTable(
  'deployments',
  {
    id: varchar({ length: 36 }).primaryKey(),
    deploymentId: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }),
    description: text(),
    clientId: varchar({ length: 36 })
      .notNull()
      .references(() => clientsTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('deployment_id_idx').on(table.deploymentId),
    unique('client_deployment_unique').on(table.clientId, table.deploymentId),
  ],
);
