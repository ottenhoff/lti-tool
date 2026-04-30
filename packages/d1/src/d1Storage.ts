import type {
  LTIClient,
  LTIDeployment,
  LTIDynamicRegistrationSession,
  LTILaunchConfig,
  LTISession,
  LTIStorage,
} from '@lti-tool/core';
import type { Logger } from 'pino';

import type { D1Database, D1StorageConfig } from './interfaces/d1StorageConfig.js';

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

interface SessionRow {
  id: string;
  data: string;
  expires_at: string;
}

interface RegistrationSessionRow {
  id: string;
  data: string;
  expires_at: string;
}

/**
 * Cloudflare D1 implementation of LTI storage interface.
 *
 * The adapter intentionally uses raw D1 statements to keep the Cloudflare
 * dependency surface small. Apply `schema.sql` before constructing this class.
 */
export class D1Storage implements LTIStorage {
  private database: D1Database;
  private logger: Logger;

  constructor(config: D1StorageConfig) {
    this.database = config.database;
    this.logger =
      config.logger ??
      ({
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      } as unknown as Logger);
  }

  async listClients(): Promise<Omit<LTIClient, 'deployments'>[]> {
    this.logger.debug('listing all clients');

    const rows = await this.database
      .prepare(
        'SELECT id, name, iss, client_id, auth_url, token_url, jwks_url FROM lti_tool_clients ORDER BY name, id',
      )
      .all<ClientRow>();

    return rows.results.map(mapClientRow);
  }

  async getClientById(clientId: string): Promise<LTIClient | undefined> {
    this.logger.debug({ clientId }, 'getting client by id');

    const row = await this.database
      .prepare(
        'SELECT id, name, iss, client_id, auth_url, token_url, jwks_url FROM lti_tool_clients WHERE id = ?',
      )
      .bind(clientId)
      .first<ClientRow>();

    if (!row) {
      this.logger.warn({ clientId }, 'client not found');
      return undefined;
    }

    return {
      ...mapClientRow(row),
      deployments: await this.listDeployments(clientId),
    };
  }

  async addClient(client: Omit<LTIClient, 'id' | 'deployments'>): Promise<string> {
    const clientId = crypto.randomUUID();
    this.logger.info({ clientId, client }, 'adding client');

    await this.database
      .prepare(
        'INSERT INTO lti_tool_clients (id, name, iss, client_id, auth_url, token_url, jwks_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        clientId,
        client.name,
        client.iss,
        client.clientId,
        client.authUrl,
        client.tokenUrl,
        client.jwksUrl,
      )
      .run();

    return clientId;
  }

  async updateClient(
    clientId: string,
    client: Partial<Omit<LTIClient, 'id' | 'deployments'>>,
  ): Promise<void> {
    this.logger.info({ clientId, client }, 'updating client');

    const existing = await this.getClientById(clientId);
    if (!existing) throw new Error('Client not found');

    const updated = {
      ...existing,
      ...client,
    };

    await this.database
      .prepare(
        'UPDATE lti_tool_clients SET name = ?, iss = ?, client_id = ?, auth_url = ?, token_url = ?, jwks_url = ? WHERE id = ?',
      )
      .bind(
        updated.name,
        updated.iss,
        updated.clientId,
        updated.authUrl,
        updated.tokenUrl,
        updated.jwksUrl,
        clientId,
      )
      .run();
  }

  async deleteClient(clientId: string): Promise<void> {
    this.logger.info({ clientId }, 'deleting client');

    if (this.database.batch) {
      await this.database.batch([
        this.database
          .prepare('DELETE FROM lti_tool_deployments WHERE client_id = ?')
          .bind(clientId),
        this.database.prepare('DELETE FROM lti_tool_clients WHERE id = ?').bind(clientId),
      ]);
      return;
    }

    await this.database
      .prepare('DELETE FROM lti_tool_deployments WHERE client_id = ?')
      .bind(clientId)
      .run();
    await this.database
      .prepare('DELETE FROM lti_tool_clients WHERE id = ?')
      .bind(clientId)
      .run();
  }

  async listDeployments(clientId: string): Promise<LTIDeployment[]> {
    this.logger.debug({ clientId }, 'listing deployments for client');

    const rows = await this.database
      .prepare(
        'SELECT id, deployment_id, name, description, client_id FROM lti_tool_deployments WHERE client_id = ? ORDER BY deployment_id, id',
      )
      .bind(clientId)
      .all<DeploymentRow>();

    return rows.results.map(mapDeploymentRow);
  }

