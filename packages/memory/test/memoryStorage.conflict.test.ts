import { LtiStorageConflictError } from '@longsightgroup/lti-tool';
import { describe, expect, it } from 'vitest';

import { testClient } from '#test-harness/fixtures';

import { MemoryStorage } from '../src/memoryStorage.js';

describe('MemoryStorage client conflicts', () => {
  it('rejects duplicate issuer and client ID inserts', async () => {
    const storage = new MemoryStorage();
    const client = testClient();

    await storage.addClient(client);

    await expect(storage.addClient(client)).rejects.toBeInstanceOf(
      LtiStorageConflictError,
    );
  });
});
