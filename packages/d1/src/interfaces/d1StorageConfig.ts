import type { Logger } from 'pino';

import type { D1DatabaseLike } from './d1Database.js';

export interface D1StorageConfig {
  /**
   * Cloudflare D1 database binding, usually `env.DB` in a Worker.
   */
  database: D1DatabaseLike;
  logger?: Logger;
  /**
   * Nonce expiration time in seconds (defaults to 600 = 10 minutes)
   */
  nonceExpirationSeconds?: number;
}
