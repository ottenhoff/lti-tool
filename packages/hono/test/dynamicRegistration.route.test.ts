import {
  createNoopLogger,
  LtiServiceError,
  type LtiDynamicRegistrationCompletionResult,
  type LtiLogger,
} from '@longsightgroup/lti-tool';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  LtiCompleteDynamicRegistrationRouteDeps,
  LtiInitiateDynamicRegistrationRouteDeps,
} from '../src/ltiRouteDeps.js';
import {
  completeDynamicRegistrationRouteHandler,
  initiateDynamicRegistrationRouteHandler,
} from '../src/ltiRoutes/routes/dynamicRegistration.route.js';

const completeDynamicRegistrationMock = vi.fn();
const initiateDynamicRegistrationMock = vi.fn();

function createCompleteRegistrationRouteDeps(
  overrides: Partial<LtiCompleteDynamicRegistrationRouteDeps> = {},
): LtiCompleteDynamicRegistrationRouteDeps {
  return {
    completeDynamicRegistration: completeDynamicRegistrationMock,
    logger: createNoopLogger(),
    ...overrides,
  };
}

function createInitiateRegistrationRouteDeps(
  overrides: Partial<LtiInitiateDynamicRegistrationRouteDeps> = {},
): LtiInitiateDynamicRegistrationRouteDeps {
  return {
    initiateDynamicRegistration: initiateDynamicRegistrationMock,
    logger: createNoopLogger(),
    ...overrides,
  };
}

