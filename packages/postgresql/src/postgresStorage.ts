import { isServerlessEnvironment } from '@longsightgroup/lti-tool';
import { lt } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Logger } from 'pino';
import postgres from 'postgres';

import {
  RelationalStorage,
  DEFAULT_NONCE_TTL_SECONDS,
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
    nonceTtlSeconds: DEFAULT_NONCE_TTL_SECONDS,
    claimNonce: (nonce, expiresAt) => claimPostgresNonce(db, nonce, expiresAt),
    setRegistrationSession: async (sessionId, session) => {
      await db.insert(schema.registrationSessionsTable).values({
        id: sessionId,
        data: session,
        expiresAt: session.expiresAt,
      });
    },
    cleanup: (now) => cleanupPostgres(db, now),
  };
}

async function claimPostgresNonce(
  db: PostgresJsDatabase<typeof schema>,
  nonce: string,
  expiresAt: number,
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
  now: number,
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
