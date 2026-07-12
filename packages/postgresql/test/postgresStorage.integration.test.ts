import 'dotenv/config';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createPostgresHarness,
  type PostgresStorageHarness,
} from '#test-harness/storage/postgres';
import { defineStorageConformanceSuite } from '#test-harness/storageConformance';

defineStorageConformanceSuite('PostgresStorage', {
  capabilities: {
    expiredNonces: true,
    expiredSessions: true,
    expiredRegistrationSessions: true,
  },
  createStorage: () => createPostgresHarness(),
  tenantConformance: {
    createTenantStorage: (tenantId) => createPostgresHarness(undefined, tenantId),
    tenantScopedCleanup: true,
  },
});

describe('PostgresStorage cleanup', () => {
  let harness: PostgresStorageHarness;

  beforeEach(() => {
    harness = createPostgresHarness();
  });

  afterEach(async () => {
    await harness.dispose();
  });

  it('deletes expired items', async () => {
    await harness.seedExpiredNonce('expired-nonce');

    const result = await harness.storage.cleanup();

    expect(result.noncesDeleted).toBe(1);
  });
});

describe('PostgreSQL tenant RLS', () => {
  it('rejects a direct write for another tenant', async () => {
    const connectionUrl =
      process.env.DATABASE_URL ??
      'postgresql://lti_user:lti_password@localhost:5432/lti_test';
    const admin = postgres(connectionUrl, { max: 1 });
    await admin.unsafe('DROP ROLE IF EXISTS lti_rls_test_app');
    await admin.unsafe(
      "CREATE ROLE lti_rls_test_app LOGIN PASSWORD 'lti_rls_test_password'",
    );
    await admin.unsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lti_rls_test_app',
    );

    const applicationUrl = new URL(connectionUrl);
    applicationUrl.username = 'lti_rls_test_app';
    applicationUrl.password = 'lti_rls_test_password';
    const sql = postgres(applicationUrl.toString(), {
      connection: { 'app.tenant_id': 'rls_tenant_a' },
      max: 1,
    });

    try {
      await expect(sql`
        INSERT INTO lti_clients (
          id, tenant_id, platform_name, iss, client_id, auth_url, token_url, jwks_url
        ) VALUES (
          'rls-client', 'rls_tenant_b', 'Platform', 'https://platform.example.com',
          'client-id', 'https://platform.example.com/auth',
          'https://platform.example.com/token', 'https://platform.example.com/jwks'
        )
      `).rejects.toThrow(/row-level security/i);
    } finally {
      await sql.end();
      await admin.unsafe(
        'REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM lti_rls_test_app',
      );
      await admin.unsafe('DROP ROLE IF EXISTS lti_rls_test_app');
      await admin.end();
    }
  });
});
