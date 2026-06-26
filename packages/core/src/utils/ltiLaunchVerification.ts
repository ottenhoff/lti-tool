import type { LTILaunchConfig } from '../interfaces/index.js';
import type { LTI13JwtPayload } from '../schemas/index.js';

export type LtiLaunchVerificationErrorCode =
  | 'invalid_audience'
  | 'invalid_launch_parameters'
  | 'invalid_payload'
  | 'issuer_mismatch'
  | 'jwt_decode_failed'
  | 'jwt_verification_failed'
  | 'launch_config_not_found'
  | 'missing_deployment_id'
  | 'missing_issuer'
  | 'nonce_mismatch'
  | 'nonce_replay'
  | 'state_verification_failed'
  | 'target_link_uri_mismatch'
  | 'unknown_error'
  | 'untrusted_audience';

export class LtiLaunchVerificationError extends Error {
  constructor(
    public readonly code: LtiLaunchVerificationErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LtiLaunchVerificationError';
  }
}

export interface LtiVerifiedLaunch {
  payload: LTI13JwtPayload;
  issuer: string;
  clientId: string;
  deploymentId: string;
  targetLinkUri: string;
  launchConfig: LTILaunchConfig;
}

export type LtiLaunchVerificationResult =
  | {
      success: true;
      launch: LtiVerifiedLaunch;
    }
  | {
      success: false;
      error: LtiLaunchVerificationError;
    };
