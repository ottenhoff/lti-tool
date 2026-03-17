import type {
  LTIClient,
  LTIDeployment,
  LTIDynamicRegistrationSession,
  LTILaunchConfig,
  LTISession,
  LTIStorage,
} from '@lti-tool/core';
import type { Logger } from 'pino';

import {
  LAUNCH_CONFIG_CACHE,
  SESSION_CACHE,
  SESSION_CACHE_TTL_MS,
  undefinedLaunchConfigValue,
  undefinedSessionValue,
} from './cacheConfig.js';
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1RunResultLike,
} from './interfaces/d1Database.js';
import type { D1StorageConfig } from './interfaces/d1StorageConfig.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  iss TEXT NOT NULL,
  clientId TEXT NOT NULL,
  authUrl TEXT NOT NULL,
  tokenUrl TEXT NOT NULL,
  jwksUrl TEXT NOT NULL,
  UNIQUE(iss, clientId)
);

CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY NOT NULL,
  clientId TEXT NOT NULL,
  deploymentId TEXT NOT NULL,
  name TEXT,
  description TEXT,
  UNIQUE(clientId, deploymentId)
);

CREATE INDEX IF NOT EXISTS idx_clients_iss_client_id ON clients(iss, clientId);
CREATE INDEX IF NOT EXISTS idx_deployments_client_id ON deployments(clientId);
CREATE INDEX IF NOT EXISTS idx_deployments_deployment_id ON deployments(deploymentId);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  expiresAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expiresAt);

CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY NOT NULL,
  expiresAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expiresAt);

