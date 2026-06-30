import type { Logger } from 'pino';

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  // SAFETY: Call sites in this package only require pino's level methods; the
  // object intentionally discards those calls without carrying logger state.
} as unknown as Logger;

/** Returns a shared logger implementation that discards all log events. */
export function createNoopLogger(): Logger {
  return noopLogger;
}
