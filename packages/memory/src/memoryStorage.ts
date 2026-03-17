import type {
  LTIClient,
  LTIDeployment,
  LTIDynamicRegistrationSession,
  LTILaunchConfig,
  LTISession,
  LTIStorage,
} from '@lti-tool/core';
import type { Logger } from 'pino';

import type { MemoryStorageConfig } from './interfaces/memoryStorageConfig.js';

/**
 * In-memory LTI storage implementation.
 *
 * ⚠️  **WARNING: NOT SUITABLE FOR SERVERLESS/MULTI-INSTANCE DEPLOYMENTS**
 *
 * This storage keeps all data in memory and provides no persistence.
 * It's intended for:
 * - Development and testing
 * - Single-instance server deployments
 * - Reference implementation
 *
 * DO NOT use in serverless environments (AWS Lambda, Vercel, etc.) as:
 * - Each instance has isolated memory
 * - Nonce validation becomes unreliable across instances
 * - Security vulnerabilities may arise from replay attacks
 *
 * For production serverless deployments, use DynamoDbStorage or similar.
 */
export class MemoryStorage implements LTIStorage {
  // simple storage maps
  private clients = new Map<string, LTIClient>();
  private deployments = new Map<string, LTIDeployment>();

  // lookup indexes (for lti launch)
  private clientLookup = new Map<string, string>(); // issuer#clientId -> internalClientId

  private sessions = new Map<string, LTISession>();
  private nonces = new Map<string, Date>(); // nonce -> expiration date
  private registrationSessions = new Map<string, LTIDynamicRegistrationSession>();
  private logger: Logger;

  constructor(config?: MemoryStorageConfig) {
    this.logger =
      config?.logger ??
      ({
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      } as unknown as Logger);
  }

  private createClientLookupKey(iss: string, clientId: string): string {
    return `${iss}#${clientId}`;
  }

  private createDeploymentLookupKey(
    iss: string,
    clientId: string,
    deploymentId: string,
  ): string {
    return `${iss}#${clientId}#${deploymentId}`;
  }

  private getClientOrThrow(clientId: string): LTIClient {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    return client;
  }

  getDeploymentById(
    // oxlint-disable-next-line no-unused-vars
    clientId: string, // oxlint-disable no-unused-vars
    deploymentId: string,
  ): Promise<LTIDeployment | undefined> {
    return this.getDeployment(clientId, deploymentId);
  }

  // oxlint-disable-next-line require-await
  async listClients(): Promise<LTIClient[]> {
    return [...this.clients.values()];
  }

  // oxlint-disable-next-line require-await
  async getClientById(clientId: string): Promise<LTIClient | undefined> {
    return this.clients.get(clientId);
  }

  // oxlint-disable-next-line require-await
  async addClient(client: Omit<LTIClient, 'id' | 'deployments'>): Promise<string> {
    const clientId = crypto.randomUUID();
    const clientWithId = { ...client, id: clientId, deployments: [] };

    // store in primary map
    this.logger.info({ clientWithId }, 'adding client');
    this.clients.set(clientId, clientWithId);

    // store in lookup map
    this.clientLookup.set(
      this.createClientLookupKey(client.iss, client.clientId),
      clientId,
    );

    this.logger.debug({ clientCount: this.clients.size }, 'client list count updated');

    return clientId;
  }

  // oxlint-disable-next-line no-unused-vars require-await
  async updateClient(
    clientId: string,
    client: Partial<Omit<LTIClient, 'id' | 'deployments'>>,
  ): Promise<void> {
    const existing = this.getClientOrThrow(clientId);
    const updatedClient = { ...existing, ...client };

    if (
      existing.iss !== updatedClient.iss ||
      existing.clientId !== updatedClient.clientId
    ) {
      this.clientLookup.delete(
        this.createClientLookupKey(existing.iss, existing.clientId),
      );
      this.clientLookup.set(
        this.createClientLookupKey(updatedClient.iss, updatedClient.clientId),
        clientId,
      );

      for (const deployment of existing.deployments) {
        this.deployments.delete(
          this.createDeploymentLookupKey(
            existing.iss,
            existing.clientId,
            deployment.deploymentId,
          ),
        );
        this.deployments.set(
          this.createDeploymentLookupKey(
            updatedClient.iss,
            updatedClient.clientId,
            deployment.deploymentId,
          ),
          deployment,
        );
      }
    }

    this.clients.set(clientId, updatedClient);
    this.logger.debug({ clientId, client }, 'client updated');
  }