  async getDeployment(
    clientId: string,
    deploymentId: string,
  ): Promise<LTIDeployment | undefined> {
    this.logger.debug({ clientId, deploymentId }, 'getting deployment by id');

    const row = await this.database
      .prepare(
        'SELECT id, deployment_id, name, description, client_id FROM lti_tool_deployments WHERE client_id = ? AND id = ?',
      )
      .bind(clientId, deploymentId)
      .first<DeploymentRow>();

    return row ? mapDeploymentRow(row) : undefined;
  }

  async addDeployment(
    clientId: string,
    deployment: Omit<LTIDeployment, 'id'>,
  ): Promise<string> {
    const deploymentInternalId = crypto.randomUUID();
    this.logger.info({ clientId, deploymentInternalId, deployment }, 'adding deployment');

    await this.database
      .prepare(
        'INSERT INTO lti_tool_deployments (id, client_id, deployment_id, name, description) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        deploymentInternalId,
        clientId,
        deployment.deploymentId,
        deployment.name ?? null,
        deployment.description ?? null,
      )
      .run();

    return deploymentInternalId;
  }

  async updateDeployment(
    clientId: string,
    deploymentId: string,
    deployment: Partial<LTIDeployment>,
  ): Promise<void> {
    this.logger.info({ clientId, deploymentId, deployment }, 'updating deployment');

    const existing = await this.getDeployment(clientId, deploymentId);
    if (!existing) throw new Error('Deployment not found');

    const updated = {
      ...existing,
      ...deployment,
    };

    await this.database
      .prepare(
        'UPDATE lti_tool_deployments SET deployment_id = ?, name = ?, description = ? WHERE client_id = ? AND id = ?',
      )
      .bind(
        updated.deploymentId,
        updated.name ?? null,
        updated.description ?? null,
        clientId,
        deploymentId,
      )
      .run();
  }

  async deleteDeployment(clientId: string, deploymentId: string): Promise<void> {
    this.logger.info({ clientId, deploymentId }, 'deleting deployment');

    await this.database
      .prepare('DELETE FROM lti_tool_deployments WHERE client_id = ? AND id = ?')
      .bind(clientId, deploymentId)
      .run();
  }

  async getSession(sessionId: string): Promise<LTISession | undefined> {
    this.logger.debug({ sessionId }, 'getting session');

    const row = await this.database
      .prepare(
        'SELECT id, data, expires_at FROM lti_tool_sessions WHERE id = ? AND expires_at > ?',
      )
      .bind(sessionId, new Date().toISOString())
      .first<SessionRow>();

    if (!row) return undefined;

    return {
      id: row.id,
      ...JSON.parse(row.data),
    } as LTISession;
  }

  async addSession(session: LTISession): Promise<string> {
    this.logger.debug({ sessionId: session.id }, 'adding session');

    const { id, ...data } = session;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await this.database
      .prepare('INSERT INTO lti_tool_sessions (id, data, expires_at) VALUES (?, ?, ?)')
      .bind(id, JSON.stringify(data), expiresAt)
      .run();

    return id;
  }

  async storeNonce(nonce: string, expiresAt: Date): Promise<void> {
    this.logger.debug({ nonce, expiresAt }, 'storing nonce');

    await this.database
      .prepare(
        'INSERT OR REPLACE INTO lti_tool_nonces (nonce, expires_at, used_at) VALUES (?, ?, NULL)',
      )
      .bind(nonce, expiresAt.toISOString())
      .run();
  }

  async validateNonce(nonce: string): Promise<boolean> {
    this.logger.debug({ nonce }, 'validating nonce');

    const result = await this.database
      .prepare(
        'UPDATE lti_tool_nonces SET used_at = ? WHERE nonce = ? AND used_at IS NULL AND expires_at > ?',
      )
      .bind(new Date().toISOString(), nonce, new Date().toISOString())
      .run();

    return (result.meta?.changes ?? 0) === 1;
  }

  async getLaunchConfig(
    iss: string,
    clientId: string,
    deploymentId: string,
  ): Promise<LTILaunchConfig | undefined> {
    this.logger.debug({ iss, clientId, deploymentId }, 'getting launch config');

    const row = await this.readLaunchConfigRow(iss, clientId, deploymentId);
    if (row) return row;

    if (deploymentId !== 'default') {
      return this.getLaunchConfig(iss, clientId, 'default');
    }

    this.logger.warn({ iss, clientId, deploymentId }, 'launch config not found');
    return undefined;
  }

