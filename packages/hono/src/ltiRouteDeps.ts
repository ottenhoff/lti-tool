import type {
  DynamicRegistrationForm,
  JWKS,
  LtiDynamicRegistration,
  LtiLaunchVerificationResult,
  LtiLogger,
  LtiToolPort,
  LtiVerifiedLaunch,
  LTISession,
  RegistrationRequest,
} from '@longsightgroup/lti-tool';

export type LtiJwksRouteDeps = {
  getJWKS: () => Promise<JWKS>;
  logger: LtiLogger;
};

export type LtiLoginRouteDeps = {
  handleLogin: LtiToolPort['handleLogin'];
  logger: LtiLogger;
};

export type LtiLaunchRouteDeps = {
  verifyLaunch: (idToken: string, state: string) => Promise<LtiLaunchVerificationResult>;
  createSessionFromVerifiedLaunch: (launch: LtiVerifiedLaunch) => Promise<LTISession>;
  logger: LtiLogger;
};

export type LtiDeepLinkRouteDeps = {
  getSession: (sessionId: string) => Promise<LTISession | undefined>;
  logger: LtiLogger;
};

export type LtiInitiateDynamicRegistrationRouteDeps = {
  initiateDynamicRegistration: (
    request: RegistrationRequest,
    routePath: string,
  ) => ReturnType<LtiDynamicRegistration['initiateDynamicRegistration']>;
  logger: LtiLogger;
};

export type LtiCompleteDynamicRegistrationRouteDeps = {
  completeDynamicRegistration: (
    form: DynamicRegistrationForm,
  ) => ReturnType<LtiDynamicRegistration['completeDynamicRegistration']>;
  logger: LtiLogger;
};

export type LtiSessionMiddlewareDeps = {
  getSession: (sessionId: string) => Promise<LTISession | undefined>;
};
