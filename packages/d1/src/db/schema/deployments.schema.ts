import {
  foreignKey,
  index,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import {
  LTI_COLUMNS,
  LTI_INDEXES,
  LTI_TABLES,
  LTI_UNIQUES,
} from '#storage/schema-definitions';

import { clientsTable } from './clients.schema.js';

export const deploymentsTable = sqliteTable(
  LTI_TABLES.deployments,
  {
    id: text(LTI_COLUMNS.id).notNull(),
    tenantId: text(LTI_COLUMNS.tenantId).notNull(),
    clientId: text(LTI_COLUMNS.clientId).notNull(),
    deploymentId: text(LTI_COLUMNS.deploymentId).notNull(),
    name: text(LTI_COLUMNS.deploymentName),
    description: text(LTI_COLUMNS.deploymentDescription),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.clientId],
      foreignColumns: [clientsTable.tenantId, clientsTable.id],
    }).onDelete('cascade'),
    index(LTI_INDEXES.deploymentsDeploymentId).on(table.tenantId, table.deploymentId),
    uniqueIndex(LTI_UNIQUES.deploymentsClientDeployment).on(
      table.tenantId,
      table.clientId,
      table.deploymentId,
    ),
  ],
);
