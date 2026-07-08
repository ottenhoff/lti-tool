import { ZodError } from 'zod';

import type { LtiHonoHandler } from '../../honoTypes.js';
import { type LtiLaunchRouteDeps } from '../../ltiRouteDeps.js';
import { verifyLaunchSession } from '../launchFlow.js';

/**
 * Creates a route handler for LTI launch requests.
 * @param deps - Protocol dependencies for the launch route
 * @returns Route handler for LTI launch
 */
export function launchRouteHandler(deps: LtiLaunchRouteDeps): LtiHonoHandler {
  return async (c) => {
    try {
      const result = await verifyLaunchSession(c, deps);
      if (!result.success) return result.response;

      const targetUrl = new URL(result.session.launch.target);
      targetUrl.searchParams.set('ltiSessionId', result.session.id);
      return c.redirect(targetUrl);
    } catch (error) {
      deps.logger.error({ error, path: c.req.path }, 'Launch endpoint error');
      if (error instanceof ZodError) {
        return c.json({ error: 'Invalid launch parameters' }, 400);
      }
      return c.json({ error: 'Internal server error' }, 500);
    }
  };
}
