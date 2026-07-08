import { createNoopLogger, type JWKS } from '@longsightgroup/lti-tool';
import { describe, expect, it } from 'vitest';

import { jwksRouteHandler, type LtiHonoContext } from '../src/index.js';

type ExternalHonoContext = LtiHonoContext & {
  readonly packageSource: '@hono/hono';
};

type ExternalHonoHandler = (
  context: ExternalHonoContext,
  next: () => Promise<void>,
) => Response | Promise<Response>;

describe('Hono structural types', () => {
  it('allows route handlers to be used with structurally compatible Hono contexts', () => {
    const handler: ExternalHonoHandler = jwksRouteHandler({
      getJWKS: () => Promise.resolve({ keys: [] } satisfies JWKS),
      logger: createNoopLogger(),
    });

    expect(handler).toBeTypeOf('function');
  });
});
