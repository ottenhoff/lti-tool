import type { DynamicRegistrationAppState } from '../schemas/lti13/dynamicRegistration/dynamicRegistrationAppState.schema.js';
import type { OpenIDConfiguration } from '../schemas/lti13/dynamicRegistration/openIDConfiguration.schema.js';

/**
 * Temporary session data stored during LTI 1.3 dynamic registration flow.
 * Used to maintain state between the registration initiation and completion steps.
 */
export interface LTIDynamicRegistrationSession {
  /** Platform's OpenID Connect configuration retrieved during registration initiation */
  openIdConfiguration: OpenIDConfiguration;
  /** Registration token provided by the platform for this registration attempt */
  registrationToken?: string;
  /** JSON-serializable app-owned state carried to registration completion */
  appState?: DynamicRegistrationAppState;
  /** Unix timestamp (milliseconds) when this session expires and should be cleaned up */
  expiresAt: number;
}
