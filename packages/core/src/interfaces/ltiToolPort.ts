import type { LtiAdvantagePort } from '../ltiAdvantage.js';
import type {
  LtiAuthorizedLaunch,
  LtiLaunchVerificationResult,
  LtiVerifiedLaunch,
  LtiVerifyLaunchOptions,
} from '../utils/ltiLaunchVerification.js';

import type { JWKS } from './jwks.js';
import type { LTISession } from './ltiSession.js';

/**
 * Minimal app-facing LTI tool facade for login, launch verification, sessions,
 * and session-bound Advantage services.
 */
export interface LtiToolPort {
  getJWKS(): Promise<JWKS>;

  handleLogin(params: {
    client_id: string;
    iss: string;
    launchUrl: URL | string;
    login_hint: string;
    target_link_uri: string;
    lti_deployment_id: string;
    lti_message_hint?: string;
  }): Promise<string>;

  verifyLaunch(idToken: string, state: string): Promise<LtiLaunchVerificationResult>;
  verifyLaunch<TAuthorization>(
    idToken: string,
    state: string,
    options: LtiVerifyLaunchOptions<TAuthorization>,
  ): Promise<LtiLaunchVerificationResult<LtiAuthorizedLaunch<TAuthorization>>>;

  createSessionFromVerifiedLaunch(launch: LtiVerifiedLaunch): Promise<LTISession>;
  getSession(sessionId: string): Promise<LTISession | undefined>;
  createAdvantage(session: LTISession): LtiAdvantagePort;
}
