import { describe, expect, it } from 'vitest';

import { defineStorageConformanceSuite } from '../../core/test/helpers/storageConformance.js';
import { MemoryStorage } from '../src/index.js';

defineStorageConformanceSuite('MemoryStorage', {
  createStorage: () => new MemoryStorage(),
});

describe('MemoryStorage launch config', () => {
  it('uses the platform deployment lookup index', async () => {
    const storage = new MemoryStorage();
    const clientId = await storage.addClient({
      name: 'Test Platform',
      iss: 'https://platform.example.com',
      clientId: 'oauth-client-id',
      authUrl: 'https://platform.example.com/auth',
      tokenUrl: 'https://platform.example.com/token',
      jwksUrl: 'https://platform.example.com/jwks',
    });
    const deploymentId = await storage.addDeployment(clientId, {
      deploymentId: 'old-platform-deployment-id',
    });

    await storage.updateDeploymentById(clientId, deploymentId, {
      deploymentId: 'new-platform-deployment-id',
    });

    await expect(
      storage.getLaunchConfig(
        'https://platform.example.com',
        'oauth-client-id',
        'old-platform-deployment-id',
      ),
    ).resolves.toBeUndefined();
    await expect(
      storage.getLaunchConfig(
        'https://platform.example.com',
        'oauth-client-id',
        'new-platform-deployment-id',
      ),
    ).resolves.toMatchObject({
      iss: 'https://platform.example.com',
      clientId: 'oauth-client-id',
      deploymentId: 'new-platform-deployment-id',
    });
  });
});
