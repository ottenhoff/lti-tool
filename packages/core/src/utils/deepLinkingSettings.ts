import { DeepLinkingSettingsSchema } from '../schemas/lti13/claims/serviceClaims.schema.js';
import {
  LtiDeepLinkingSettingsSchema,
  type LtiDeepLinkingSettings,
} from '../schemas/ltiDeepLinkingSettings.schema.js';

import { pickDefined } from './definedProperties.js';

export function parseLtiDeepLinkingSettings(
  input: unknown,
): LtiDeepLinkingSettings | undefined {
  const settings = DeepLinkingSettingsSchema.parse(input);
  if (!settings) return undefined;

  return LtiDeepLinkingSettingsSchema.parse({
    returnUrl: settings.deep_link_return_url,
    acceptTypes: settings.accept_types,
    acceptPresentationDocumentTargets: settings.accept_presentation_document_targets,
    ...pickDefined({
      acceptMediaTypes: settings.accept_media_types,
      acceptLineItem: settings.accept_lineitem,
      title: settings.title,
      text: settings.text,
      data: settings.data,
    }),
    acceptMultiple: settings.accept_multiple ?? false,
    autoCreate: settings.auto_create ?? false,
  });
}

export function isLtiDeepLinkingContentTypeAccepted(
  settings: LtiDeepLinkingSettings,
  contentType: string,
): boolean {
  return settings.acceptTypes.includes(contentType) || settings.acceptTypes.includes('*');
}
