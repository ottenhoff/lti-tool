import { LTI13LaunchSchema, type LTIConfig } from '@longsightgroup/lti-tool';
import { type Handler } from 'hono';
import { ZodError } from 'zod';

import { getLTITool } from '../../ltiTool.js';

/**
 * Creates a route handler for LTI launch requests.
 * @param config - The LTI config
 * @returns Route handler for LTI launch
 */
export function launchRouteHandler(config: LTIConfig): Handler {
  return async (c) => {
    try {
      const formData = await c.req.formData();
      const { id_token, state } = LTI13LaunchSchema.parse({
        id_token: formData.get('id_token'),
        state: formData.get('state'),
      });

      const ltiTool = getLTITool(config);
      const validated = await ltiTool.verifyLaunch(id_token, state);
      const session = await ltiTool.createSession(validated);

      const targetUrl = new URL(session.launch.target);
      targetUrl.searchParams.set('ltiSessionId', session.id);
      return c.redirect(targetUrl);
    } catch (error) {
      config.logger?.error({ error, path: c.req.path }, 'Launch endpoint error');
      if (error instanceof ZodError) {
        return c.json({ error: 'Invalid launch parameters' }, 400);
      }
      if (
        error instanceof Error &&
        (error.message?.includes('nonce') || error.message?.includes('Client'))
      ) {
        return c.json({ error: 'Authentication failed' }, 401);
      }

      return c.json({ error: 'Internal server error' }, 500);
    }
  };
}
