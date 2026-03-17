import type { LTIClient, LTIDeployment } from '@lti-tool/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryStorage } from '../src/index.js';

const testClient: Omit<LTIClient, 'id' | 'deployments'> = {
  name: 'Test Platform',
  iss: 'https://platform.example.com',
  clientId: 'test-client',
  authUrl: 'https://platform.example.com/auth',
  tokenUrl: 'https://platform.example.com/token',
  jwksUrl: 'https://platform.example.com/jwks',
};

const testDeployment: Omit<LTIDeployment, 'id'> = {
  deploymentId: 'deployment-1',
  name: 'Initial Deployment',
  description: 'Initial deployment configuration',
};

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('updates client lookup indexes when issuer or client ID changes', async () => {
    const clientId = await storage.addClient(testClient);
    await storage.addDeployment(clientId, testDeployment);

    await storage.updateClient(clientId, {
      iss: 'https://updated.example.com',
      clientId: 'updated-client',
      name: 'Updated Platform',
    });

    const updatedClient = await storage.getClientById(clientId);
    expect(updatedClient).toEqual(
      expect.objectContaining({
        iss: 'https://updated.example.com',
        clientId: 'updated-client',
        name: 'Updated Platform',
      }),
    );

    const staleLaunchConfig = await storage.getLaunchConfig(
      testClient.iss,
      testClient.clientId,
      testDeployment.deploymentId,
    );
    expect(staleLaunchConfig).toBeUndefined();

    const updatedLaunchConfig = await storage.getLaunchConfig(
      'https://updated.example.com',
      'updated-client',
      testDeployment.deploymentId,
    );
    expect(updatedLaunchConfig).toEqual(
      expect.objectContaining({
        iss: 'https://updated.example.com',
        clientId: 'updated-client',
        deploymentId: testDeployment.deploymentId,
      }),
    );
  });

  it('updates deployment lookup indexes when deployment IDs change', async () => {
    const clientId = await storage.addClient(testClient);
    const deploymentId = await storage.addDeployment(clientId, testDeployment);

    await storage.updateDeployment(clientId, deploymentId, {
      deploymentId: 'deployment-2',
      name: 'Updated Deployment',
    });

    const updatedDeployment = await storage.getDeployment(clientId, deploymentId);
    expect(updatedDeployment).toEqual(
      expect.objectContaining({
        id: deploymentId,
        deploymentId: 'deployment-2',
        name: 'Updated Deployment',
      }),
    );

    const staleLaunchConfig = await storage.getLaunchConfig(
      testClient.iss,
      testClient.clientId,
      testDeployment.deploymentId,
    );
    expect(staleLaunchConfig).toBeUndefined();

    const updatedLaunchConfig = await storage.getLaunchConfig(
      testClient.iss,
      testClient.clientId,
      'deployment-2',
    );
    expect(updatedLaunchConfig).toEqual(
      expect.objectContaining({
        deploymentId: 'deployment-2',
      }),
    );
  });

  it('deletes deployments without leaving stale launch config lookups', async () => {
    const clientId = await storage.addClient(testClient);
    const deploymentId = await storage.addDeployment(clientId, testDeployment);

    await storage.deleteDeployment(clientId, deploymentId);

    expect(await storage.getDeployment(clientId, deploymentId)).toBeUndefined();
    expect(await storage.listDeployments(clientId)).toEqual([]);
    expect(
      await storage.getLaunchConfig(
        testClient.iss,
        testClient.clientId,
        testDeployment.deploymentId,
      ),
    ).toBeUndefined();
  });

  it('deletes clients and their deployment lookups', async () => {
    const clientId = await storage.addClient(testClient);
    await storage.addDeployment(clientId, testDeployment);

    await storage.deleteClient(clientId);

    expect(await storage.getClientById(clientId)).toBeUndefined();
    expect(
      await storage.getLaunchConfig(
        testClient.iss,
        testClient.clientId,
        testDeployment.deploymentId,
      ),
    ).toBeUndefined();
  });
});