CREATE TABLE IF NOT EXISTS registrationSessions (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  expiresAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires_at
  ON registrationSessions(expiresAt);
`;

type ClientRow = Omit<LTIClient, 'deployments'>;

type DeploymentRow = {
  id: string;
  clientId: string;
  deploymentId: string;
  name: string | null;
  description: string | null;
};

type SessionRow = {
  id: string;
  data: string;
  expiresAt: number;
};

type RegistrationSessionRow = {
  id: string;
  data: string;
  expiresAt: number;
};

type LaunchConfigRow = {
  iss: string;
  clientId: string;
  deploymentId: string;
  authUrl: string;
  tokenUrl: string;
  jwksUrl: string;
};

/**
 * Cloudflare D1 implementation of the LTI storage interface.
 *
 * Uses straightforward SQL over the D1 binding API and derives launch configs
 * from client + deployment records instead of duplicating them in a separate table.
 */
export class D1Storage implements LTIStorage {
  private logger: Logger;
  private database: D1DatabaseLike;
  private nonceExpirationSeconds: number;
  private initializationPromise?: Promise<void>;

  constructor(config: D1StorageConfig) {
    this.logger =
      config?.logger ??
      ({
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      } as unknown as Logger);
    this.database = config.database;
    this.nonceExpirationSeconds = config.nonceExpirationSeconds ?? 600;
  }

  private async ensureInitialized(): Promise<void> {
    this.initializationPromise ??= this.initialize();
    await this.initializationPromise;
  }

  private async initialize(): Promise<void> {
    await this.database.exec(SCHEMA_SQL);
  }

  private prepare(query: string, values: unknown[]): D1PreparedStatementLike {
    const statement = this.database.prepare(query);
    return values.length > 0 ? statement.bind(...values) : statement;
  }

  private async run(query: string, ...values: unknown[]): Promise<D1RunResultLike> {
    return this.prepare(query, values).run();
  }

  private async getFirst<T>(query: string, ...values: unknown[]): Promise<T | undefined> {
    const result = await this.prepare(query, values).first<T>();
    return result ?? undefined;
  }

  private async getAll<T>(query: string, ...values: unknown[]): Promise<T[]> {
    const result = await this.prepare(query, values).all<T>();
    return result.results ?? [];
  }

  private mapDeployment(row: DeploymentRow): LTIDeployment {
    return {
      id: row.id,
      deploymentId: row.deploymentId,
      name: row.name ?? undefined,
      description: row.description ?? undefined,
    };
  }

  private clearLaunchConfigCache(
    iss: string,
    clientId: string,
    deploymentId: string,
  ): void {
    LAUNCH_CONFIG_CACHE.delete(`${iss}#${clientId}#${deploymentId}`);
  }

  private clearClientLaunchConfigCache(client: {
    iss: string;
    clientId: string;
    deployments: LTIDeployment[];
  }): void {
    for (const deployment of client.deployments) {
      this.clearLaunchConfigCache(client.iss, client.clientId, deployment.deploymentId);
    }
  }

  private cacheSession(session: LTISession, expiresAtEpochMs: number): void {
    const ttl = Math.max(
      0,
      Math.min(SESSION_CACHE_TTL_MS, expiresAtEpochMs - Date.now()),
    );

    if (ttl <= 0) {
      SESSION_CACHE.delete(session.id);
      return;
    }

    SESSION_CACHE.set(session.id, session, { ttl });
  }

  async listClients(): Promise<Omit<LTIClient, 'deployments'>[]> {
    await this.ensureInitialized();
    this.logger.debug('listing all clients');

    return this.getAll<ClientRow>(
      `SELECT id, name, iss, clientId, authUrl, tokenUrl, jwksUrl
       FROM clients
       ORDER BY name ASC`,
    );
  }

  async getClientById(clientId: string): Promise<LTIClient | undefined> {
    await this.ensureInitialized();
    this.logger.debug({ clientId }, 'getting client by id');

    const client = await this.getFirst<ClientRow>(
      `SELECT id, name, iss, clientId, authUrl, tokenUrl, jwksUrl
       FROM clients
       WHERE id = ?
       LIMIT 1`,
      clientId,
    );

    if (!client) {
      this.logger.warn({ clientId }, 'client not found');
      return undefined;
    }

    const deployments = await this.listDeployments(clientId);
    return {
      ...client,
      deployments,
    };
  }

  async addClient(client: Omit<LTIClient, 'id' | 'deployments'>): Promise<string> {
    await this.ensureInitialized();
    const clientId = crypto.randomUUID();
    this.logger.info({ clientId, client }, 'adding client');

    await this.run(
      `INSERT INTO clients (id, name, iss, clientId, authUrl, tokenUrl, jwksUrl)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      clientId,
      client.name,
      client.iss,
      client.clientId,
      client.authUrl,
      client.tokenUrl,
      client.jwksUrl,
    );

    return clientId;
  }

  async updateClient(
    clientId: string,
    client: Partial<Omit<LTIClient, 'id' | 'deployments'>>,
  ): Promise<void> {
    await this.ensureInitialized();
    this.logger.info({ clientId, client }, 'updating client');

    const existing = await this.getClientById(clientId);
    if (!existing) {
      throw new Error('Client not found');
    }

    const updatedClient = {
      ...existing,
      ...client,
    };

    this.clearClientLaunchConfigCache(existing);

    await this.run(
      `UPDATE clients
       SET name = ?, iss = ?, clientId = ?, authUrl = ?, tokenUrl = ?, jwksUrl = ?
       WHERE id = ?`,
      updatedClient.name,
      updatedClient.iss,
      updatedClient.clientId,
      updatedClient.authUrl,
      updatedClient.tokenUrl,
      updatedClient.jwksUrl,
      clientId,
    );

    this.clearClientLaunchConfigCache(updatedClient);
  }

  async deleteClient(clientId: string): Promise<void> {
    await this.ensureInitialized();
    this.logger.info({ clientId }, 'deleting client');

    const existing = await this.getClientById(clientId);
    if (!existing) {
      this.logger.warn({ clientId }, 'client not found for deletion');
      return;
    }

    this.clearClientLaunchConfigCache(existing);

    await this.run(`DELETE FROM deployments WHERE clientId = ?`, clientId);
    await this.run(`DELETE FROM clients WHERE id = ?`, clientId);
  }

  async listDeployments(clientId: string): Promise<LTIDeployment[]> {
    await this.ensureInitialized();
    this.logger.debug({ clientId }, 'listing deployments for client');

    const deployments = await this.getAll<DeploymentRow>(
      `SELECT id, clientId, deploymentId, name, description
       FROM deployments
       WHERE clientId = ?
       ORDER BY deploymentId ASC`,
      clientId,
    );

    return deployments.map((deployment) => this.mapDeployment(deployment));
  }

  async getDeployment(
    clientId: string,
    deploymentId: string,
  ): Promise<LTIDeployment | undefined> {
    await this.ensureInitialized();
    this.logger.debug({ clientId, deploymentId }, 'getting deployment by id');

    const deployment = await this.getFirst<DeploymentRow>(
      `SELECT id, clientId, deploymentId, name, description
       FROM deployments
       WHERE clientId = ? AND id = ?
       LIMIT 1`,
      clientId,
      deploymentId,
    );

    return deployment ? this.mapDeployment(deployment) : undefined;
  }

  async addDeployment(
    clientId: string,
    deployment: Omit<LTIDeployment, 'id'>,
  ): Promise<string> {
    await this.ensureInitialized();
    const deploymentInternalId = crypto.randomUUID();
    this.logger.info({ clientId, deployment }, 'adding deployment');

    await this.run(
      `INSERT INTO deployments (id, clientId, deploymentId, name, description)
       VALUES (?, ?, ?, ?, ?)`,
      deploymentInternalId,
      clientId,
      deployment.deploymentId,
      deployment.name ?? null,
      deployment.description ?? null,
    );

    return deploymentInternalId;
  }

  async updateDeployment(
    clientId: string,
    deploymentId: string,
    deployment: Partial<LTIDeployment>,
  ): Promise<void> {
    await this.ensureInitialized();
    this.logger.info({ clientId, deploymentId, deployment }, 'updating deployment');

    const existing = await this.getDeployment(clientId, deploymentId);
    if (!existing) {
      throw new Error('Deployment not found');
    }

    const updatedDeployment = {
      ...existing,
      ...deployment,
      id: existing.id,
    };

    const client = await this.getClientById(clientId);
    if (client) {
      this.clearLaunchConfigCache(client.iss, client.clientId, existing.deploymentId);
      this.clearLaunchConfigCache(
        client.iss,
        client.clientId,
        updatedDeployment.deploymentId,
      );
    }

    await this.run(
      `UPDATE deployments
       SET deploymentId = ?, name = ?, description = ?
       WHERE id = ? AND clientId = ?`,
      updatedDeployment.deploymentId,
      updatedDeployment.name ?? null,
      updatedDeployment.description ?? null,
      deploymentId,
      clientId,
    );
  }

  async deleteDeployment(clientId: string, deploymentId: string): Promise<void> {
    await this.ensureInitialized();
    this.logger.info({ clientId, deploymentId }, 'deleting deployment');

    const existing = await this.getDeployment(clientId, deploymentId);
    if (!existing) {
      this.logger.warn({ clientId, deploymentId }, 'deployment not found for deletion');
      return;
    }

    const client = await this.getClientById(clientId);
    if (client) {
      this.clearLaunchConfigCache(client.iss, client.clientId, existing.deploymentId);
    }

    await this.run(
      `DELETE FROM deployments
       WHERE clientId = ? AND id = ?`,
      clientId,
      deploymentId,
    );
  }

  async storeNonce(nonce: string, expiresAt: Date): Promise<void> {
    this.logger.trace({ nonce, expiresAt }, 'nonce will be validated on use');
  }

  async validateNonce(nonce: string): Promise<boolean> {
    await this.ensureInitialized();
    this.logger.debug({ nonce }, 'validating nonce');

    const now = Date.now();
    const expiresAt = now + this.nonceExpirationSeconds * 1000;
    const result = await this.run(
      `INSERT INTO nonces (nonce, expiresAt)
       VALUES (?, ?)
       ON CONFLICT(nonce) DO UPDATE SET expiresAt = excluded.expiresAt
       WHERE nonces.expiresAt <= ?`,
      nonce,
      expiresAt,
      now,
    );

    const changes = result.meta?.changes ?? 0;
    if (changes === 0) {
      this.logger.warn({ nonce }, 'nonce already used - replay attack detected');
      return false;
    }

    return true;
  }

  async getSession(sessionId: string): Promise<LTISession | undefined> {
    await this.ensureInitialized();
    this.logger.debug({ sessionId }, 'getting session');

    const cachedSession = SESSION_CACHE.get(sessionId);
    if (cachedSession === undefinedSessionValue) {
      return undefined;
    }
    if (cachedSession) {
      return cachedSession;
    }

    const sessionRecord = await this.getFirst<SessionRow>(
      `SELECT id, data, expiresAt
       FROM sessions
       WHERE id = ? AND expiresAt > ?
       LIMIT 1`,
      sessionId,
      Date.now(),
    );

    if (!sessionRecord) {
      SESSION_CACHE.set(sessionId, undefinedSessionValue);
      return undefined;
    }

    const sessionData = JSON.parse(sessionRecord.data) as Omit<LTISession, 'id'>;
    const session: LTISession = {
      id: sessionRecord.id,
      ...sessionData,
    };

    this.cacheSession(session, sessionRecord.expiresAt);
    return session;
  }

  async addSession(session: LTISession, expiresAt: Date): Promise<string> {
    await this.ensureInitialized();
    this.logger.debug({ sessionId: session.id }, 'adding session');

    const { id, ...data } = session;
    const expiresAtEpochMs = expiresAt.getTime();

    await this.run(
      `INSERT INTO sessions (id, data, expiresAt)
       VALUES (?, ?, ?)`,
      id,
      JSON.stringify(data),
      expiresAtEpochMs,
    );

    this.cacheSession(session, expiresAtEpochMs);
    return id;
  }

  async getLaunchConfig(
    iss: string,
    clientId: string,
    deploymentId: string,
  ): Promise<LTILaunchConfig | undefined> {
    await this.ensureInitialized();
    this.logger.debug({ iss, clientId, deploymentId }, 'getting launch config');

    const cacheKey = `${iss}#${clientId}#${deploymentId}`;
    const cachedConfig = LAUNCH_CONFIG_CACHE.get(cacheKey);
    if (cachedConfig === undefinedLaunchConfigValue) {
      return undefined;
    }
    if (cachedConfig) {
      return cachedConfig;
    }

    const launchConfig = await this.getFirst<LaunchConfigRow>(
      `SELECT clients.iss AS iss,
              clients.clientId AS clientId,
              deployments.deploymentId AS deploymentId,
              clients.authUrl AS authUrl,
              clients.tokenUrl AS tokenUrl,
              clients.jwksUrl AS jwksUrl
       FROM clients
       INNER JOIN deployments ON deployments.clientId = clients.id
       WHERE clients.iss = ?
         AND clients.clientId = ?
         AND deployments.deploymentId = ?
       LIMIT 1`,
      iss,
      clientId,
      deploymentId,
    );

    if (!launchConfig) {
      if (deploymentId !== 'default') {
        return this.getLaunchConfig(iss, clientId, 'default');
      }

      LAUNCH_CONFIG_CACHE.set(cacheKey, undefinedLaunchConfigValue);
      return undefined;
    }

    LAUNCH_CONFIG_CACHE.set(cacheKey, launchConfig);
    return launchConfig;
  }

  async saveLaunchConfig(launchConfig: LTILaunchConfig): Promise<void> {
    this.logger.debug({ launchConfig }, 'launch config would be saved (no-op in D1)');
  }

  async setRegistrationSession(
    sessionId: string,
    session: LTIDynamicRegistrationSession,
  ): Promise<void> {
    await this.ensureInitialized();
    this.logger.debug({ sessionId }, 'setting registration session');

    await this.run(
      `INSERT OR REPLACE INTO registrationSessions (id, data, expiresAt)
       VALUES (?, ?, ?)`,
      sessionId,
      JSON.stringify(session),
      session.expiresAt,
    );
  }

  async getRegistrationSession(
    sessionId: string,
  ): Promise<LTIDynamicRegistrationSession | undefined> {
    await this.ensureInitialized();
    this.logger.debug({ sessionId }, 'getting registration session');

    const record = await this.getFirst<RegistrationSessionRow>(
      `SELECT id, data, expiresAt
       FROM registrationSessions
       WHERE id = ? AND expiresAt > ?
       LIMIT 1`,
      sessionId,
      Date.now(),
    );

    if (!record) {
      return undefined;
    }

    return JSON.parse(record.data) as LTIDynamicRegistrationSession;
  }

  async deleteRegistrationSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    this.logger.debug({ sessionId }, 'deleting registration session');

    await this.run(
      `DELETE FROM registrationSessions
       WHERE id = ?`,
      sessionId,
    );
  }
}
