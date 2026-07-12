import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  LTI_COLUMNS,
  LTI_DEPLOYMENT_ID_LENGTH,
  LTI_ID_LENGTH,
  LTI_INDEXES,
  LTI_NAME_LENGTH,
  LTI_TABLES,
  LTI_UNIQUES,
} from '#storage/schema-definitions';

import { clientsTable } from './clients.schema.js';

export const deploymentsTable = pgTable(
  LTI_TABLES.deployments,
  {
    id: varchar(LTI_COLUMNS.id, { length: LTI_ID_LENGTH }).notNull(),
    tenantId: varchar(LTI_COLUMNS.tenantId, { length: LTI_ID_LENGTH }).notNull(),
    deploymentId: varchar(LTI_COLUMNS.deploymentId, {
      length: LTI_DEPLOYMENT_ID_LENGTH,
    }).notNull(),
    name: varchar(LTI_COLUMNS.deploymentName, { length: LTI_NAME_LENGTH }),
    description: text(LTI_COLUMNS.deploymentDescription),
    clientId: varchar(LTI_COLUMNS.clientId, { length: LTI_ID_LENGTH }).notNull(),
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
