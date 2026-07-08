import type { LTISession } from '../interfaces/ltiSession.js';
import type { LtiDeepLinkingSettings } from '../schemas/ltiDeepLinkingSettings.schema.js';

import { getLtiAgsService } from './ags.js';
import { getLtiNrpsService } from './nrps.js';

/** Resolved Assignment and Grade Services capability metadata for an LTI session. */
export interface LtiAgsServiceCapabilities {
  /** True when the launch session includes an AGS service claim. */
  readonly available: boolean;
  /** Single line item endpoint URL, when provided by the platform. */
  readonly lineitem?: string;
  /** Line items collection endpoint URL, when provided by the platform. */
  readonly lineitems?: string;
  /** OAuth scopes advertised for AGS access. */
  readonly scopes: readonly string[];
}

/** Resolved Names and Role Provisioning Services capability metadata for an LTI session. */
export interface LtiNrpsServiceCapabilities {
  /** True when the launch session includes an NRPS service claim. */
  readonly available: boolean;
  /** Context membership endpoint URL, when provided by the platform. */
  readonly membershipUrl?: string;
  /** NRPS versions advertised by the platform. */
  readonly versions: readonly string[];
}

type ReadonlyLtiDeepLinkingSettings = Readonly<
  Omit<LtiDeepLinkingSettings, 'acceptTypes' | 'acceptPresentationDocumentTargets'>
> & {
  readonly acceptTypes: readonly string[];
  readonly acceptPresentationDocumentTargets: readonly string[];
};

type UnavailableLtiDeepLinkingServiceCapabilities = Pick<
  ReadonlyLtiDeepLinkingSettings,
  'acceptTypes' | 'acceptPresentationDocumentTargets' | 'acceptMultiple' | 'autoCreate'
> & {
  readonly available: false;
};

/** Resolved Deep Linking capability metadata for an LTI session. */
export type LtiDeepLinkingServiceCapabilities =
  | ({ readonly available: true } & ReadonlyLtiDeepLinkingSettings)
  | UnavailableLtiDeepLinkingServiceCapabilities;

/** Policy-free snapshot of LTI Advantage service capabilities advertised in a launch session. */
export interface LtiServiceCapabilities {
  /** Assignment and Grade Services capability metadata. */
  readonly ags: LtiAgsServiceCapabilities;
  /** Names and Role Provisioning Services capability metadata. */
  readonly nrps: LtiNrpsServiceCapabilities;
  /** Deep Linking capability metadata. */
  readonly deepLinking: LtiDeepLinkingServiceCapabilities;
}

/**
 * Resolves a policy-free snapshot of LTI Advantage service capabilities from a launch session.
 *
 * The snapshot only interprets the session shape and copies collection fields for safe caller
 * projection. It does not apply HTTP, persistence, logging, or application policy.
 *
 * @param session - Active LTI session produced from a launch
 * @returns Normalized service capability metadata with empty arrays for absent list fields
 */
export function resolveLtiServiceCapabilities(
  session: LTISession,
): LtiServiceCapabilities {
  const agsService = getLtiAgsService(session);
  const nrpsService = getLtiNrpsService(session);
  const deepLinkingService = resolveLtiDeepLinkingServiceCapabilities(
    session.services?.deepLinking,
  );

  return {
    ags: {
      available: agsService !== undefined,
      ...(agsService?.lineitem === undefined ? {} : { lineitem: agsService.lineitem }),
      ...(agsService?.lineitems === undefined ? {} : { lineitems: agsService.lineitems }),
      scopes: [...(agsService?.scopes ?? [])],
    },
    nrps: {
      available: nrpsService !== undefined,
      ...(nrpsService?.membershipUrl === undefined
        ? {}
        : { membershipUrl: nrpsService.membershipUrl }),
      versions: [...(nrpsService?.versions ?? [])],
    },
    deepLinking: {
      ...deepLinkingService,
    },
  };
}

function resolveLtiDeepLinkingServiceCapabilities(
  settings: LtiDeepLinkingSettings | undefined,
): LtiDeepLinkingServiceCapabilities {
  if (settings === undefined) {
    return {
      available: false,
      acceptTypes: [],
      acceptPresentationDocumentTargets: [],
      acceptMultiple: false,
      autoCreate: false,
    };
  }

  return {
    available: true,
    ...settings,
    acceptTypes: [...settings.acceptTypes],
    acceptPresentationDocumentTargets: [...settings.acceptPresentationDocumentTargets],
  };
}
