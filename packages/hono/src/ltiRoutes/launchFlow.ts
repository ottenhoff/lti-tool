import {
  LTI13LaunchSchema,
  type LtiLaunchVerificationError,
  type LtiLaunchVerificationErrorCode,
  type LtiLaunchVerificationResult,
  type LtiVerifiedLaunch,
  type LTISession,
} from '@longsightgroup/lti-tool';
import type { Context } from 'hono';

export type LtiLaunchFlowDeps<TLaunch extends LtiVerifiedLaunch> = {
  readonly verifyLaunch: (
    idToken: string,
    state: string,
  ) => Promise<LtiLaunchVerificationResult<TLaunch>>;
  readonly createSessionFromVerifiedLaunch: (launch: TLaunch) => Promise<LTISession>;
};

export type LtiLaunchVerificationFlowResult<TLaunch extends LtiVerifiedLaunch> =
  | {
      readonly success: true;
      readonly launch: TLaunch;
    }
  | {
      readonly success: false;
      readonly response: Response;
    };

export type LtiLaunchVerificationFailureContext = {
  readonly hono: Context;
  readonly error: LtiLaunchVerificationError;
};

export type LtiLaunchVerificationFailureResponse = (
  context: LtiLaunchVerificationFailureContext,
) => Response | Promise<Response>;

export type LtiLaunchFlowResult<TLaunch extends LtiVerifiedLaunch> =
  | {
      readonly success: true;
      readonly launch: TLaunch;
      readonly session: LTISession;
    }
  | {
      readonly success: false;
      readonly response: Response;
    };

export async function verifyLaunchRequest<TLaunch extends LtiVerifiedLaunch>(
  c: Context,
  deps: Pick<LtiLaunchFlowDeps<TLaunch>, 'verifyLaunch'> & {
    readonly onVerificationFailure?: LtiLaunchVerificationFailureResponse;
  },
): Promise<LtiLaunchVerificationFlowResult<TLaunch>> {
  const formData = await c.req.formData();
  const { id_token, state } = LTI13LaunchSchema.parse({
    id_token: formData.get('id_token'),
    state: formData.get('state'),
  });

  const verification = await deps.verifyLaunch(id_token, state);
  if (!verification.success) {
    if (deps.onVerificationFailure) {
      return {
        success: false,
        response: await deps.onVerificationFailure({
          hono: c,
          error: verification.error,
        }),
      };
    }

    return {
      success: false,
      response: renderDefaultLaunchVerificationFailureResponse({
        hono: c,
        error: verification.error,
      }),
    };
  }

  return {
    success: true,
    launch: verification.launch,
  };
}

export async function verifyLaunchSession<TLaunch extends LtiVerifiedLaunch>(
  c: Context,
  deps: LtiLaunchFlowDeps<TLaunch>,
): Promise<LtiLaunchFlowResult<TLaunch>> {
  const verification = await verifyLaunchRequest(c, deps);
  if (!verification.success) return verification;

  return {
    success: true,
    launch: verification.launch,
    session: await deps.createSessionFromVerifiedLaunch(verification.launch),
  };
}

function launchVerificationErrorStatus(code: LtiLaunchVerificationErrorCode): 401 | 500 {
  switch (code) {
    case 'launch_config_invalid':
    case 'launch_config_lookup_failed':
    case 'launch_config_missing_jwks_endpoint':
    case 'launch_config_missing_token_endpoint':
    case 'unknown_error':
      return 500;
    case 'invalid_audience':
    case 'invalid_launch_parameters':
    case 'invalid_payload':
    case 'issuer_mismatch':
    case 'jwt_decode_failed':
    case 'jwt_verification_failed':
    case 'launch_client_not_found':
    case 'launch_config_not_found':
    case 'launch_deployment_not_found':
    case 'missing_deployment_id':
    case 'missing_issuer':
    case 'nonce_mismatch':
    case 'nonce_replay':
    case 'state_verification_failed':
    case 'target_link_uri_mismatch':
    case 'untrusted_audience':
    case 'verified_launch_authorization_failed':
      return 401;
  }
}

function launchVerificationErrorMessage(status: 401 | 500): string {
  return status === 401 ? 'Authentication failed' : 'Internal server error';
}

export function renderDefaultLaunchVerificationFailureResponse(
  context: LtiLaunchVerificationFailureContext,
): Response {
  const status = launchVerificationErrorStatus(context.error.code);
  return context.hono.json({ error: launchVerificationErrorMessage(status) }, status);
}
