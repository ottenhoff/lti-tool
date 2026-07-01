import type {
  DynamicRegistrationForm,
  JWKS,
  LtiDynamicRegistration,
  LtiLaunchVerificationResult,
  LtiToolPort,
  LtiVerifiedLaunch,
  LTISession,
  RegistrationRequest,
} from '@longsightgroup/lti-tool';
import type { Logger } from 'pino';

export type LtiJwksRouteDeps = {
  getJWKS: () => Promise<JWKS>;
  logger: Logger;
};

export type LtiLoginRouteDeps = {
  handleLogin: LtiToolPort['handleLogin'];
  logger: Logger;
};

export type LtiLaunchRouteDeps = {
  verifyLaunch: (idToken: string, state: string) => Promise<LtiLaunchVerificationResult>;
  createSessionFromVerifiedLaunch: (launch: LtiVerifiedLaunch) => Promise<LTISession>;
  logger: Logger;
};

export type LtiDeepLinkRouteDeps = {
  getSession: (sessionId: string) => Promise<LTISession | undefined>;
  logger: Logger;
};

export type LtiInitiateDynamicRegistrationRouteDeps = {
  initiateDynamicRegistration: (
    request: RegistrationRequest,
    routePath: string,
  ) => ReturnType<LtiDynamicRegistration['initiateDynamicRegistration']>;
  logger: Logger;
};

export type LtiCompleteDynamicRegistrationRouteDeps = {
  completeDynamicRegistration: (
    form: DynamicRegistrationForm,
  ) => ReturnType<LtiDynamicRegistration['completeDynamicRegistration']>;
  logger: Logger;
};

export type LtiSessionMiddlewareDeps = {
  getSession: (sessionId: string) => Promise<LTISession | undefined>;
};
