import {
  LtiDynamicRegistration,
  LTITool,
  type LTIConfig,
} from '@longsightgroup/lti-tool';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MemoryStorage } from '../../memory/src/index.js';
import { createLtiOptionalRouteDeps } from '../src/ltiRoutes/createLtiOptionalRouteDeps.js';

describe('createLtiOptionalRouteDeps', () => {
  let keyPair: CryptoKeyPair;
  let config: LTIConfig;

  beforeAll(async () => {
    keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
  });

  beforeEach(() => {
    config = {
      keyPair,
      stateSecret: new TextEncoder().encode('test-state-secret-exactly32bytes'),
      storage: new MemoryStorage(),
    };
  });

  it('binds optional route deps from protocol facades', async () => {
    const ltiTool = new LTITool(config);
    const getDynamicRegistrationAppState = () => ({ tenantId: 'tenant-1' });
    const onRegistrationComplete = () => undefined;
    const deps = createLtiOptionalRouteDeps({
      ltiTool,
      dynamicRegistration: new LtiDynamicRegistration(config),
      getDynamicRegistrationAppState,
      onRegistrationComplete,
    });

    await expect(deps.deepLink.getSession('missing-session')).resolves.toBeUndefined();
    expect(deps.initiateDynamicRegistration.initiateDynamicRegistration).toBeTypeOf(
      'function',
    );
    expect(deps.completeDynamicRegistration.completeDynamicRegistration).toBeTypeOf(
      'function',
    );
    expect(deps.deepLink.logger).toBe(deps.initiateDynamicRegistration.logger);
    expect(deps.initiateDynamicRegistration.logger).toBe(
      deps.completeDynamicRegistration.logger,
    );
    expect(deps.initiateDynamicRegistration.getDynamicRegistrationAppState).toBe(
      getDynamicRegistrationAppState,
    );
    expect(deps.completeDynamicRegistration.onRegistrationComplete).toBe(
      onRegistrationComplete,
    );
  });
});
