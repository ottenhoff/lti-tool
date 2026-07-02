import type { LtiLogger } from '@longsightgroup/lti-tool';

export interface DynamoDbStorageConfig {
  logger?: LtiLogger;
  controlPlaneTable: string;
  dataPlaneTable: string;
  launchConfigTable: string;
  /** Nonce expiration time in seconds (defaults to 600) */
  nonceExpirationSeconds?: number;
}
