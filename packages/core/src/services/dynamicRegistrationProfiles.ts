import {
  LTI_CLAIM_PLATFORM_CONFIGURATION,
  LTI_CLAIM_TOOL_CONFIGURATION,
  LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
  LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST,
} from '../constants.js';
import type {
  CanvasDynamicRegistrationConfig,
  DynamicRegistrationCustomizationContext,
  DynamicRegistrationConfig,
  DynamicRegistrationPlatformKey,
  DynamicRegistrationPlatformConfig,
  DynamicRegistrationPlatformsConfig,
  PlatformDynamicRegistrationConfig,
} from '../interfaces/ltiConfig.js';
import type { LTIMessage } from '../schemas/lti13/dynamicRegistration/ltiMessages.schema.js';
import type { OpenIDConfiguration } from '../schemas/lti13/dynamicRegistration/openIDConfiguration.schema.js';
import type { ToolRegistrationPayload } from '../schemas/lti13/dynamicRegistration/toolRegistrationPayload.schema.js';

type DynamicRegistrationPayloadContext<
  TPlatformConfig extends DynamicRegistrationPlatformConfig,
> = {
  payload: ToolRegistrationPayload;
  platformConfig?: TPlatformConfig;
};

type PlacementProfileDefinition<TKey extends DynamicRegistrationPlatformKey> = {
  readonly productFamilyCode: string;
  readonly configKey: TKey;
  readonly defaultDeepLinkPlacements: readonly string[];
};

type AnyPlacementProfileDefinition =
  PlacementProfileDefinition<DynamicRegistrationPlatformKey>;

type DefaultPlacementProfileDefinition = {
  readonly productFamilyCode: '';
  readonly defaultDeepLinkPlacements: readonly string[];
};

export type ResolvedDynamicRegistrationProfile = {
  definition: AnyPlacementProfileDefinition | DefaultPlacementProfileDefinition;
  productFamilyCode: string;
  platformConfig?: DynamicRegistrationPlatformConfig;
};

const defaultPlacementProfileDefinition: DefaultPlacementProfileDefinition = {
  productFamilyCode: '',
  defaultDeepLinkPlacements: ['editor_button'],
};

function resolveConfiguredProfile(
  definition: AnyPlacementProfileDefinition,
  productFamilyCode: string,
  platforms: DynamicRegistrationPlatformsConfig | undefined,
): ResolvedDynamicRegistrationProfile {
  const platformConfig = platforms?.[definition.configKey];
  return {
    definition,
    productFamilyCode,
    ...(platformConfig === undefined ? {} : { platformConfig }),
  };
}

function buildPlacementDeepLinkingMessages(
  deepLinkingUri: string,
  toolName: string,
  placements: readonly string[],
): LTIMessage[] {
  return placements.map((placement) => ({
    type: LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
    target_link_uri: deepLinkingUri,
    label: toolName,
    placements: [placement],
    supported_types: ['ltiResourceLink'],
  }));
}

function buildPlacementMessages(input: {
  selectedServices: string[];
  deepLinkingUri: string;
  launchUri: string;
  toolName: string;
  platformConfig?: PlatformDynamicRegistrationConfig;
  defaultDeepLinkPlacements: readonly string[];
}): LTIMessage[] {
  const { selectedServices, deepLinkingUri, launchUri, toolName, platformConfig } = input;
  const messages: LTIMessage[] = [
    platformConfig?.resourceLinkPlacements?.length
      ? {
          type: LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST,
          label: toolName,
          target_link_uri: launchUri,
          placements: platformConfig.resourceLinkPlacements,
        }
      : { type: LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST },
  ];

  if (selectedServices.includes('deep_linking')) {
    messages.push(
      ...buildPlacementDeepLinkingMessages(
        deepLinkingUri,
        toolName,
        platformConfig?.deepLinkPlacements ?? input.defaultDeepLinkPlacements,
      ),
    );
  }

  return messages;
}

