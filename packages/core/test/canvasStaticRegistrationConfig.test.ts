import { describe, expect, it } from 'vitest';

import {
  buildCanvasStaticRegistrationConfig,
  CanvasStaticRegistrationConfigError,
  LTI_AGS_SCOPE_LINEITEM,
  LTI_AGS_SCOPE_RESULT_READONLY,
  LTI_AGS_SCOPE_SCORE,
  LTI_CLAIM_TOOL_CONFIGURATION,
  LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
  LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST,
  LTI_NRPS_SCOPE_CONTEXT_MEMBERSHIP_READONLY,
  type DynamicRegistrationConfig,
} from '../src/index.js';

const TOOL_URL = 'https://tool.example.com';
const TOOL_NAME = 'Example LTI Tool';
const TOOL_DESCRIPTION = 'Launches Example course content.';

function createConfig(overrides: Partial<DynamicRegistrationConfig> = {}) {
  return {
    url: TOOL_URL,
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    logo: `${TOOL_URL}/logo.png`,
    platforms: {
      canvas: {
        privacyLevel: 'public',
        toolId: 'example-tool',
        resourceLinkPlacements: ['course_navigation'],
        deepLinkPlacements: ['editor_button', 'assignment_selection'],
      },
    },
    ...overrides,
  } satisfies DynamicRegistrationConfig;
}

describe('buildCanvasStaticRegistrationConfig', () => {
  it('builds a Canvas pasted JSON configuration from dynamic registration config', () => {
    const config = buildCanvasStaticRegistrationConfig({
      config: createConfig(),
      selectedServices: ['ags', 'nrps', 'deep_linking'],
    });

    expect(config).toEqual({
      title: TOOL_NAME,
      description: TOOL_DESCRIPTION,
      oidc_initiation_url: `${TOOL_URL}/lti/login`,
      target_link_uri: TOOL_URL,
      scopes: [
        LTI_AGS_SCOPE_LINEITEM,
        LTI_AGS_SCOPE_RESULT_READONLY,
        LTI_AGS_SCOPE_SCORE,
        LTI_NRPS_SCOPE_CONTEXT_MEMBERSHIP_READONLY,
      ],
      extensions: [
        {
          domain: 'tool.example.com',
          platform: 'canvas.instructure.com',
          privacy_level: 'public',
          tool_id: 'example-tool',
          settings: {
            text: TOOL_NAME,
            icon_url: `${TOOL_URL}/logo.png`,
            placements: [
              {
                placement: 'course_navigation',
                message_type: LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST,
                target_link_uri: `${TOOL_URL}/lti/launch`,
                text: TOOL_NAME,
                icon_url: `${TOOL_URL}/logo.png`,
              },
              {
                placement: 'editor_button',
                message_type: LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
                target_link_uri: `${TOOL_URL}/lti/deep-linking`,
                text: TOOL_NAME,
                icon_url: `${TOOL_URL}/logo.png`,
              },
              {
                placement: 'assignment_selection',
                message_type: LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
                target_link_uri: `${TOOL_URL}/lti/deep-linking`,
                text: TOOL_NAME,
                icon_url: `${TOOL_URL}/logo.png`,
              },
            ],
          },
        },
      ],
      public_jwk_url: `${TOOL_URL}/lti/jwks`,
    });
  });

  it('applies dynamic registration customization hooks before Canvas projection', () => {
    const config = buildCanvasStaticRegistrationConfig({
      config: createConfig({
        platforms: {
          canvas: {
            privacyLevel: 'name_only',
            deepLinkPlacements: ['editor_button'],
          },
        },
        customizeMessages: (context, messages) => [
          ...messages,
          {
            type: LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
            target_link_uri: context.deepLinkingUri,
            label: `${context.toolName} Picker`,
            placements: ['custom_picker'],
            custom_parameters: { tenant: 'north' },
            supported_types: ['ltiResourceLink'],
          },
        ],
        customizePayload: (_context, payload) => ({
          ...payload,
          [LTI_CLAIM_TOOL_CONFIGURATION]: {
            ...payload[LTI_CLAIM_TOOL_CONFIGURATION],
            custom_parameters: { tenant: 'north' },
          },
        }),
      }),
      selectedServices: ['deep_linking'],
    });

    expect(config.custom_fields).toEqual({ tenant: 'north' });
    expect(config.extensions[0]?.privacy_level).toBe('name_only');
    expect(config.extensions[0]?.settings.placements).toContainEqual({
      placement: 'custom_picker',
      message_type: LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
      target_link_uri: `${TOOL_URL}/lti/deep-linking`,
      text: `${TOOL_NAME} Picker`,
      icon_url: `${TOOL_URL}/logo.png`,
      custom_fields: { tenant: 'north' },
    });
  });

  it('throws a typed error when Canvas static JSON required fields are missing', () => {
    expect(() =>
      buildCanvasStaticRegistrationConfig({
        config: createConfig({
          description: undefined,
        }),
        selectedServices: ['deep_linking'],
      }),
    ).toThrow(CanvasStaticRegistrationConfigError);

    expect(() =>
      buildCanvasStaticRegistrationConfig({
        config: createConfig({
          platforms: {
            canvas: {
              deepLinkPlacements: ['editor_button'],
            },
          },
        }),
        selectedServices: ['deep_linking'],
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'missing_privacy_level',
      }),
    );
  });
});
