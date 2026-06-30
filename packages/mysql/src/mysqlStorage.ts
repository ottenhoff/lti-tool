import { isServerlessEnvironment } from '@longsightgroup/lti-tool';
import { lt } from 'drizzle-orm';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import type { Logger } from 'pino';

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
import type { MySqlStorageConfig } from './interfaces/mySqlStorageConfig.js';

/**
 * MySQL implementation of LTI storage interface.
 */
export class MySqlStorage extends RelationalStorage {
  private readonly adapterLogger: Logger;
  private readonly pool: mysql.Pool;

  constructor(config: MySqlStorageConfig) {
    const logger = resolveStorageLogger(config.logger);
    const connectionOptions = resolveConnectionOptions(config, logger);
    const pool = mysql.createPool({
      uri: config.connectionUrl,
      connectionLimit: connectionOptions.connectionLimit,
      queueLimit: connectionOptions.queueLimit,
    });
    const db = drizzle(pool, { schema, mode: 'default' });

    super({
      logger,
      db: db as unknown as RelationalDatabase,
      schema,
      dialect: createMySqlDialect(db),
    });

    this.adapterLogger = logger;
    this.pool = pool;

    this.adapterLogger.debug(connectionOptions, 'MySQL connection pool initialized');
  }

  /**
   * Close the MySQL connection pool.
   */
  async close(): Promise<void> {
    this.adapterLogger.debug('closing MySQL connection pool');
    await this.pool.end();
    this.adapterLogger.debug('MySQL connection pool closed');
  }
}

function createMySqlDialect(db: MySql2Database<typeof schema>): RelationalStorageDialect {
  return {
    name: 'MySQL',
    sessionTtlSeconds: SESSION_TTL,
    nonceTtlSeconds: DEFAULT_NONCE_TTL_SECONDS,
    claimNonce: (nonce, expiresAt) => claimMySqlNonce(db, nonce, expiresAt),
    setRegistrationSession: async (sessionId, session) => {
      await db.insert(schema.registrationSessionsTable).values({
        id: sessionId,
        data: session,
        expiresAt: session.expiresAt,
      });
    },
    cleanup: (now) => cleanupMySql(db, now),
  };
}

async function claimMySqlNonce(
  db: MySql2Database<typeof schema>,
  nonce: string,
  expiresAt: number,
): Promise<boolean> {
  const result = await db
    .insert(schema.noncesTable)
    .ignore()
    .values({ nonce, expiresAt });

  return getMySqlAffectedRows(result) === 1;
}

async function cleanupMySql(
  db: MySql2Database<typeof schema>,
  now: number,
): Promise<RelationalCleanupResult> {
  const noncesResult = await db
    .delete(schema.noncesTable)
    .where(lt(schema.noncesTable.expiresAt, now));
  const sessionsResult = await db
    .delete(schema.sessionsTable)
    .where(lt(schema.sessionsTable.expiresAt, now));
  const registrationSessionsResult = await db
    .delete(schema.registrationSessionsTable)
    .where(lt(schema.registrationSessionsTable.expiresAt, now));

  return {
    noncesDeleted: getMySqlAffectedRows(noncesResult),
    sessionsDeleted: getMySqlAffectedRows(sessionsResult),
    registrationSessionsDeleted: getMySqlAffectedRows(registrationSessionsResult),
  };
}

function resolveConnectionOptions(
  config: MySqlStorageConfig,
  logger: Logger,
): {
  readonly connectionLimit: number;
  readonly isServerless: boolean;
  readonly queueLimit: number;
} {
  const isServerless = isServerlessEnvironment();
  const defaultConnectionLimit = isServerless ? 1 : 10;
  const connectionLimit = config.poolOptions?.connectionLimit ?? defaultConnectionLimit;

  if (isServerless && connectionLimit > 5) {
    logger.warn(
      { connectionLimit, environment: 'serverless' },
      'High connectionLimit detected in serverless environment. Consider using 1 connection per container to avoid wasting resources.',
    );
  }

  return {
    connectionLimit,
    isServerless,
    queueLimit: config.poolOptions?.queueLimit ?? 0,
  };
}

function getMySqlAffectedRows(result: unknown): number {
  if (!Array.isArray(result)) return 0;

  const [summary] = result;
  if (typeof summary !== 'object' || summary === null || !('affectedRows' in summary)) {
    return 0;
  }

  return Number(summary.affectedRows ?? 0);
}
