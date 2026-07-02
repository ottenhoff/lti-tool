import { createNoopLogger, type LtiLogger } from '@longsightgroup/lti-tool';
import { describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '../src/memoryStorage.js';

describe('MemoryStorage logger config', () => {
  it('accepts a structural LtiLogger', async () => {
    const info = vi.fn();
    const logger: LtiLogger = {
      debug: vi.fn(),
      info,
      warn: vi.fn(),
      error: vi.fn(),
    };
    const storage = new MemoryStorage({ logger });

    await storage.addClient({
      name: 'Test Tool',
      iss: 'https://platform.example.com',
      clientId: 'client-1',
      authUrl: 'https://platform.example.com/auth',
      tokenUrl: 'https://platform.example.com/token',
      jwksUrl: 'https://platform.example.com/jwks',
    });

    expect(info).toHaveBeenCalled();
  });

  it('defaults to a noop logger when omitted', async () => {
    const storage = new MemoryStorage();

    await expect(
      storage.addClient({
        name: 'Test Tool',
        iss: 'https://platform.example.com',
        clientId: 'client-1',
        authUrl: 'https://platform.example.com/auth',
        tokenUrl: 'https://platform.example.com/token',
        jwksUrl: 'https://platform.example.com/jwks',
      }),
    ).resolves.toBeDefined();
    expect(createNoopLogger()).toBeDefined();
  });
});
