import { afterEach, describe, expect, it, vi } from 'vitest';

import { D1Storage } from '../src/index.js';
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from '../src/interfaces/d1StorageConfig.js';

interface ClientRow {
  id: string;
  name: string;
  iss: string;
  client_id: string;
  auth_url: string;
  token_url: string;
  jwks_url: string;
}

interface DeploymentRow {
  id: string;
  deployment_id: string;
  name: string | null;
  description: string | null;
  client_id: string;
}

class FakeD1PreparedStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(
    private query: string,
    private state: {
      clients: ClientRow[];
      deployments: DeploymentRow[];
    },
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  first<T = unknown>(): Promise<T | null> {
    if (this.query.includes('FROM lti_tool_deployments WHERE client_id = ? AND id = ?')) {
      const [clientId, deploymentInternalId] = this.values;
      return Promise.resolve(
        this.state.deployments.find(
          (deployment) =>
            deployment.client_id === clientId && deployment.id === deploymentInternalId,
        ) ?? null,
      ) as Promise<T | null>;
    }

    if (this.query.includes('INNER JOIN lti_tool_deployments deployments')) {
      const [iss, clientId, platformDeploymentId] = this.values;
      const client = this.state.clients.find(
        (candidate) => candidate.iss === iss && candidate.client_id === clientId,
      );
      const deployment = client
        ? this.state.deployments.find(
            (candidate) =>
              candidate.client_id === client.id &&
              candidate.deployment_id === platformDeploymentId,
          )
        : undefined;

      return Promise.resolve(
        deployment && client
          ? ({
              iss: client.iss,
              client_id: client.client_id,
              auth_url: client.auth_url,
              token_url: client.token_url,
              jwks_url: client.jwks_url,
              deployment_id: deployment.deployment_id,
            } as T)
          : null,
      );
    }

    return Promise.resolve(null);
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.resolve({ results: [] });
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    if (this.query.startsWith('INSERT INTO lti_tool_clients')) {
      const [id, name, iss, clientId, authUrl, tokenUrl, jwksUrl] = this.values;
      this.state.clients.push({
        id: id as string,
        name: name as string,
        iss: iss as string,
        client_id: clientId as string,
        auth_url: authUrl as string,
        token_url: tokenUrl as string,
        jwks_url: jwksUrl as string,
      });
    }

    if (this.query.startsWith('INSERT INTO lti_tool_deployments')) {
      const [id, clientId, deploymentId, name, description] = this.values;
      this.state.deployments.push({
        id: id as string,
        client_id: clientId as string,
        deployment_id: deploymentId as string,
        name: name as string | null,
        description: description as string | null,
      });
    }

    return Promise.resolve({ results: [], meta: { changes: 1 } });
  }
}

class FakeD1Database implements D1Database {
  state = {
    clients: new Array<ClientRow>(),
    deployments: new Array<DeploymentRow>(),
  };

  prepare(query: string): D1PreparedStatement {
    return new FakeD1PreparedStatement(query, this.state);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('D1Storage deployment IDs', () => {
  it('uses internal deployment IDs for deployment management and platform deployment IDs for launch config', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('client-internal-id' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce(
        'deployment-internal-id' as ReturnType<typeof crypto.randomUUID>,
      );

    const database = new FakeD1Database();
    const storage = new D1Storage({ database });

    const clientInternalId = await storage.addClient({
      name: 'Platform',
      iss: 'https://platform.example.com',
      clientId: 'oauth-client-id',
      authUrl: 'https://platform.example.com/auth',
      tokenUrl: 'https://platform.example.com/token',
      jwksUrl: 'https://platform.example.com/jwks',
    });
    const deploymentInternalId = await storage.addDeployment(clientInternalId, {
      deploymentId: 'platform-deployment-id',
      name: 'Deployment',
    });

    await expect(
      storage.getDeployment(clientInternalId, deploymentInternalId),
    ).resolves.toMatchObject({
      id: deploymentInternalId,
      deploymentId: 'platform-deployment-id',
    });
    await expect(
      storage.getDeployment(clientInternalId, 'platform-deployment-id'),
    ).resolves.toBeUndefined();

    await expect(
      storage.getLaunchConfig(
        'https://platform.example.com',
        'oauth-client-id',
        'platform-deployment-id',
      ),
    ).resolves.toMatchObject({
      clientId: 'oauth-client-id',
      deploymentId: 'platform-deployment-id',
    });
    await expect(
      storage.getLaunchConfig(
        'https://platform.example.com',
        'oauth-client-id',
        deploymentInternalId,
      ),
    ).resolves.toBeUndefined();
  });
});
