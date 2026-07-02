import type { LtiLogger } from '@longsightgroup/lti-tool';
import type { AnyD1Database } from 'drizzle-orm/d1';

export interface D1StorageConfig {
  database: AnyD1Database;
  logger?: LtiLogger;
}
