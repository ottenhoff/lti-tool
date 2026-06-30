import type { LTIConfig } from '@longsightgroup/lti-tool';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeDynamicRegistrationRouteHandler } from '../src/ltiRoutes/routes/dynamicRegistration.route.js';

const completeDynamicRegistrationMock = vi.fn();

vi.mock('../src/ltiTool', () => ({
  getLTITool: () => ({
    completeDynamicRegistration: completeDynamicRegistrationMock,
  }),
}));

describe('completeDynamicRegistrationRouteHandler', () => {
  const config = { logger: { error: vi.fn() } } as unknown as LTIConfig;

  beforeEach(() => {
    completeDynamicRegistrationMock.mockReset();
  });

  it('accepts a single selected service from an html form post', async () => {
    completeDynamicRegistrationMock.mockResolvedValueOnce(
      '<html><body>Registration complete</body></html>',
    );

    const app = new Hono();
    app.post('/lti/register/complete', completeDynamicRegistrationRouteHandler(config));

    const body = new URLSearchParams({
      services: 'deep_linking',
      sessionToken: 'session-token-123',
    });

    const response = await app.request('/lti/register/complete', {
      method: 'POST',
      body: body.toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    expect(response.status).toBe(200);
    expect(completeDynamicRegistrationMock).toHaveBeenCalledWith({
      services: ['deep_linking'],
      sessionToken: 'session-token-123',
    });
  });
});
