import type { LtiDynamicRegistration, LTITool } from '@longsightgroup/lti-tool';

import type {
  LtiCompleteDynamicRegistrationRouteDeps,
  LtiDeepLinkRouteDeps,
  LtiInitiateDynamicRegistrationRouteDeps,
} from '../ltiRouteDeps.js';
import { createLtiRouteLogger, type LtiRouteLoggerOptions } from '../ltiRouteLogging.js';

export type CreateLtiOptionalRouteDepsOptions = LtiRouteLoggerOptions & {
  ltiTool: LTITool;
  dynamicRegistration: LtiDynamicRegistration;
};

export type LtiOptionalRouteDeps = {
  deepLink: LtiDeepLinkRouteDeps;
  initiateDynamicRegistration: LtiInitiateDynamicRegistrationRouteDeps;
  completeDynamicRegistration: LtiCompleteDynamicRegistrationRouteDeps;
};

/**
 * Binds optional LTI route dependencies from core protocol facades.
 *
 * Use with `deepLinkRouteHandler`, `initiateDynamicRegistrationRouteHandler`, and
 * `completeDynamicRegistrationRouteHandler` after mounting required routes via
 * {@link createLtiRoutes}.
 *
 * Deep linking response creation is app-owned: call
 * `ltiTool.createAdvantage(session).createDeepLinkingResponse(contentItems)` from your route.
 */
export function createLtiOptionalRouteDeps(
  options: CreateLtiOptionalRouteDepsOptions,
): LtiOptionalRouteDeps {
  const { dynamicRegistration, ltiTool } = options;
  const logger = createLtiRouteLogger(options);

  return {
    deepLink: {
      getSession: (sessionId) => ltiTool.getSession(sessionId),
      logger,
    },
    initiateDynamicRegistration: {
      initiateDynamicRegistration: (request, routePath) =>
        dynamicRegistration.initiateDynamicRegistration(request, routePath),
      logger,
    },
    completeDynamicRegistration: {
      completeDynamicRegistration: (form) =>
        dynamicRegistration.completeDynamicRegistration(form),
      logger,
    },
  };
}
