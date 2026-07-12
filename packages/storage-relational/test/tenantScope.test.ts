import { parseStorageTenantId } from '@longsightgroup/lti-tool';
import { PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { createTenantScope } from '../src/tenantScope.js';

describe('createTenantScope', () => {
  const sessions = pgTable('sessions', {
    tenantId: text('tenant_id').notNull(),
  });

  it('adds the tenant to insert values and predicates', () => {
    const scope = createTenantScope(parseStorageTenantId('tenant_123'));

    expect(scope.insertValues({ id: 'session-1' })).toEqual({
      id: 'session-1',
      tenantId: 'tenant_123',
    });
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(scope.condition(sessions))).toMatchObject({
      sql: '"sessions"."tenant_id" = $1',
      params: ['tenant_123'],
    });
    expect(
      dialect.sqlToQuery(scope.withTenant(sessions, scope.condition(sessions))),
    ).toMatchObject({
      sql: '("sessions"."tenant_id" = $1 and "sessions"."tenant_id" = $2)',
      params: ['tenant_123', 'tenant_123'],
    });
  });
});
