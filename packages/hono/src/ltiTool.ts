import { type LTIConfig, LTITool } from '@longsightgroup/lti-tool';

// simple singleton pattern for now
let _ltiTool: LTITool | undefined;

/**
 * Gets or creates a singleton LTI tool instance with the provided configuration.
 * @param config - The LTI configuration object
 * @returns The LTI tool instance
 */
export function getLTITool(config: LTIConfig): LTITool {
  if (!_ltiTool) {
    _ltiTool = new LTITool(config);
  }
  return _ltiTool;
}