function createLoggerMock(): LtiLogger {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

function createCompletionResult(
  overrides: Partial<LtiDynamicRegistrationCompletionResult> = {},
): LtiDynamicRegistrationCompletionResult {
  return {
    html: '<html><body>Registration complete</body></html>',
    client: {
      id: 'client-record-id',
      name: 'Test Platform',
      iss: 'https://platform.example',
      clientId: 'client-id',
      authUrl: 'https://platform.example/auth',
      tokenUrl: 'https://platform.example/token',
      jwksUrl: 'https://platform.example/jwks',
      deployments: [],
    },
    deployment: {
      id: 'deployment-record-id',
      deploymentId: 'deployment-id',
      name: 'Test Deployment',
    },
    launchConfig: {
      iss: 'https://platform.example',
      clientId: 'client-id',
      deploymentId: 'deployment-id',
      authUrl: 'https://platform.example/auth',
      tokenUrl: 'https://platform.example/token',
      jwksUrl: 'https://platform.example/jwks',
    },
    createdClient: true,
    createdDeployment: true,
    ...overrides,
  };
}

describe('initiateDynamicRegistrationRouteHandler', () => {
  let deps: LtiInitiateDynamicRegistrationRouteDeps;

  beforeEach(() => {
    initiateDynamicRegistrationMock.mockReset();
    deps = createInitiateRegistrationRouteDeps();
  });

  it('returns 400 when required query params are missing', async () => {
    const app = new Hono();
    app.get('/lti/register', initiateDynamicRegistrationRouteHandler(deps));

    const response = await app.request('/lti/register');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request data' });
    expect(initiateDynamicRegistrationMock).not.toHaveBeenCalled();
  });

  it('returns 500 when registration initiation fails after parsing', async () => {
    initiateDynamicRegistrationMock.mockResolvedValueOnce({
      success: false,
      error: new LtiServiceError({
        code: 'platform_request_failed',
        serviceKind: 'dynamic_registration',
        operation: 'initiateDynamicRegistration',
        message: 'platform unavailable',
      }),
    });

    const app = new Hono();
    app.get('/lti/register', initiateDynamicRegistrationRouteHandler(deps));

    const response = await app.request(
      '/lti/register?openid_configuration=https%3A%2F%2Fplatform.example%2F.well-known%2Fopenid-configuration&registration_token=token-1',
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(initiateDynamicRegistrationMock).toHaveBeenCalledOnce();
  });

  it('passes app state from the route callback to registration initiation', async () => {
    initiateDynamicRegistrationMock.mockResolvedValueOnce({
      success: true,
      data: {
        html: '<html><body>Configure registration</body></html>',
        sessionToken: 'session-token-1',
      },
    });
    const getDynamicRegistrationAppState = vi.fn(() => ({
      tenantId: 'tenant-1',
      returnPath: '/admin/lti',
    }));
    deps = createInitiateRegistrationRouteDeps({ getDynamicRegistrationAppState });

    const app = new Hono();
    app.get('/lti/register', initiateDynamicRegistrationRouteHandler(deps));

    const response = await app.request(
      '/lti/register?openid_configuration=https%3A%2F%2Fplatform.example%2F.well-known%2Fopenid-configuration&registration_token=token-1',
    );

    expect(response.status).toBe(200);
    expect(getDynamicRegistrationAppState).toHaveBeenCalledWith({
      hono: expect.anything(),
      registrationRequest: {
        openid_configuration: 'https://platform.example/.well-known/openid-configuration',
        registration_token: 'token-1',
      },
    });
    expect(initiateDynamicRegistrationMock).toHaveBeenCalledWith(
      {
        openid_configuration: 'https://platform.example/.well-known/openid-configuration',
        registration_token: 'token-1',
      },
      '/lti/register',
      { appState: { tenantId: 'tenant-1', returnPath: '/admin/lti' } },
    );
  });
});

describe('completeDynamicRegistrationRouteHandler', () => {
  let deps: LtiCompleteDynamicRegistrationRouteDeps;

  beforeEach(() => {
    completeDynamicRegistrationMock.mockReset();
    deps = createCompleteRegistrationRouteDeps();
  });

  it('accepts a single selected service from an html form post', async () => {
    completeDynamicRegistrationMock.mockResolvedValueOnce({
      success: true,
      data: createCompletionResult(),
    });

    const app = new Hono();
    app.post('/lti/register/complete', completeDynamicRegistrationRouteHandler(deps));

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

  it('runs the registration completion callback before returning success html', async () => {
    const completionResult = createCompletionResult({
      appState: { tenantId: 'tenant-1' },
    });
    completeDynamicRegistrationMock.mockResolvedValueOnce({
      success: true,
      data: completionResult,
    });
    const onRegistrationComplete = vi.fn();
    deps = createCompleteRegistrationRouteDeps({ onRegistrationComplete });

    const app = new Hono();
    app.post('/lti/register/complete', completeDynamicRegistrationRouteHandler(deps));

    const response = await app.request('/lti/register/complete', {
      method: 'POST',
      body: new URLSearchParams({ sessionToken: 'session-token-123' }).toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    expect(response.status).toBe(200);
    expect(onRegistrationComplete).toHaveBeenCalledWith(completionResult);
    expect(await response.text()).toBe(completionResult.html);
  });

  it('logs registration completion callback failures and still returns success html', async () => {
    const completionResult = createCompletionResult();
    completeDynamicRegistrationMock.mockResolvedValueOnce({
      success: true,
      data: completionResult,
    });
    const completionError = new Error('completion side effect failed');
    const onRegistrationComplete = vi.fn().mockRejectedValueOnce(completionError);
    const logger = createLoggerMock();
    deps = createCompleteRegistrationRouteDeps({ logger, onRegistrationComplete });

    const app = new Hono();
    app.post('/lti/register/complete', completeDynamicRegistrationRouteHandler(deps));

    const response = await app.request('/lti/register/complete', {
      method: 'POST',
      body: new URLSearchParams({ sessionToken: 'session-token-123' }).toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(completionResult.html);
    expect(logger.error).toHaveBeenCalledWith(
      { error: completionError, path: '/lti/register/complete' },
      'lti dynamic registration completion callback failed',
    );
  });

  it('returns 500 when registration completion fails after parsing', async () => {
    completeDynamicRegistrationMock.mockResolvedValueOnce({
      success: false,
      error: new LtiServiceError({
        code: 'platform_request_failed',
        serviceKind: 'dynamic_registration',
        operation: 'completeDynamicRegistration',
        message: 'registration unavailable',
      }),
    });

    const app = new Hono();
    app.post('/lti/register/complete', completeDynamicRegistrationRouteHandler(deps));

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

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(completeDynamicRegistrationMock).toHaveBeenCalledOnce();
  });

  it('maps app-routable dynamic registration failures to bad requests', async () => {
    completeDynamicRegistrationMock.mockResolvedValueOnce({
      success: false,
      error: new LtiServiceError({
        code: 'registration_session_expired',
        serviceKind: 'dynamic_registration',
        operation: 'completeDynamicRegistration',
        message: 'expired',
      }),
    });

    const app = new Hono();
    app.post('/lti/register/complete', completeDynamicRegistrationRouteHandler(deps));

    const response = await app.request('/lti/register/complete', {
      method: 'POST',
      body: new URLSearchParams({ sessionToken: 'session-token-123' }).toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Registration session is invalid or expired',
    });
    expect(completeDynamicRegistrationMock).toHaveBeenCalledOnce();
  });
});