function productFamilyCode(openIdConfiguration: OpenIDConfiguration): string {
  return openIdConfiguration[
    LTI_CLAIM_PLATFORM_CONFIGURATION
  ].product_family_code.toLowerCase();
}

function transformCanvasPayload({
  payload,
  platformConfig,
}: DynamicRegistrationPayloadContext<CanvasDynamicRegistrationConfig>): ToolRegistrationPayload {
  if (!platformConfig) {
    return payload;
  }

  return {
    ...payload,
    ...(platformConfig.clientUri ? { client_uri: platformConfig.clientUri } : {}),
    [LTI_CLAIM_TOOL_CONFIGURATION]: {
      ...payload[LTI_CLAIM_TOOL_CONFIGURATION],
      ...(platformConfig.secondaryDomains?.length
        ? { secondary_domains: platformConfig.secondaryDomains }
        : {}),
      ...(platformConfig.privacyLevel
        ? {
            'https://canvas.instructure.com/lti/privacy_level':
              platformConfig.privacyLevel,
          }
        : {}),
      ...(platformConfig.toolId
        ? { 'https://canvas.instructure.com/lti/tool_id': platformConfig.toolId }
        : {}),
      ...(platformConfig.vendor
        ? { 'https://canvas.instructure.com/lti/vendor': platformConfig.vendor }
        : {}),
    },
  };
}

function isCanvasProfile(
  profile: ResolvedDynamicRegistrationProfile,
): profile is ResolvedDynamicRegistrationProfile & {
  definition: PlacementProfileDefinition<'canvas'>;
  platformConfig?: CanvasDynamicRegistrationConfig;
} {
  return 'configKey' in profile.definition && profile.definition.configKey === 'canvas';
}

const placementProfileDefinitions = [
  {
    productFamilyCode: 'canvas',
    configKey: 'canvas',
    defaultDeepLinkPlacements: [
      'editor_button',
      'module_menu_modal',
      'assignment_selection',
      'module_index_menu_modal',
      'link_selection',
    ],
  },
  {
    productFamilyCode: 'desire2learn',
    configKey: 'brightspace',
    defaultDeepLinkPlacements: ['editor_button'],
  },
  {
    productFamilyCode: 'moodle',
    configKey: 'moodle',
    defaultDeepLinkPlacements: ['editor_button'],
  },
  {
    productFamilyCode: 'sakailms.org',
    configKey: 'sakai',
    defaultDeepLinkPlacements: ['editor_button'],
  },
] satisfies readonly AnyPlacementProfileDefinition[];

export function resolveDynamicRegistrationProfile(
  openIdConfiguration: OpenIDConfiguration,
  registrationConfig: DynamicRegistrationConfig,
): ResolvedDynamicRegistrationProfile {
  const code = productFamilyCode(openIdConfiguration);
  const definition = placementProfileDefinitions.find(
    (candidate) => candidate.productFamilyCode === code,
  );

  if (definition) {
    return resolveConfiguredProfile(definition, code, registrationConfig.platforms);
  }

  return {
    definition: defaultPlacementProfileDefinition,
    productFamilyCode: code,
  };
}

export function buildProfileMessages(
  context: DynamicRegistrationCustomizationContext,
  profile: ResolvedDynamicRegistrationProfile,
): LTIMessage[] {
  return buildPlacementMessages({
    selectedServices: context.selectedServices,
    deepLinkingUri: context.deepLinkingUri,
    launchUri: context.launchUri,
    toolName: context.toolName,
    platformConfig: profile.platformConfig,
    defaultDeepLinkPlacements: profile.definition.defaultDeepLinkPlacements,
  });
}

export function transformProfilePayload(
  payload: ToolRegistrationPayload,
  profile: ResolvedDynamicRegistrationProfile,
): ToolRegistrationPayload {
  if (!isCanvasProfile(profile)) {
    return payload;
  }

  return transformCanvasPayload({
    payload,
    platformConfig: profile.platformConfig,
  });
}
