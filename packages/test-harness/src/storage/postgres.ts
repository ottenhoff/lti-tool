import type { LTIDynamicRegistrationSession, LTISession } from '@longsightgroup/lti-tool';
import postgres from 'postgres';

import { PostgresStorage } from '#storage/postgresql';

import {
  createRelationalReset,
  createRelationalSeedHelpers,
  type RelationalTable,
  type RelationalSeedWriter,
} from './relationalHarness.js';
import type { StorageHarness } from './types.js';

export class PostgresStorageHarness implements StorageHarness<PostgresStorage> {
  private readonly seedHelpers;

  private constructor(
    private readonly sql: postgres.Sql,
    readonly storage: PostgresStorage,
    private readonly resetTables: () => Promise<void>,
  ) {
    this.seedHelpers = createRelationalSeedHelpers(this.createSeedWriter());
  }

  static create(
    connectionUrl = process.env.DATABASE_URL ??
      'postgresql://lti_user:lti_password@localhost:5432/lti_test',
  ): PostgresStorageHarness {
    const sql = postgres(connectionUrl);
    const seedWriter = createPostgresSeedWriter(sql);
    return new PostgresStorageHarness(
      sql,
      new PostgresStorage({ connectionUrl }),
      createRelationalReset(seedWriter),
    );
  }

  reset(): Promise<void> {
    return this.resetTables();
  }

  seedExpiredSession(sessionId: string, session: LTISession): Promise<void> {
    return this.seedHelpers.seedExpiredSession(sessionId, session);
  }

  seedExpiredNonce(nonce: string): Promise<void> {
    return this.seedHelpers.seedExpiredNonce(nonce);
  }

  seedExpiredRegistrationSession(
    sessionId: string,
    session: LTIDynamicRegistrationSession,
  ): Promise<void> {
    return this.seedHelpers.seedExpiredRegistrationSession(sessionId, session);
  }

  async dispose(): Promise<void> {
    await this.storage.close();
    await this.sql.end();
  }

  private createSeedWriter(): RelationalSeedWriter {
    return createPostgresSeedWriter(this.sql);
  }
}

export function createPostgresHarness(connectionUrl?: string): PostgresStorageHarness {
  return PostgresStorageHarness.create(connectionUrl);
}

function createPostgresSeedWriter(sql: postgres.Sql): RelationalSeedWriter {
  return {
    async resetTable(table: RelationalTable): Promise<void> {
      await sql.unsafe(`DELETE FROM ${table}`);
    },

    async insertSession(input): Promise<void> {
      await sql`
        INSERT INTO lti_sessions (id, payload, expires_at)
        VALUES (${input.sessionId}, ${input.payloadJson}::jsonb, ${input.expiresAt})
      `;
    },

    async insertNonce(input): Promise<void> {
      await sql`
        INSERT INTO lti_nonces (nonce, expires_at)
        VALUES (${input.nonce}, ${input.expiresAt})
      `;
    },

    async insertRegistrationSession(input): Promise<void> {
      await sql`
        INSERT INTO lti_registration_sessions (id, payload, expires_at)
        VALUES (${input.sessionId}, ${input.payloadJson}::jsonb, ${input.expiresAt})
      `;
    },
  };
}
