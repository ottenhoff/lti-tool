import type { Logger } from 'pino';

import type { LTIStorage } from './ltiStorage.js';

/** Dynamic registration configuration for LTI 1.3 tool registration */
export interface DynamicRegistrationConfig {
  /** Base URL of the LTI tool (e.g., 'https://my-tool.com') */
  url: string;
  /** Display name shown to users in the LMS (e.g., 'My Learning Tool') */
  name: string;
  /** Optional description of the tool's functionality */
  description?: string;
  /** Optional URL to tool logo image for LMS display */
  logo?: string;
  /** Additional redirect URIs beyond the default /lti/launch endpoint */
  redirectUris?: string[];
  /** Optional custom deep linking content selection endpoint (defaults to {url}/lti/deep-linking) */
  deepLinkingUri?: string;
  /** Optional custom login endpoint (defaults to {url}/lti/login) */
  loginUri?: string;
  /** Optional custom launch endpoint (defaults to {url}/lti/launch) */
  launchUri?: string;
  /** Optional custom JWKS endpoint (defaults to {url}/lti/jwks) */
  jwksUri?: string;
}

/**
 * Configuration object for initializing an LTI Tool instance.
 * Contains cryptographic keys, secrets, and storage adapter.
 */
export interface LTIConfig {
  /** Secret key used for signing state JWTs during OIDC flow (minimum 32 bytes recommended) */
  stateSecret: Uint8Array;

  /** RSA key pair for signing JWTs and providing JWKS endpoint */
  keyPair: CryptoKeyPair;

  /** Storage adapter for persisting platforms, sessions, and nonces */
  storage: LTIStorage;

  /** Optional pino logger */
  logger?: Logger;

  /** Security configuration options */
  security?: {
    /** Key ID for JWKS and JWT signing (defaults to 'main') */
    keyId?: string;
    /** State JWT expiration time in seconds (defaults to 600 = 10 minutes) */
    stateExpirationSeconds?: number;
    /** Nonce expiration time in seconds (defaults to 600 = 10 minutes) */
    nonceExpirationSeconds?: number;
    /** Session expiration time in seconds (defaults to 86400 = 24 hours) */
    sessionExpirationSeconds?: number;
  };

  /** Dynamic registration configuration for LTI 1.3 tool registration */
  dynamicRegistration?: DynamicRegistrationConfig;
}