  // oxlint-disable-next-line require-await
  async deleteClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (client) {
      // Clean up deployments
      for (const deployment of client.deployments) {
        this.deployments.delete(
          this.createDeploymentLookupKey(
            client.iss,
            client.clientId,
            deployment.deploymentId,
          ),
        );
      }
      // Clean up lookup
      this.clientLookup.delete(this.createClientLookupKey(client.iss, client.clientId));
    }
    this.clients.delete(clientId);
  }

  // oxlint-disable-next-line require-await
  async listDeployments(clientId: string): Promise<LTIDeployment[]> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    return client.deployments;
  }

  // oxlint-disable-next-line require-await
  async getDeployment(
    clientId: string,
    deploymentId: string,
  ): Promise<LTIDeployment | undefined> {
    const client = this.clients.get(clientId);
    if (!client) return undefined;

    return client.deployments.find(
      (existingDeployment) => existingDeployment.id === deploymentId,
    );
  }

  // oxlint-disable-next-line require-await
  async addDeployment(
    clientId: string,
    deployment: Omit<LTIDeployment, 'id'>,
  ): Promise<string> {
    const client = this.getClientOrThrow(clientId);
    const internalDeploymentId = crypto.randomUUID();
    const deploymentWithId = { ...deployment, id: internalDeploymentId };
    client.deployments.push(deploymentWithId);

    // use a composite key so we don't have collisions
    const compositeKey = this.createDeploymentLookupKey(
      client.iss,
      client.clientId,
      deployment.deploymentId,
    );
    this.deployments.set(compositeKey, deploymentWithId);

    return internalDeploymentId;
  }

  // oxlint-disable-next-line require-await
  async updateDeployment(
    clientId: string,
    deploymentId: string,
    deployment: Partial<LTIDeployment>,
  ): Promise<void> {
    const client = this.getClientOrThrow(clientId);
    const deploymentIndex = client.deployments.findIndex(
      (existingDeployment) => existingDeployment.id === deploymentId,
    );

    if (deploymentIndex === -1) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const existingDeployment = client.deployments[deploymentIndex];
    const updatedDeployment = {
      ...existingDeployment,
      ...deployment,
      id: existingDeployment.id,
    };

    this.deployments.delete(
      this.createDeploymentLookupKey(
        client.iss,
        client.clientId,
        existingDeployment.deploymentId,
      ),
    );
    this.deployments.set(
      this.createDeploymentLookupKey(
        client.iss,
        client.clientId,
        updatedDeployment.deploymentId,
      ),
      updatedDeployment,
    );

    client.deployments[deploymentIndex] = updatedDeployment;
    this.logger.debug({ clientId, deploymentId, deployment }, 'deployment updated');
  }

  // oxlint-disable-next-line require-await
  async deleteDeployment(clientId: string, deploymentId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      this.logger.warn({ clientId, deploymentId }, 'deployment not found for deletion');
      return;
    }

    const deploymentIndex = client.deployments.findIndex(
      (existingDeployment) => existingDeployment.id === deploymentId,
    );
    if (deploymentIndex === -1) {
      this.logger.warn({ clientId, deploymentId }, 'deployment not found for deletion');
      return;
    }

    const [existingDeployment] = client.deployments.splice(deploymentIndex, 1);
    this.deployments.delete(
      this.createDeploymentLookupKey(
        client.iss,
        client.clientId,
        existingDeployment.deploymentId,
      ),
    );

    this.logger.debug({ clientId, deploymentId }, 'deployment deleted');
  }

  // oxlint-disable-next-line require-await
  async storeNonce(nonce: string, expiresAt: Date): Promise<void> {
    this.nonces.set(nonce, expiresAt);
    this.logger.debug({ nonce, expiresAt }, 'nonce stored with expiration');
  }

  // oxlint-disable-next-line require-await
  async validateNonce(nonce: string): Promise<boolean> {
    const expiresAt = this.nonces.get(nonce);

    if (!expiresAt) {
      this.logger.warn({ nonce }, 'nonce not found - invalid nonce');
      return false;
    }

    if (expiresAt < new Date()) {
      this.logger.warn({ nonce, expiresAt }, 'nonce expired');
      this.nonces.delete(nonce); // Clean up expired nonce
      return false;
    }

    // Mark as used by deleting it (one-time use)
    this.nonces.delete(nonce);
    this.logger.debug({ nonce }, 'nonce validated and consumed');
    return true;
  }

  // oxlint-disable-next-line require-await
  async getSession(sessionId: string): Promise<LTISession | undefined> {
    this.logger.debug({ sessionId }, 'getting session');
    const session = this.sessions.get(sessionId);

    if (!session) {
      this.logger.warn({ sessionId }, 'session not found');
    }

    return session;
  }

  // oxlint-disable-next-line require-await
  async addSession(session: LTISession): Promise<string> {
    this.logger.debug({ sessionId: session.id }, 'adding session');
    this.sessions.set(session.id, session);
    this.logger.debug({ sessionCount: this.sessions.size }, 'session count');
    return session.id;
  }

  // oxlint-disable-next-line require-await no-unused-vars
  async getLaunchConfig(
    iss: string,
    clientId: string,
    deploymentId: string,
  ): Promise<LTILaunchConfig | undefined> {
    this.logger.debug({ iss, clientId, deploymentId }, 'getting launch config');

    const clientInternalId = this.clientLookup.get(
      this.createClientLookupKey(iss, clientId),
    );

    if (!clientInternalId) {
      this.logger.warn({ clientInternalId }, 'client not found in lookup');
      return undefined;
    }

    const client = this.clients.get(clientInternalId);
    if (!client) {
      this.logger.warn({ clientInternalId }, 'client not found');
      return undefined;
    }

    const deployment = client.deployments.find((d) => d.deploymentId === deploymentId);
    if (!deployment) {
      this.logger.warn({ deploymentId }, 'deployment not found');
      return undefined;
    }

    return {
      iss: client.iss,
      clientId: client.clientId,
      deploymentId: deployment.deploymentId,
      authUrl: client.authUrl,
      jwksUrl: client.jwksUrl,
      tokenUrl: client.tokenUrl,
    };
  }

  // oxlint-disable-next-line require-await no-unused-vars
  async saveLaunchConfig(launchConfig: LTILaunchConfig): Promise<void> {
    // Memory storage doesn't need to persist launch configs separately
    // since they're derived from client data
    this.logger.debug({ launchConfig }, 'launch config would be saved (no-op in memory)');
  }

  // oxlint-disable-next-line require-await
  async setRegistrationSession(
    sessionId: string,
    session: LTIDynamicRegistrationSession,
  ): Promise<void> {
    this.registrationSessions.set(sessionId, session);
    this.logger.debug({ sessionId, session }, 'registration session stored');
  }

  // oxlint-disable-next-line require-await
  async getRegistrationSession(
    sessionId: string,
  ): Promise<LTIDynamicRegistrationSession | undefined> {
    const session = this.registrationSessions.get(sessionId);

    if (!session) {
      this.logger.warn({ sessionId }, 'registration session not found');
      return undefined;
    }

    // check expiration
    if (session.expiresAt < Date.now()) {
      this.logger.warn({ sessionId }, 'registration session expired');
      this.registrationSessions.delete(sessionId);
      return undefined;
    }

    return session;
  }

  // oxlint-disable-next-line require-await
  async deleteRegistrationSession(sessionId: string): Promise<void> {
    this.registrationSessions.delete(sessionId);
  }
}
