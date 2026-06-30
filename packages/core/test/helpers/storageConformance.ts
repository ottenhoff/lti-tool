import type { LTIClient, LTIStorage } from '@longsightgroup/lti-tool';
import { describe, expect, it } from 'vitest';

type StorageFactory = {
  readonly createStorage: () =>
    | LTIStorage
    | Promise<LTIStorage>
    | { readonly storage: LTIStorage; readonly cleanup: () => Promise<void> }
    | Promise<{ readonly storage: LTIStorage; readonly cleanup: () => Promise<void> }>;
};

const testClient: Omit<LTIClient, 'id' | 'deployments'> = {
  name: 'Test Platform',
  iss: 'https://platform.example.com',
  clientId: 'oauth-client-id',
  authUrl: 'https://platform.example.com/auth',
  tokenUrl: 'https://platform.example.com/token',
  jwksUrl: 'https://platform.example.com/jwks',
};

export function defineStorageConformanceSuite(
  name: string,
  factory: StorageFactory,
): void {
  describe(`${name} storage conformance`, () => {
    it('looks up deployments by platform ID and updates/deletes by internal ID', async () => {
      await withStorage(factory, assertDeploymentIdContract);
    });

    it('atomically rejects nonce replay', async () => {
      await withStorage(factory, assertNonceReplayContract);
    });
  });
}

async function assertDeploymentIdContract(storage: LTIStorage): Promise<void> {
  const clientId = await storage.addClient(testClient);
  const deploymentId = await storage.addDeployment(clientId, {
    deploymentId: 'platform-deployment-id',
    name: 'Original Deployment',
  });

  await expect(
    storage.getDeploymentByPlatformId(clientId, 'platform-deployment-id'),
  ).resolves.toMatchObject({
    id: deploymentId,
    deploymentId: 'platform-deployment-id',
    name: 'Original Deployment',
  });
  await expect(
    storage.getDeploymentByPlatformId(clientId, deploymentId),
  ).resolves.toBeUndefined();

  await storage.updateDeploymentById(clientId, deploymentId, {
    deploymentId: 'updated-platform-deployment-id',
    name: 'Updated Deployment',
  });

  await expect(
    storage.getDeploymentByPlatformId(clientId, 'platform-deployment-id'),
  ).resolves.toBeUndefined();
  await expect(
    storage.getDeploymentByPlatformId(clientId, 'updated-platform-deployment-id'),
  ).resolves.toMatchObject({
    id: deploymentId,
    deploymentId: 'updated-platform-deployment-id',
    name: 'Updated Deployment',
  });

  await storage.deleteDeploymentById(clientId, deploymentId);

  await expect(
    storage.getDeploymentByPlatformId(clientId, 'updated-platform-deployment-id'),
  ).resolves.toBeUndefined();
}

async function assertNonceReplayContract(storage: LTIStorage): Promise<void> {
  await expect(storage.validateNonce('nonce-id')).resolves.toBe(true);
  await expect(storage.validateNonce('nonce-id')).resolves.toBe(false);
}

async function withStorage(
  factory: StorageFactory,
  assertion: (storage: LTIStorage) => Promise<void>,
): Promise<void> {
  const context = await createStorageContext(factory);
  try {
    await assertion(context.storage);
  } finally {
    await context.cleanup();
  }
}

async function createStorageContext(
  factory: StorageFactory,
): Promise<{ readonly storage: LTIStorage; readonly cleanup: () => Promise<void> }> {
  const storageOrContext = await factory.createStorage();

  if ('storage' in storageOrContext) return storageOrContext;

  return {
    storage: storageOrContext,
    cleanup: async () => {},
  };
}
