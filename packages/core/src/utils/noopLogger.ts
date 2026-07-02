import type { LtiLogger } from '../interfaces/ltiLogger.js';

const noopLogger = {
  debug: (): void => {},
  info: (): void => {},
  warn: (): void => {},
  error: (): void => {},
} satisfies LtiLogger;

/** Returns a shared logger implementation that discards all log events. */
export function createNoopLogger(): LtiLogger {
  return noopLogger;
}
