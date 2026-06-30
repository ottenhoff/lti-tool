import { isServerlessEnvironment } from '@longsightgroup/lti-tool';
import { eq, lt } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Logger } from 'pino';
import postgres from 'postgres';

import { toDeploymentInsertRow } from '#storage/drizzle-deployment-row';
import {
  RelationalStorage,
  type RelationalCleanupResult,
  type RelationalDatabase,
  type RelationalStorageDialect,
  resolveStorageLogger,
} from '#storage/relational-storage';

import { SESSION_TTL } from './cacheConfig.js';
import * as schema from './db/schema/index.js';
import type { PostgresStorageConfig } from './interfaces/postgresStorageConfig.js';

/**
 * PostgreSQL implementation of LTI storage interface.
 */
export class PostgresStorage extends RelationalStorage {
  private readonly adapterLogger: Logger;
  private readonly sql: postgres.Sql;

  constructor(config: PostgresStorageConfig) {
    const logger = resolveStorageLogger(config.logger);
    const connectionOptions = resolveConnectionOptions(config, logger);
    const sql = postgres(config.connectionUrl, {
      max: connectionOptions.max,
      idle_timeout: connectionOptions.idleTimeout,
    });
    const db = drizzle(sql, { schema });

    super({
      logger,
      db: db as unknown as RelationalDatabase,
      schema,
      dialect: createPostgresDialect(db),
    });

    this.adapterLogger = logger;
    this.sql = sql;

    this.adapterLogger.debug(connectionOptions, 'PostgreSQL connection pool initialized');
  }

  /**
   * Close the PostgreSQL connection pool.
   */
  async close(): Promise<void> {
    this.adapterLogger.debug('closing PostgreSQL connection pool');
    await this.sql.end();
    this.adapterLogger.debug('PostgreSQL connection pool closed');
  }
}

function createPostgresDialect(
  db: PostgresJsDatabase<typeof schema>,
): RelationalStorageDialect {
  return {
    name: 'PostgreSQL',
    sessionTtlSeconds: SESSION_TTL,
    insertClient: async (client) => {
      const [inserted] = await db
        .insert(schema.clientsTable)
        .values(client)
        .returning({ id: schema.clientsTable.id });
      return inserted.id;
    },
    insertDeployment: async (clientId, deployment) => {
      const [inserted] = await db
        .insert(schema.deploymentsTable)
        .values({
          clientId,
          ...toDeploymentInsertRow(deployment),
        })
        .returning({ id: schema.deploymentsTable.id });
      return inserted.id;
    },
    deleteClient: (clientId) => deletePostgresClient(db, clientId),
    requireExistingClientBeforeDelete: true,
    insertSession: async (session, expiresAt) => {
      const { id, ...data } = session;
      await db.insert(schema.sessionsTable).values({
        id,
        data,
        expiresAt: expiresAt as Date,
      });
    },
    claimNonce: (nonce, expiresAt) => claimPostgresNonce(db, nonce, expiresAt as Date),
    serializeDate: (date) => date,
    setRegistrationSession: async (sessionId, session) => {
      await db.insert(schema.registrationSessionsTable).values({
        id: sessionId,
        data: session,
        expiresAt: new Date(session.expiresAt),
      });
    },
    cleanup: (now) => cleanupPostgres(db, now),
  };
}

async function deletePostgresClient(
  db: PostgresJsDatabase<typeof schema>,
  clientId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.deploymentsTable)
      .where(eq(schema.deploymentsTable.clientId, clientId));
    await tx.delete(schema.clientsTable).where(eq(schema.clientsTable.id, clientId));
  });
}

async function claimPostgresNonce(
  db: PostgresJsDatabase<typeof schema>,
  nonce: string,
  expiresAt: Date,
): Promise<boolean> {
  const rows = await db
    .insert(schema.noncesTable)
    .values({ nonce, expiresAt })
    .onConflictDoNothing()
    .returning({ nonce: schema.noncesTable.nonce });

  return rows.length === 1;
}

async function cleanupPostgres(
  db: PostgresJsDatabase<typeof schema>,
  now: Date,
): Promise<RelationalCleanupResult> {
  const noncesResult = await db
    .delete(schema.noncesTable)
    .where(lt(schema.noncesTable.expiresAt, now))
    .returning({ nonce: schema.noncesTable.nonce });
  const sessionsResult = await db
    .delete(schema.sessionsTable)
    .where(lt(schema.sessionsTable.expiresAt, now))
    .returning({ id: schema.sessionsTable.id });
  const registrationSessionsResult = await db
    .delete(schema.registrationSessionsTable)
    .where(lt(schema.registrationSessionsTable.expiresAt, now))
    .returning({ id: schema.registrationSessionsTable.id });

  return {
    noncesDeleted: noncesResult.length,
    sessionsDeleted: sessionsResult.length,
    registrationSessionsDeleted: registrationSessionsResult.length,
  };
}

function resolveConnectionOptions(
  config: PostgresStorageConfig,
  logger: Logger,
): {
  readonly idleTimeout: number;
  readonly isServerless: boolean;
  readonly max: number;
} {
  const isServerless = isServerlessEnvironment();
  const defaultMax = isServerless ? 1 : 10;
  const max = config.poolOptions?.max ?? defaultMax;

  if (isServerless && max > 5) {
    logger.warn(
      { max, environment: 'serverless' },
      'High connection limit detected in serverless environment. Consider using 1 connection per container to avoid wasting resources.',
    );
  }

  return {
    idleTimeout: config.poolOptions?.idleTimeout ?? 20,
    isServerless,
    max,
  };
}
