// oxlint-disable max-lines-per-function
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  LTIClient,
  LTIDeployment,
  LTIDynamicRegistrationSession,
  LTISession,
} from '@lti-tool/core';
import { Log, LogLevel, Miniflare } from 'miniflare';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDirectory, '..');

const testClient: Omit<LTIClient, 'id' | 'deployments'> = {
  name: 'Test Platform',
  iss: 'https://platform.example.com',
  clientId: 'oauth-client-id',
  authUrl: 'https://platform.example.com/auth',
  tokenUrl: 'https://platform.example.com/token',
  jwksUrl: 'https://platform.example.com/jwks',
};

const testDeployment: Omit<LTIDeployment, 'id'> = {
  deploymentId: 'platform-deployment-id',
  name: 'Test Deployment',
  description: 'A test deployment',
};

const testSession: LTISession = {
  id: 'session-id',
  jwtPayload: { iss: testClient.iss },
  user: { id: 'user-id', roles: ['Learner'] },
  context: { id: 'context-id', label: 'TEST101', title: 'Test Course' },
  platform: {
    issuer: testClient.iss,
    clientId: testClient.clientId,
    deploymentId: testDeployment.deploymentId,
    name: testClient.name,
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

let harness: D1StorageHarness;

beforeEach(async () => {
  harness = await D1StorageHarness.create();
});

afterEach(async () => {
  await harness?.dispose();
});

describe('D1Storage with Miniflare D1', () => {
  describe('client operations', () => {
    it('adds, retrieves, lists, updates, and deletes clients with deployments', async () => {
      const clientInternalId = await harness.storage<string>('addClient', testClient);
      const deploymentInternalId = await harness.storage<string>(
        'addDeployment',
        clientInternalId,
        testDeployment,
      );

      await expect(
        harness.storage('getClientById', clientInternalId),
      ).resolves.toMatchObject({
        id: clientInternalId,
        name: testClient.name,
        deployments: [
          {
            id: deploymentInternalId,
            deploymentId: testDeployment.deploymentId,
          },
        ],
      });
      await expect(harness.storage('listClients')).resolves.toMatchObject([
        { id: clientInternalId, clientId: testClient.clientId },
      ]);

      await harness.storage('updateClient', clientInternalId, {
        name: 'Updated Platform',
      });
      await expect(
        harness.storage('getClientById', clientInternalId),
      ).resolves.toMatchObject({
        id: clientInternalId,
        name: 'Updated Platform',
      });

      await harness.storage('deleteClient', clientInternalId);
      await expect(
        harness.storage('getClientById', clientInternalId),
      ).resolves.toBeNull();
      await expect(harness.storage('listDeployments', clientInternalId)).resolves.toEqual(
        [],
      );
    });

    it('throws when updating a missing client', async () => {
      await expect(
        harness.storage('updateClient', 'missing-client', { name: 'Updated' }),
      ).rejects.toThrow('Client not found');
    });
  });

  describe('deployment operations', () => {
    it('uses internal deployment IDs for deployment management and platform deployment IDs for launch config', async () => {
      const clientInternalId = await harness.storage<string>('addClient', testClient);
      const deploymentInternalId = await harness.storage<string>(
        'addDeployment',
        clientInternalId,
        testDeployment,
      );

      await expect(
        harness.storage('getDeployment', clientInternalId, deploymentInternalId),
      ).resolves.toMatchObject({
        id: deploymentInternalId,
        deploymentId: testDeployment.deploymentId,
      });
      await expect(
        harness.storage('getDeployment', clientInternalId, testDeployment.deploymentId),
      ).resolves.toBeNull();

      await expect(
        harness.storage(
          'getLaunchConfig',
          testClient.iss,
          testClient.clientId,
          testDeployment.deploymentId,
        ),
      ).resolves.toMatchObject({
        iss: testClient.iss,
        clientId: testClient.clientId,
        deploymentId: testDeployment.deploymentId,
      });
      await expect(
        harness.storage(
          'getLaunchConfig',
          testClient.iss,
          testClient.clientId,
          deploymentInternalId,
        ),
      ).resolves.toBeNull();
    });

    it('lists, updates, and deletes deployments by internal ID', async () => {
      const clientInternalId = await harness.storage<string>('addClient', testClient);
      const deploymentA = await harness.storage<string>(
        'addDeployment',
        clientInternalId,
        {
          deploymentId: 'z-platform-deployment',
        },
      );
      const deploymentB = await harness.storage<string>(
        'addDeployment',
        clientInternalId,
        {
          deploymentId: 'a-platform-deployment',
        },
      );

      await expect(
        harness.storage('listDeployments', clientInternalId),
      ).resolves.toMatchObject([
        { id: deploymentB, deploymentId: 'a-platform-deployment' },
        { id: deploymentA, deploymentId: 'z-platform-deployment' },
      ]);

      await harness.storage('updateDeployment', clientInternalId, deploymentA, {
        deploymentId: 'updated-platform-deployment',
        name: 'Updated Deployment',
      });
      await expect(
        harness.storage('getDeployment', clientInternalId, deploymentA),
      ).resolves.toMatchObject({
        id: deploymentA,
        deploymentId: 'updated-platform-deployment',
        name: 'Updated Deployment',
      });

      await harness.storage('deleteDeployment', clientInternalId, deploymentA);
      await expect(
        harness.storage('getDeployment', clientInternalId, deploymentA),
      ).resolves.toBeNull();
      await expect(
        harness.storage('getDeployment', clientInternalId, deploymentB),
      ).resolves.toBeDefined();
    });

    it('enforces one platform deployment ID per client in the local D1 schema', async () => {
      const clientInternalId = await harness.storage<string>('addClient', testClient);
      await harness.storage('addDeployment', clientInternalId, testDeployment);

      await expect(
        harness.storage('addDeployment', clientInternalId, testDeployment),
      ).rejects.toThrow('UNIQUE constraint failed');
    });

    it('throws when updating a missing deployment', async () => {
      await expect(
        harness.storage('updateDeployment', 'missing-client', 'missing-deployment', {
          name: 'Updated',
        }),
      ).rejects.toThrow('Deployment not found');
    });
  });

  describe('session operations', () => {
    it('stores and retrieves active sessions', async () => {
      await harness.storage('addSession', testSession);

      await expect(harness.storage('getSession', testSession.id)).resolves.toMatchObject({
        id: testSession.id,
        user: testSession.user,
      });
    });

    it('does not retrieve expired sessions', async () => {
      await harness.sql(
        'run',
        'INSERT INTO lti_tool_sessions (id, data, expires_at) VALUES (?, ?, ?)',
        ['expired-session', JSON.stringify({ user: { id: 'expired-user' } }), pastIso()],
      );

      await expect(harness.storage('getSession', 'expired-session')).resolves.toBeNull();
    });
  });

  describe('nonce validation', () => {
    it('returns true once for an unexpired nonce and false on replay', async () => {
      await harness.storage('storeNonce', 'nonce-id', futureIso());

      await expect(harness.storage('validateNonce', 'nonce-id')).resolves.toBe(true);
      await expect(harness.storage('validateNonce', 'nonce-id')).resolves.toBe(false);
    });

    it('returns false for expired nonces', async () => {
      await harness.storage('storeNonce', 'expired-nonce', pastIso());

      await expect(harness.storage('validateNonce', 'expired-nonce')).resolves.toBe(
        false,
      );
    });
  });

  describe('launch config', () => {
    it('falls back to default deployment when the requested platform deployment is missing', async () => {
      const clientInternalId = await harness.storage<string>('addClient', testClient);
      await harness.storage('addDeployment', clientInternalId, {
        deploymentId: 'default',
      });

      await expect(
        harness.storage(
          'getLaunchConfig',
          testClient.iss,
          testClient.clientId,
          'missing-deployment',
        ),
      ).resolves.toMatchObject({
        deploymentId: 'default',
      });
    });

    it('returns undefined when neither requested nor default deployment exists', async () => {
      await harness.storage('addClient', testClient);

      await expect(
        harness.storage(
          'getLaunchConfig',
          testClient.iss,
          testClient.clientId,
          'missing-deployment',
        ),
      ).resolves.toBeNull();
    });
  });

  describe('registration sessions', () => {
    it('stores, retrieves, and deletes active registration sessions', async () => {
      const session: LTIDynamicRegistrationSession = {
        openIdConfiguration: {
          issuer: testClient.iss,
          authorization_endpoint: testClient.authUrl,
          registration_endpoint: 'https://platform.example.com/register',
          jwks_uri: testClient.jwksUrl,
          token_endpoint: testClient.tokenUrl,
          token_endpoint_auth_methods_supported: ['private_key_jwt'],
          token_endpoint_auth_signing_alg_values_supported: ['RS256'],
          scopes_supported: [],
          response_types_supported: ['id_token'],
          id_token_signing_alg_values_supported: ['RS256'],
          claims_supported: ['sub'],
          subject_types_supported: ['public'],
          'https://purl.imsglobal.org/spec/lti-platform-configuration': {
            product_family_code: 'test',
            version: '1',
            messages_supported: [{ type: 'LtiResourceLinkRequest' }],
          },
        },
        registrationToken: 'registration-token',
        expiresAt: Date.now() + 60_000,
      };

      await harness.storage('setRegistrationSession', 'registration-session-id', session);
      await expect(
        harness.storage('getRegistrationSession', 'registration-session-id'),
      ).resolves.toEqual(session);

      await harness.storage('deleteRegistrationSession', 'registration-session-id');
      await expect(
        harness.storage('getRegistrationSession', 'registration-session-id'),
      ).resolves.toBeNull();
    });

    it('does not retrieve expired registration sessions', async () => {
      await harness.sql(
        'run',
        'INSERT INTO lti_tool_registration_sessions (id, data, expires_at) VALUES (?, ?, ?)',
        ['expired-registration-session', JSON.stringify({ state: 'expired' }), pastIso()],
      );

      await expect(
        harness.storage('getRegistrationSession', 'expired-registration-session'),
      ).resolves.toBeNull();
    });
  });

  describe('cleanup', () => {
    it('deletes expired nonces, sessions, and registration sessions', async () => {
      await harness.sql(
        'run',
        'INSERT INTO lti_tool_nonces (nonce, expires_at, used_at) VALUES (?, ?, NULL), (?, ?, NULL)',
        ['expired-nonce', pastIso(), 'active-nonce', futureIso()],
      );
      await harness.sql(
        'run',
        'INSERT INTO lti_tool_sessions (id, data, expires_at) VALUES (?, ?, ?), (?, ?, ?)',
        ['expired-session', '{}', pastIso(), 'active-session', '{}', futureIso()],
      );
      await harness.sql(
        'run',
        'INSERT INTO lti_tool_registration_sessions (id, data, expires_at) VALUES (?, ?, ?), (?, ?, ?)',
        [
          'expired-registration',
          '{}',
          pastIso(),
          'active-registration',
          '{}',
          futureIso(),
        ],
      );

      await expect(harness.storage('cleanup')).resolves.toEqual({
        noncesDeleted: 1,
        sessionsDeleted: 1,
        registrationSessionsDeleted: 1,
      });
      await expect(
        harness.sql('first', 'SELECT COUNT(*) AS count FROM lti_tool_nonces'),
      ).resolves.toEqual({ count: 1 });
      await expect(
        harness.sql('first', 'SELECT COUNT(*) AS count FROM lti_tool_sessions'),
      ).resolves.toEqual({ count: 1 });
      await expect(
        harness.sql(
          'first',
          'SELECT COUNT(*) AS count FROM lti_tool_registration_sessions',
        ),
      ).resolves.toEqual({ count: 1 });
    });
  });
});

class D1StorageHarness {
  private constructor(
    private mf: Miniflare,
    private tempDirectory: string,
  ) {}

  static async create(): Promise<D1StorageHarness> {
    const tempDirectory = await mkdtemp(join(packageRoot, '.d1-storage-test-'));
    const source = await readFile(resolve(packageRoot, 'src/d1Storage.ts'), 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;

    await writeFile(join(tempDirectory, 'd1Storage.js'), transpiled);
    await writeFile(join(tempDirectory, 'worker.mjs'), workerSource());

    const mf = new Miniflare({
      modules: true,
      modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }],
      scriptPath: join(tempDirectory, 'worker.mjs'),
      compatibilityDate: '2026-05-07',
      d1Databases: { DB: 'test-db' },
      log: new Log(LogLevel.WARN),
    });
    const harness = new D1StorageHarness(mf, tempDirectory);
    try {
      await harness.applySchema();
      return harness;
    } catch (error) {
      await harness.dispose();
      throw error;
    }
  }

  storage<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
    return this.request<T>({ kind: 'storage', method, args });
  }

  sql<T = unknown>(
    mode: 'exec' | 'first' | 'run',
    sql: string,
    params: unknown[] = [],
  ): Promise<T> {
    return this.request<T>({ kind: 'sql', mode, sql, params });
  }

  async dispose(): Promise<void> {
    await this.mf.dispose();
    await rm(this.tempDirectory, { force: true, recursive: true });
  }

  private async applySchema(): Promise<void> {
    const schema = await readFile(resolve(packageRoot, 'schema.sql'), 'utf8');
    const statements = schema
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await this.sql('run', statement);
    }
  }

  private async request<T>(body: Record<string, unknown>): Promise<T> {
    const response = await this.mf.dispatchFetch('http://d1-storage.test/query', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const responseBody = (await response.json()) as { result?: T; error?: string };
    if (!response.ok) {
      throw new Error(responseBody.error ?? 'Miniflare D1 request failed');
    }
    return responseBody.result as T;
  }
}

function workerSource(): string {
  return `import { D1Storage } from './d1Storage.js';

export default {
  async fetch(request, env) {
    const body = await request.json();

    try {
      if (body.kind === 'sql') {
        const result = await executeSql(env.DB, body);
        return json({ result });
      }

      const storage = new D1Storage({ database: env.DB });
      const args = reviveArgs(body.args ?? []);
      const result = await storage[body.method](...args);
      return json({ result: result ?? null });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : String(error) },
        500,
      );
    }
  },
};

async function executeSql(database, body) {
  if (body.mode === 'exec') {
    return database.exec(body.sql);
  }

  const statement = database.prepare(body.sql).bind(...(body.params ?? []));
  if (body.mode === 'first') {
    return statement.first();
  }
  if (body.mode === 'run') {
    return statement.run();
  }

  throw new Error('Unsupported SQL mode');
}

function reviveArgs(args) {
  return args.map((arg) => {
    if (
      typeof arg === 'string' &&
      /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(arg)
    ) {
      return new Date(arg);
    }
    return arg;
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
`;
}

function futureIso(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

function pastIso(): string {
  return new Date(Date.now() - 60_000).toISOString();
}
