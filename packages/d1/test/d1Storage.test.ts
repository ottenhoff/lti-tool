import type {
  LTIClient,
  LTIDynamicRegistrationSession,
  LTISession,
} from '@lti-tool/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LAUNCH_CONFIG_CACHE,
  SESSION_CACHE,
  undefinedSessionValue,
} from '../src/cacheConfig.js';
import { D1Storage } from '../src/index.js';
import type {
  D1AllResultLike,
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1RunResultLike,
} from '../src/interfaces/d1Database.js';

const listDeploymentsQuerySnippet =
  'FROM deployments WHERE clientId = ? ORDER BY deploymentId ASC';

type ClientRecord = Omit<LTIClient, 'deployments'>;

type DeploymentRecord = {
  id: string;
  clientId: string;
  deploymentId: string;
  name: string | null;
  description: string | null;
};

type SessionRecord = {
  id: string;
  data: string;
  expiresAt: number;
};

type RegistrationSessionRecord = {
  id: string;
  data: string;
  expiresAt: number;
};

class FakeD1PreparedStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(
    private database: FakeD1Database,
    private query: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    const normalizedQuery = normalizeQuery(this.query);

    if (normalizedQuery.includes('FROM clients WHERE id = ?')) {
      const clientId = this.values[0] as string;
      return (this.database.clients.get(clientId) as T | undefined) ?? null;
    }

    if (normalizedQuery.includes('FROM deployments WHERE clientId = ? AND id = ?')) {
      const clientId = this.values[0] as string;
      const deploymentId = this.values[1] as string;
      const deployment = this.database.deployments.get(deploymentId);
      if (!deployment || deployment.clientId !== clientId) {
        return null;
      }
      return deployment as T;
    }

    if (normalizedQuery.includes('FROM sessions WHERE id = ? AND expiresAt > ?')) {
      const sessionId = this.values[0] as string;
      const now = this.values[1] as number;
      const session = this.database.sessions.get(sessionId);
      if (!session || session.expiresAt <= now) {
        return null;
      }
      return session as T;
    }

    if (
      normalizedQuery.includes('FROM registrationSessions WHERE id = ? AND expiresAt > ?')
    ) {
      const sessionId = this.values[0] as string;
      const now = this.values[1] as number;
      const session = this.database.registrationSessions.get(sessionId);
      if (!session || session.expiresAt <= now) {
        return null;
      }
      return session as T;
    }

    if (normalizedQuery.includes('FROM clients INNER JOIN deployments')) {
      const iss = this.values[0] as string;
      const clientId = this.values[1] as string;
      const deploymentId = this.values[2] as string;

      const client = [...this.database.clients.values()].find(
        (candidate) => candidate.iss === iss && candidate.clientId === clientId,
      );
      if (!client) {
        return null;
      }

      const deployment = [...this.database.deployments.values()].find(
        (candidate) =>
          candidate.clientId === client.id && candidate.deploymentId === deploymentId,
      );
      if (!deployment) {
        return null;
      }

      return {
        iss: client.iss,
        clientId: client.clientId,
        deploymentId: deployment.deploymentId,
        authUrl: client.authUrl,
        tokenUrl: client.tokenUrl,
        jwksUrl: client.jwksUrl,
      } as T;
    }

    throw new Error(`Unsupported first() query in test fake: ${normalizedQuery}`);
  }

  async all<T>(): Promise<D1AllResultLike<T>> {
    const normalizedQuery = normalizeQuery(this.query);

    if (normalizedQuery.includes('FROM clients ORDER BY name ASC')) {
      return {
        results: [...this.database.clients.values()].sort((left, right) =>
          left.name.localeCompare(right.name),
        ) as T[],
      };
    }

    if (normalizedQuery.includes(listDeploymentsQuerySnippet)) {
      const clientId = this.values[0] as string;
      return {
        results: [...this.database.deployments.values()]
          .filter((deployment) => deployment.clientId === clientId)
          .sort((left, right) =>
            left.deploymentId.localeCompare(right.deploymentId),
          ) as T[],
      };
    }

    throw new Error(`Unsupported all() query in test fake: ${normalizedQuery}`);
  }

  async run(): Promise<D1RunResultLike> {
    const normalizedQuery = normalizeQuery(this.query);

    if (normalizedQuery.startsWith('INSERT INTO clients')) {
      const [id, name, iss, clientId, authUrl, tokenUrl, jwksUrl] = this.values as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      this.database.clients.set(id, {
        id,
        name,
        iss,
        clientId,
        authUrl,
        tokenUrl,
        jwksUrl,
      });
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery.startsWith('UPDATE clients')) {
      const [name, iss, clientId, authUrl, tokenUrl, jwksUrl, id] = this.values as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      const existing = this.database.clients.get(id);
      if (!existing) {
        return { meta: { changes: 0 }, success: true };
      }
      this.database.clients.set(id, {
        ...existing,
        name,
        iss,
        clientId,
        authUrl,
        tokenUrl,
        jwksUrl,
      });
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery === 'DELETE FROM deployments WHERE clientId = ?') {
      const clientId = this.values[0] as string;
      for (const [deploymentId, deployment] of this.database.deployments.entries()) {
        if (deployment.clientId === clientId) {
          this.database.deployments.delete(deploymentId);
        }
      }
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery === 'DELETE FROM clients WHERE id = ?') {
      const clientId = this.values[0] as string;
      this.database.clients.delete(clientId);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery.startsWith('INSERT INTO deployments')) {
      const [id, clientId, deploymentId, name, description] = this.values as [
        string,
        string,
        string,
        string | null,
        string | null,
      ];
      this.database.deployments.set(id, {
        id,
        clientId,
        deploymentId,
        name,
        description,
      });
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery.startsWith('UPDATE deployments')) {
      const [deploymentId, name, description, id, clientId] = this.values as [
        string,
        string | null,
        string | null,
        string,
        string,
      ];
      const existing = this.database.deployments.get(id);
      if (!existing || existing.clientId !== clientId) {
        return { meta: { changes: 0 }, success: true };
      }
      this.database.deployments.set(id, {
        ...existing,
        deploymentId,
        name,
        description,
      });
      return { meta: { changes: 1 }, success: true };
    }

    if (
      normalizedQuery.startsWith('DELETE FROM deployments WHERE clientId = ? AND id = ?')
    ) {
      const clientId = this.values[0] as string;
      const deploymentId = this.values[1] as string;
      const existing = this.database.deployments.get(deploymentId);
      if (existing?.clientId === clientId) {
        this.database.deployments.delete(deploymentId);
      }
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery.startsWith('INSERT INTO nonces')) {
      const [nonce, expiresAt, now] = this.values as [string, number, number];
      const existingExpiration = this.database.nonces.get(nonce);
      if (existingExpiration !== undefined && existingExpiration > now) {
        return { meta: { changes: 0 }, success: true };
      }
      this.database.nonces.set(nonce, expiresAt);
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery.startsWith('INSERT INTO sessions')) {
      const [id, data, expiresAt] = this.values as [string, string, number];
      this.database.sessions.set(id, { id, data, expiresAt });
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery.startsWith('INSERT OR REPLACE INTO registrationSessions')) {
      const [id, data, expiresAt] = this.values as [string, string, number];
      this.database.registrationSessions.set(id, { id, data, expiresAt });
      return { meta: { changes: 1 }, success: true };
    }

    if (normalizedQuery.startsWith('DELETE FROM registrationSessions')) {
      const id = this.values[0] as string;
      this.database.registrationSessions.delete(id);
      return { meta: { changes: 1 }, success: true };
    }

    throw new Error(`Unsupported run() query in test fake: ${normalizedQuery}`);
  }
}

