import { createNoopLogger, type LtiLogger } from '@longsightgroup/lti-tool';

export type LtiRouteLoggerOptions = {
  logger?: LtiLogger;
};

export function createLtiRouteLogger(options?: LtiRouteLoggerOptions): LtiLogger {
  return options?.logger ?? createNoopLogger();
}
