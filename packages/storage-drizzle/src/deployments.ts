import type { LTIDeployment } from '@longsightgroup/lti-tool';
import { and, eq, type AnyColumn } from 'drizzle-orm';

export type DrizzleDeploymentOps = {
  readonly listDeployments: (clientId: string) => Promise<LTIDeployment[]>;
  readonly getDeploymentByPlatformId: (
    clientId: string,
    deploymentId: string,
  ) => Promise<LTIDeployment | undefined>;
  readonly getDeploymentByInternalId: (
    clientId: string,
    deploymentInternalId: string,
  ) => Promise<LTIDeployment | undefined>;
  readonly updateDeploymentByInternalId: (
    clientId: string,
    deploymentInternalId: string,
    deployment: Partial<LTIDeployment>,
  ) => Promise<LTIDeployment | undefined>;
  readonly deleteDeploymentByInternalId: (
    clientId: string,
    deploymentInternalId: string,
  ) => Promise<LTIDeployment | undefined>;
};

export type DrizzleDeploymentTable = {
  readonly id: AnyColumn;
  readonly clientId: AnyColumn;
  readonly deploymentId: AnyColumn;
  readonly name: AnyColumn;
  readonly description: AnyColumn;
};

export type DrizzleDeploymentOpsConfig = {
  readonly db: unknown;
  readonly table: DrizzleDeploymentTable;
  readonly executeMutation: (query: unknown) => Promise<void>;
};

type DeploymentRow = {
  readonly id: string;
  readonly deploymentId: string;
  readonly name: string | null;
  readonly description: string | null;
};

type DeploymentUpdateRow = {
  readonly deploymentId: string;
  readonly name: string | null;
  readonly description: string | null;
};

type SelectFromBuilder = {
  readonly from: (table: unknown) => SelectWhereBuilder;
};

type SelectWhereBuilder = PromiseLike<readonly DeploymentRow[]> & {
  readonly where: (condition: unknown) => SelectWhereBuilder;
  readonly orderBy: (...columns: readonly AnyColumn[]) => SelectWhereBuilder;
  readonly limit: (limit: number) => SelectWhereBuilder;
};

type UpdateBuilder = {
  readonly set: (values: DeploymentUpdateRow) => MutationWhereBuilder;
};

type DeleteBuilder = {
  readonly where: (condition: unknown) => unknown;
};

type MutationWhereBuilder = {
  readonly where: (condition: unknown) => unknown;
};

export function createDrizzleDeploymentOps(
  config: DrizzleDeploymentOpsConfig,
): DrizzleDeploymentOps {
  const { db, table } = config;

  return {
    listDeployments: async (clientId) => {
      const rows = await selectDeployments(db, table)
        .where(eq(table.clientId, clientId))
        .orderBy(table.deploymentId, table.id);

      return rows.map(mapDeploymentRow);
    },
    getDeploymentByPlatformId: (clientId, deploymentId) =>
      selectDeploymentByPlatformId(db, table, clientId, deploymentId),
    getDeploymentByInternalId: (clientId, deploymentInternalId) =>
      selectDeploymentByInternalId(db, table, clientId, deploymentInternalId),
    updateDeploymentByInternalId: (clientId, deploymentInternalId, deployment) =>
      updateDeploymentByInternalId(config, clientId, deploymentInternalId, deployment),
    deleteDeploymentByInternalId: (clientId, deploymentInternalId) =>
      deleteDeploymentByInternalId(config, clientId, deploymentInternalId),
  };
}

async function updateDeploymentByInternalId(
  config: DrizzleDeploymentOpsConfig,
  clientId: string,
  deploymentInternalId: string,
  deployment: Partial<LTIDeployment>,
): Promise<LTIDeployment | undefined> {
  const { db, table, executeMutation } = config;
  const existing = await selectDeploymentByInternalId(
    db,
    table,
    clientId,
    deploymentInternalId,
  );
  if (existing === undefined) return undefined;

  const updated = { ...existing, ...deployment };
  await executeMutation(
    updateDeployments(db, table)
      .set(toDeploymentUpdateRow(updated))
      .where(and(eq(table.clientId, clientId), eq(table.id, deploymentInternalId))),
  );

  return existing;
}

async function deleteDeploymentByInternalId(
  config: DrizzleDeploymentOpsConfig,
  clientId: string,
  deploymentInternalId: string,
): Promise<LTIDeployment | undefined> {
  const { db, table, executeMutation } = config;
  const existing = await selectDeploymentByInternalId(
    db,
    table,
    clientId,
    deploymentInternalId,
  );
  if (existing === undefined) return undefined;

  await executeMutation(
    deleteDeployments(db, table).where(
      and(eq(table.clientId, clientId), eq(table.id, deploymentInternalId)),
    ),
  );

  return existing;
}

async function selectDeploymentByPlatformId(
  db: unknown,
  table: DrizzleDeploymentTable,
  clientId: string,
  deploymentId: string,
): Promise<LTIDeployment | undefined> {
  const [deployment] = await selectDeployments(db, table)
    .where(and(eq(table.clientId, clientId), eq(table.deploymentId, deploymentId)))
    .limit(1);

  return deployment === undefined ? undefined : mapDeploymentRow(deployment);
}

async function selectDeploymentByInternalId(
  db: unknown,
  table: DrizzleDeploymentTable,
  clientId: string,
  deploymentInternalId: string,
): Promise<LTIDeployment | undefined> {
  const [deployment] = await selectDeployments(db, table)
    .where(and(eq(table.clientId, clientId), eq(table.id, deploymentInternalId)))
    .limit(1);

  return deployment === undefined ? undefined : mapDeploymentRow(deployment);
}

function mapDeploymentRow(row: DeploymentRow): LTIDeployment {
  return {
    id: row.id,
    deploymentId: row.deploymentId,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
  };
}

function toDeploymentUpdateRow(deployment: LTIDeployment): DeploymentUpdateRow {
  return {
    deploymentId: deployment.deploymentId,
    name: deployment.name ?? null,
    description: deployment.description ?? null,
  };
}

function selectDeployments(
  db: unknown,
  table: DrizzleDeploymentTable,
): SelectWhereBuilder {
  // SAFETY: Drizzle's dialect-specific database classes all expose the same
  // select().from().where()/limit()/orderBy() shape for this table projection.
  // This helper centralizes that structural boundary so adapters do not repeat
  // casts or row mapping.
  return (db as { readonly select: () => SelectFromBuilder }).select().from(table);
}

function updateDeployments(db: unknown, table: DrizzleDeploymentTable): UpdateBuilder {
  // SAFETY: The table columns and update row are restricted by this module's
  // DrizzleDeploymentTable/DeploymentUpdateRow contracts before reaching Drizzle.
  return (db as { readonly update: (table: unknown) => UpdateBuilder }).update(table);
}

function deleteDeployments(db: unknown, table: DrizzleDeploymentTable): DeleteBuilder {
  // SAFETY: The only delete condition built here is scoped by client id and
  // internal deployment id using the provided Drizzle table columns.
  return (db as { readonly delete: (table: unknown) => DeleteBuilder }).delete(table);
}