  // oxlint-disable-next-line require-await no-unused-vars
  async saveLaunchConfig(launchConfig: LTILaunchConfig): Promise<void> {
    this.logger.debug({ launchConfig }, 'launch config derived from clients/deployments');
  }

  async setRegistrationSession(
    sessionId: string,
    session: LTIDynamicRegistrationSession,
  ): Promise<void> {
    this.logger.debug({ sessionId }, 'setting registration session');

    await this.database
      .prepare(
        'INSERT OR REPLACE INTO lti_tool_registration_sessions (id, data, expires_at) VALUES (?, ?, ?)',
      )
      .bind(sessionId, JSON.stringify(session), new Date(session.expiresAt).toISOString())
      .run();
  }

  async getRegistrationSession(
    sessionId: string,
  ): Promise<LTIDynamicRegistrationSession | undefined> {
    this.logger.debug({ sessionId }, 'getting registration session');

    const row = await this.database
      .prepare(
        'SELECT id, data, expires_at FROM lti_tool_registration_sessions WHERE id = ? AND expires_at > ?',
      )
      .bind(sessionId, new Date().toISOString())
      .first<RegistrationSessionRow>();

    return row ? (JSON.parse(row.data) as LTIDynamicRegistrationSession) : undefined;
  }

  async deleteRegistrationSession(sessionId: string): Promise<void> {
    this.logger.debug({ sessionId }, 'deleting registration session');

    await this.database
      .prepare('DELETE FROM lti_tool_registration_sessions WHERE id = ?')
      .bind(sessionId)
      .run();
  }

  async cleanup(): Promise<{
    noncesDeleted: number;
    sessionsDeleted: number;
    registrationSessionsDeleted: number;
  }> {
    this.logger.info('starting cleanup of expired items');

    const now = new Date().toISOString();
    const nonces = await this.database
      .prepare('DELETE FROM lti_tool_nonces WHERE expires_at <= ?')
      .bind(now)
      .run();
    const sessions = await this.database
      .prepare('DELETE FROM lti_tool_sessions WHERE expires_at <= ?')
      .bind(now)
      .run();
    const registrationSessions = await this.database
      .prepare('DELETE FROM lti_tool_registration_sessions WHERE expires_at <= ?')
      .bind(now)
      .run();

    return {
      noncesDeleted: nonces.meta?.changes ?? 0,
      sessionsDeleted: sessions.meta?.changes ?? 0,
      registrationSessionsDeleted: registrationSessions.meta?.changes ?? 0,
    };
  }

  private async readLaunchConfigRow(
    iss: string,
    clientId: string,
    deploymentId: string,
  ): Promise<LTILaunchConfig | undefined> {
    const row = await this.database
      .prepare(
        `SELECT
          clients.iss,
          clients.client_id,
          clients.auth_url,
          clients.token_url,
          clients.jwks_url,
          deployments.deployment_id
        FROM lti_tool_clients clients
        INNER JOIN lti_tool_deployments deployments
          ON deployments.client_id = clients.id
        WHERE clients.iss = ?
          AND clients.client_id = ?
          AND deployments.deployment_id = ?
        LIMIT 1`,
      )
      .bind(iss, clientId, deploymentId)
      .first<{
        iss: string;
        client_id: string;
        auth_url: string;
        token_url: string;
        jwks_url: string;
        deployment_id: string;
      }>();

    return row
      ? {
          iss: row.iss,
          clientId: row.client_id,
          deploymentId: row.deployment_id,
          authUrl: row.auth_url,
          tokenUrl: row.token_url,
          jwksUrl: row.jwks_url,
        }
      : undefined;
  }
}

function mapClientRow(row: ClientRow): Omit<LTIClient, 'deployments'> {
  return {
    id: row.id,
    name: row.name,
    iss: row.iss,
    clientId: row.client_id,
    authUrl: row.auth_url,
    tokenUrl: row.token_url,
    jwksUrl: row.jwks_url,
  };
}

function mapDeploymentRow(row: DeploymentRow): LTIDeployment {
  return {
    id: row.id,
    deploymentId: row.deployment_id,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
  };
}
