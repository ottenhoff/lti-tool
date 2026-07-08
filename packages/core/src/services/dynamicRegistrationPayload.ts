import {
  LTI_CLAIM_TOOL_CONFIGURATION,
  LTI_AGS_SCOPE_LINEITEM,
  LTI_AGS_SCOPE_RESULT_READONLY,
  LTI_AGS_SCOPE_SCORE,
  LTI_NRPS_SCOPE_CONTEXT_MEMBERSHIP_READONLY,
} from '../constants.js';
import type {
  DynamicRegistrationConfig,
  DynamicRegistrationCustomizationContext,
} from '../interfaces/ltiConfig.js';
import type { DynamicRegistrationAppState } from '../schemas/lti13/dynamicRegistration/dynamicRegistrationAppState.schema.js';
import type { DynamicRegistrationSelectedService } from '../schemas/lti13/dynamicRegistration/ltiDynamicRegistration.schema.js';
import { LTIMessagesArraySchema } from '../schemas/lti13/dynamicRegistration/ltiMessages.schema.js';
import type { OpenIDConfiguration } from '../schemas/lti13/dynamicRegistration/openIDConfiguration.schema.js';
import {
  ToolRegistrationPayloadSchema,
  type ToolRegistrationPayload,
} from '../schemas/lti13/dynamicRegistration/toolRegistrationPayload.schema.js';

import {
  buildProfileMessages,
  resolveDynamicRegistrationProfile,
  transformProfilePayload,
} from './dynamicRegistrationProfiles.js';

type DynamicRegistrationResolvedUrls = {
  deepLinkingUri: string;
  jwksUri: string;
  launchUri: string;
  loginUri: string;
};

function resolveDynamicRegistrationUrls(
  config: DynamicRegistrationConfig,
): DynamicRegistrationResolvedUrls {
  return {
    deepLinkingUri: config.deepLinkingUri || `${config.url}/lti/deep-linking`,
    jwksUri: config.jwksUri || `${config.url}/lti/jwks`,
    launchUri: config.launchUri || `${config.url}/lti/launch`,
    loginUri: config.loginUri || `${config.url}/lti/login`,
  };
}

function buildBaseRegistrationPayload(input: {
  config: DynamicRegistrationConfig;
  messages: ReturnType<typeof LTIMessagesArraySchema.parse>;
  resolvedUrls: DynamicRegistrationResolvedUrls;
  scopes: string[];
}): ToolRegistrationPayload {
  const { config, messages, resolvedUrls, scopes } = input;
  return {
    application_type: 'web',
    response_types: ['id_token'],
    grant_types: ['implicit', 'client_credentials'],
    initiate_login_uri: resolvedUrls.loginUri,
    redirect_uris: [config.url, resolvedUrls.launchUri, ...(config.redirectUris || [])],
    client_name: config.name,
    jwks_uri: resolvedUrls.jwksUri,
    logo_uri: config.logo,
    scope: scopes.join(' '),
    token_endpoint_auth_method: 'private_key_jwt',
    [LTI_CLAIM_TOOL_CONFIGURATION]: {
      domain: new URL(config.url).hostname,
      description: config.description,
      target_link_uri: config.url,
      claims: ['iss', 'sub', 'name', 'email'],
      messages,
    },
  };
}

export function buildDynamicRegistrationScopes(
  selectedServices: readonly DynamicRegistrationSelectedService[],
): string[] {
  const scopes: string[] = [];

  if (selectedServices.includes('ags')) {
    scopes.push(
      LTI_AGS_SCOPE_LINEITEM,
      LTI_AGS_SCOPE_RESULT_READONLY,
      LTI_AGS_SCOPE_SCORE,
    );
  }

  if (selectedServices.includes('nrps')) {
    scopes.push(LTI_NRPS_SCOPE_CONTEXT_MEMBERSHIP_READONLY);
  }

  return scopes;
}

export function buildToolRegistrationPayload(input: {
  config: DynamicRegistrationConfig;
  openIdConfiguration: OpenIDConfiguration;
  selectedServices: readonly DynamicRegistrationSelectedService[];
  appState?: DynamicRegistrationAppState;
}): ToolRegistrationPayload {
  const { config, openIdConfiguration, selectedServices, appState } = input;
  const resolvedUrls = resolveDynamicRegistrationUrls(config);
  const profile = resolveDynamicRegistrationProfile(openIdConfiguration, config);

  const customizationContext: DynamicRegistrationCustomizationContext = {
    openIdConfiguration,
    selectedServices,
    ...resolvedUrls,
    toolName: config.name,
    ...(appState === undefined ? {} : { appState }),
    platformConfig: profile.platformConfig,
  };

  const profileMessages = LTIMessagesArraySchema.parse(
    buildProfileMessages(customizationContext, profile),
  );
  const messages = LTIMessagesArraySchema.parse(
    config.customizeMessages?.(customizationContext, profileMessages) ?? profileMessages,
  );
  const scopes = buildDynamicRegistrationScopes(selectedServices);

  const profilePayload = transformProfilePayload(
    buildBaseRegistrationPayload({ config, messages, resolvedUrls, scopes }),
    profile,
  );

  return ToolRegistrationPayloadSchema.parse(
    config.customizePayload?.(customizationContext, profilePayload) ?? profilePayload,
  );
}
