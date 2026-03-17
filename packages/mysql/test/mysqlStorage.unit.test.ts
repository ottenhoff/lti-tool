import type { LTISession } from '@lti-tool/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createPoolMock, drizzleMock, poolEndMock } = vi.hoisted(() => {
  const poolEndMock = vi.fn().mockResolvedValue(undefined);

  return {
    createPoolMock: vi.fn(() => ({ end: poolEndMock })),
    drizzleMock: vi.fn(() => ({})),
    poolEndMock,
  };
});

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: createPoolMock,
  },
}));

vi.mock('drizzle-orm/mysql2', () => ({
  drizzle: drizzleMock,
}));

import { SESSION_CACHE } from '../src/cacheConfig.js';
import { MySqlStorage } from '../src/index.js';

const testSession: LTISession = {
  id: 'session-123',
  jwtPayload: { iss: 'https://platform.example.com' },
  user: { id: 'user-123', roles: ['Learner'] },
  context: { id: 'context-123', label: 'TEST101', title: 'Test Course' },
  platform: {
    issuer: 'https://platform.example.com',
    clientId: 'client-123',
    deploymentId: 'deployment-123',
    name: 'Test Platform',
  },
  launch: { target: 'https://tool.example.com/launch' },
  customParameters: {},
  isAdmin: false,
  isInstructor: false,
  isStudent: true,
  isAssignmentAndGradesAvailable: false,
  isDeepLinkingAvailable: false,
  isNameAndRolesAvailable: false,
};

type InsertBuilder = {
  values: (values: unknown) => Promise<void>;
};

type TestDb = {
  insert: (table: unknown) => InsertBuilder;
};

describe('MySqlStorage session expiration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    createPoolMock.mockClear();
    drizzleMock.mockClear();
    poolEndMock.mockClear();
    SESSION_CACHE.clear();
  });

  it('uses sessionExpirationSeconds when storing sessions', async () => {
    const storage = new MySqlStorage({
      connectionUrl: 'mysql://user:password@localhost:3306/lti_test',
      sessionExpirationSeconds: 42,
    });
    const insertValues = vi.fn(async (_values: unknown) => undefined);

    (storage as unknown as { db: TestDb }).db = {
      insert: vi.fn((_table: unknown) => ({
        values: insertValues,
      })),
    };

    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await storage.addSession(testSession);

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: testSession.id,
        expiresAt: new Date(1_042_000),
      }),
    );
    expect(SESSION_CACHE.info(testSession.id)?.ttl).toBeLessThanOrEqual(42_000);

    await storage.close();
    expect(poolEndMock).toHaveBeenCalledOnce();
  });
});
