import * as z from 'zod';

/** Normalized Deep Linking settings advertised by a platform in an LTI Deep Linking launch. */
export const LtiDeepLinkingSettingsSchema = z.strictObject({
  returnUrl: z.string(),
  acceptTypes: z.array(z.string()),
  acceptPresentationDocumentTargets: z.array(z.string()),
  acceptMediaTypes: z.string().optional(),
  acceptMultiple: z.boolean(),
  acceptLineItem: z.boolean().optional(),
  autoCreate: z.boolean(),
  title: z.string().optional(),
  text: z.string().optional(),
  data: z.string().optional(),
});

/** Normalized Deep Linking settings advertised by a platform in an LTI Deep Linking launch. */
export type LtiDeepLinkingSettings = z.infer<typeof LtiDeepLinkingSettingsSchema>;
