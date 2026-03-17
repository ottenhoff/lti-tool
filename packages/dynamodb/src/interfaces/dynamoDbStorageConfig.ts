import type { Logger } from 'pino';

export interface DynamoDbStorageConfig {
  logger?: Logger;
  controlPlaneTable: string;
  dataPlaneTable: string;
  launchConfigTable: string;
  /** Nonce expiration time in seconds (defaults to 600) */
  nonceExpirationSeconds?: number;
}
