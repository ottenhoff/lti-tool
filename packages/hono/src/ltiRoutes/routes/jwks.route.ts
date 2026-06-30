import { type LTIConfig } from '@longsightgroup/lti-tool';
import { type Handler } from 'hono';

import { getLTITool } from '../../ltiTool.js';

/**
 * Creates a route handler for JWKS requests.
 * @param config - The LTI config
 * @returns Route handler for JWKS endpoint
 */
export function jwksRouteHandler(config: LTIConfig): Handler {
  return async (c) => {
    try {
      const ltiTool = getLTITool(config);
      return c.json(await ltiTool.getJWKS());
    } catch (error) {
      config.logger?.error({ error, path: c.req.path }, 'JWKS endpoint error');
      return c.json({ error: 'Internal server error' }, 500);
    }
  };
}