class FakeD1Database implements D1DatabaseLike {
  clients = new Map<string, ClientRecord>();
  deployments = new Map<string, DeploymentRecord>();
  sessions = new Map<string, SessionRecord>();
  nonces = new Map<string, number>();
  registrationSessions = new Map<string, RegistrationSessionRecord>();
  execCalls = 0;

  prepare(query: string): D1PreparedStatementLike {
    return new FakeD1PreparedStatement(this, query);
  }

  async exec(_query: string): Promise<unknown> {
    this.execCalls += 1;
    return undefined;
  }
}

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

const registrationSession: LTIDynamicRegistrationSession = {
  openIdConfiguration: {
    issuer: 'https://platform.example.com',
    authorization_endpoint: 'https://platform.example.com/auth',
    jwks_uri: 'https://platform.example.com/jwks',
    registration_endpoint: 'https://platform.example.com/register',
    token_endpoint: 'https://platform.example.com/token',
    token_endpoint_auth_methods_supported: ['private_key_jwt'],
    token_endpoint_auth_signing_alg_values_supported: ['RS256'],
    response_types_supported: ['id_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'],
    claims_supported: ['sub'],
    'https://purl.imsglobal.org/spec/lti-platform-configuration': {
      product_family_code: 'test',
      version: '1.0',
      messages_supported: [{ type: 'LtiResourceLinkRequest' }],
    },
  },
  registrationToken: 'token-123',
  expiresAt: 5_000_000,
};

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

