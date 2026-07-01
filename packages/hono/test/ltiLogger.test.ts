import {
  LTITool,
  type LtiLogFields,
  type LtiLogger,
} from '@longsightgroup/lti-tool';
import { describe, expect, it } from 'vitest';

import { MemoryStorage } from '../../memory/src/index.js';
import { createLtiRoutes } from '../src/ltiRoutes/createLtiRoutes.js';

const structuralLogger: LtiLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe('LtiLogger', () => {
  it('accepts non-pino structural loggers across public config seams', async () => {
    const storage = new MemoryStorage({ logger: structuralLogger });
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const ltiTool = new LTITool({
      stateSecret: new Uint8Array(32),
      keyPair,
      storage,
      logger: structuralLogger,
    });

    const routes = createLtiRoutes({ ltiTool, logger: structuralLogger });

    expect(routes).toBeDefined();
  });

  it('supports structured field and message calls', () => {
    const events: Array<readonly [LtiLogFields | string, string | undefined]> = [];
    const recordLog = (
      fieldsOrMessage: LtiLogFields | string,
      message?: string,
    ): void => {
      events.push([fieldsOrMessage, message]);
    };
    const logger: LtiLogger = {
      debug: recordLog,
      info: recordLog,
      warn: recordLog,
      error: recordLog,
    };

    logger.info('ready');
    logger.warn({ route: '/lti/login' }, 'login warning');

    expect(events).toEqual([
      ['ready', undefined],
      [{ route: '/lti/login' }, 'login warning'],
    ]);
  });
});
