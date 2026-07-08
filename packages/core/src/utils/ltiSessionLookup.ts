import {
  LtiServiceError,
  type LtiSessionServiceErrorCode,
  type LtiServiceResult,
} from '../errors/ltiServiceError.js';
import type { LTISession } from '../interfaces/ltiSession.js';
import type { LTIStorage } from '../interfaces/ltiStorage.js';
import { SessionIdSchema } from '../schemas/common.schema.js';

export type LtiSessionStorageReader = Pick<LTIStorage, 'getSession'>;

export interface RequireLtiSessionInput {
  readonly storage: LtiSessionStorageReader;
  readonly sessionId: string;
}

export async function requireLtiSession(
  input: RequireLtiSessionInput,
): Promise<LtiServiceResult<LTISession>> {
  const parsedSessionId = SessionIdSchema.safeParse(input.sessionId);
  if (!parsedSessionId.success) {
    return sessionFailure('invalid_session_id', 'LTI session ID is required');
  }

  try {
    const session = await input.storage.getSession(parsedSessionId.data);
    if (session === undefined) {
      return sessionFailure('session_not_found', 'LTI session was not found');
    }

    return { success: true, data: session };
  } catch (error) {
    return sessionFailure(
      'session_storage_failed',
      'LTI session could not be loaded',
      error,
    );
  }
}

function sessionFailure(
  code: LtiSessionServiceErrorCode,
  message: string,
  cause?: unknown,
): LtiServiceResult<never> {
  return {
    success: false,
    error: new LtiServiceError({
      code,
      serviceKind: 'session',
      operation: 'requireLtiSession',
      message,
      ...(cause === undefined ? {} : { cause }),
    }),
  };
}