describe('D1Storage', () => {
  let database: FakeD1Database;
  let storage: D1Storage;

  beforeEach(() => {
    vi.restoreAllMocks();
    LAUNCH_CONFIG_CACHE.clear();
    SESSION_CACHE.clear();
    database = new FakeD1Database();
    storage = new D1Storage({ database });
  });

  it('stores sessions using the core-provided expiration timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await storage.addSession(testSession, new Date(1_042_000));

    expect(database.sessions.get(testSession.id)?.expiresAt).toBe(1_042_000);
    expect(SESSION_CACHE.info(testSession.id)?.ttl).toBeLessThanOrEqual(42_000);
  });

  it('returns undefined for expired sessions and caches the miss', async () => {
    database.sessions.set(testSession.id, {
      id: testSession.id,
      data: JSON.stringify({
        ...testSession,
        id: undefined,
      }),
      expiresAt: 999_999,
    });
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    const session = await storage.getSession(testSession.id);

    expect(session).toBeUndefined();
    expect(SESSION_CACHE.get(testSession.id)).toBe(undefinedSessionValue);
  });

  it('derives launch configs from clients and deployments with default fallback', async () => {
    const clientId = await storage.addClient({
      name: 'Platform',
      iss: 'https://platform.example.com',
      clientId: 'client-123',
      authUrl: 'https://platform.example.com/auth',
      tokenUrl: 'https://platform.example.com/token',
      jwksUrl: 'https://platform.example.com/jwks',
    });

    await storage.addDeployment(clientId, {
      deploymentId: 'default',
      name: 'Default deployment',
    });

    const launchConfig = await storage.getLaunchConfig(
      'https://platform.example.com',
      'client-123',
      'missing',
    );

    expect(launchConfig).toEqual({
      iss: 'https://platform.example.com',
      clientId: 'client-123',
      deploymentId: 'default',
      authUrl: 'https://platform.example.com/auth',
      tokenUrl: 'https://platform.example.com/token',
      jwksUrl: 'https://platform.example.com/jwks',
    });
  });

  it('updates deployments and clears stale launch config cache entries', async () => {
    const clientId = await storage.addClient({
      name: 'Platform',
      iss: 'https://platform.example.com',
      clientId: 'client-123',
      authUrl: 'https://platform.example.com/auth',
      tokenUrl: 'https://platform.example.com/token',
      jwksUrl: 'https://platform.example.com/jwks',
    });
    const deploymentId = await storage.addDeployment(clientId, {
      deploymentId: 'deployment-old',
      name: 'Old deployment',
    });

    await storage.getLaunchConfig(
      'https://platform.example.com',
      'client-123',
      'deployment-old',
    );

    await storage.updateDeployment(clientId, deploymentId, {
      deploymentId: 'deployment-new',
    });

    const oldLaunchConfig = await storage.getLaunchConfig(
      'https://platform.example.com',
      'client-123',
      'deployment-old',
    );
    const newLaunchConfig = await storage.getLaunchConfig(
      'https://platform.example.com',
      'client-123',
      'deployment-new',
    );

    expect(oldLaunchConfig).toBeUndefined();
    expect(newLaunchConfig?.deploymentId).toBe('deployment-new');
  });

  it('validates nonces atomically until they expire', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    expect(await storage.validateNonce('nonce-123')).toBe(true);
    expect(await storage.validateNonce('nonce-123')).toBe(false);

    vi.spyOn(Date, 'now').mockReturnValue(1_700_000);
    expect(await storage.validateNonce('nonce-123')).toBe(true);
  });

  it('stores and retrieves registration sessions while they are active', async () => {
    await storage.setRegistrationSession('reg-123', registrationSession);
    vi.spyOn(Date, 'now').mockReturnValue(4_000_000);

    const result = await storage.getRegistrationSession('reg-123');

    expect(result).toEqual(registrationSession);

    await storage.deleteRegistrationSession('reg-123');
    expect(await storage.getRegistrationSession('reg-123')).toBeUndefined();
  });

  it('bootstraps the schema lazily on first use', async () => {
    expect(database.execCalls).toBe(0);

    await storage.listClients();
    await storage.listClients();

    expect(database.execCalls).toBe(1);
  });
});
