import type { AnyD1Database } from 'drizzle-orm/d1';
import type { LtiLogger } from '@longsightgroup/lti-tool';

export interface D1StorageConfig {
  database: AnyD1Database;
  logger?: LtiLogger;
}
