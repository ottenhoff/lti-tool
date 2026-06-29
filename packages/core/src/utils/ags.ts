import type { LTISession } from '../interfaces/ltiSession.js';

export type LtiAgsService = NonNullable<NonNullable<LTISession['services']>['ags']>;

export function getLtiAgsService(session: LTISession): LtiAgsService | undefined {
  return session.services?.ags;
}

export function isLtiAgsAvailable(session: LTISession): boolean {
  return getLtiAgsService(session) !== undefined;
}

export function isLtiAgsLineItemAvailable(session: LTISession): boolean {
  return getLtiAgsService(session)?.lineitem !== undefined;
}

export function isLtiAgsLineItemsAvailable(session: LTISession): boolean {
  return getLtiAgsService(session)?.lineitems !== undefined;
}

export function hasLtiAgsScope(session: LTISession, scope: string): boolean {
  return getLtiAgsService(session)?.scopes.includes(scope) ?? false;
}
