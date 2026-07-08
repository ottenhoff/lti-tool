import { DeepLinkingSettingsSchema } from '../schemas/lti13/claims/serviceClaims.schema.js';
import {
  LtiDeepLinkingSettingsSchema,
  type LtiDeepLinkingSettings,
} from '../schemas/ltiDeepLinkingSettings.schema.js';

export function parseLtiDeepLinkingSettings(
  input: unknown,
): LtiDeepLinkingSettings | undefined {
  const settings = DeepLinkingSettingsSchema.parse(input);
  if (!settings) return undefined;

  return LtiDeepLinkingSettingsSchema.parse({
    returnUrl: settings.deep_link_return_url,
    acceptTypes: settings.accept_types,
    acceptPresentationDocumentTargets: settings.accept_presentation_document_targets,
    ...(settings.accept_media_types === undefined
      ? {}
      : { acceptMediaTypes: settings.accept_media_types }),
    acceptMultiple: settings.accept_multiple ?? false,
    ...(settings.accept_lineitem === undefined
      ? {}
      : { acceptLineItem: settings.accept_lineitem }),
    autoCreate: settings.auto_create ?? false,
    ...(settings.title === undefined ? {} : { title: settings.title }),
    ...(settings.text === undefined ? {} : { text: settings.text }),
    ...(settings.data === undefined ? {} : { data: settings.data }),
  });
}

export function isLtiDeepLinkingContentTypeAccepted(
  settings: LtiDeepLinkingSettings,
  contentType: string,
): boolean {
  return settings.acceptTypes.includes(contentType) || settings.acceptTypes.includes('*');
}
