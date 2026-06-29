import { describe, expect, it } from 'vitest';

import {
  LTI_CLAIM_CONTEXT,
  LTI_CLAIM_DEEP_LINKING_SETTINGS,
  LTI_CLAIM_DEPLOYMENT_ID,
  LTI_CLAIM_MESSAGE_TYPE,
  LTI_CLAIM_PLATFORM_CONFIGURATION,
  LTI_CLAIM_RESOURCE_LINK,
  LTI_CLAIM_ROLES,
  LTI_CLAIM_TARGET_LINK_URI,
  LTI_CLAIM_VERSION,
  LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST,
  LTI_ROLE_CONTEXT_INSTRUCTOR,
  LTI_VERSION_1P3P0,
} from '../src/constants.js';
import {
  LTIDynamicRegistrationSessionSchema,
  LTISessionSchema,
  type LTI13JwtPayload,
} from '../src/schemas/index.js';
import { createSession } from '../src/services/session.service.js';

const sampleLaunchPayload = (): LTI13JwtPayload => ({
  iss: 'https://platform.example.com',
  aud: 'client-123',
  sub: 'user-123',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  nonce: 'nonce-123',
  name: 'Instructor One',
  email: 'instructor@example.com',
  [LTI_CLAIM_MESSAGE_TYPE]: LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST,
  [LTI_CLAIM_VERSION]: LTI_VERSION_1P3P0,
  [LTI_CLAIM_DEPLOYMENT_ID]: 'deployment-123',
  [LTI_CLAIM_TARGET_LINK_URI]: 'https://tool.example.com/launch',
  [LTI_CLAIM_ROLES]: [LTI_ROLE_CONTEXT_INSTRUCTOR],
  [LTI_CLAIM_CONTEXT]: {
    id: 'course-123',
    label: 'COURSE123',
    title: 'Course 123',
  },
  [LTI_CLAIM_RESOURCE_LINK]: {
    id: 'resource-link-123',
    title: 'Resource Link 123',
  },
  [LTI_CLAIM_DEEP_LINKING_SETTINGS]: {
    deep_link_return_url: 'https://platform.example.com/deep_links',
    accept_types: ['ltiResourceLink'],
  },
});

describe('LTI session schemas', () => {
  it('accepts sessions produced by core session creation', () => {
    const session = createSession(sampleLaunchPayload());

    expect(LTISessionSchema.parse(session)).toEqual(session);
  });

  it('rejects malformed persisted session objects', () => {
    expect(() =>
      LTISessionSchema.parse({
        id: 'session-123',
        jwtPayload: sampleLaunchPayload(),
      }),
    ).toThrow();
  });

  it('accepts dynamic registration sessions', () => {
    const session = {
      openIdConfiguration: {
        issuer: 'https://platform.example.com',
        authorization_endpoint: 'https://platform.example.com/authorize',
        registration_endpoint: 'https://platform.example.com/register',
        jwks_uri: 'https://platform.example.com/jwks',
        token_endpoint: 'https://platform.example.com/token',
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
        token_endpoint_auth_signing_alg_values_supported: ['RS256'],
        scopes_supported: [],
        response_types_supported: ['id_token'],
        id_token_signing_alg_values_supported: ['RS256'],
        claims_supported: ['iss', 'sub'],
        subject_types_supported: ['public'],
        [LTI_CLAIM_PLATFORM_CONFIGURATION]: {
          product_family_code: 'canvas',
          version: 'cloud',
          messages_supported: [{ type: LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST }],
        },
      },
      registrationToken: 'registration-token-123',
      expiresAt: Date.now() + 600_000,
    };

    expect(LTIDynamicRegistrationSessionSchema.parse(session)).toEqual(session);
  });

  it('rejects malformed dynamic registration sessions', () => {
    expect(() =>
      LTIDynamicRegistrationSessionSchema.parse({
        openIdConfiguration: {
          issuer: 'not-a-url',
        },
        expiresAt: 'soon',
      }),
    ).toThrow();
  });
});
