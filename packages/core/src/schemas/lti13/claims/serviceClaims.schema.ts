import * as z from 'zod';

export const AgsEndpointSchema = z
  .object({
    scope: z.array(z.string()),
    lineitem: z.string().optional(),
    lineitems: z.string().optional(),
  })
  .optional();

export const NrpsServiceSchema = z
  .object({
    context_memberships_url: z.string(),
    service_versions: z.array(z.string()).optional(),
  })
  .optional();

export const DeepLinkingSettingsSchema = z
  .strictObject({
    deep_link_return_url: z.string(),
    accept_types: z.array(z.string()),
    accept_presentation_document_targets: z.array(z.string()),
    accept_media_types: z.string().optional(),
    accept_multiple: z.boolean().optional(),
    accept_lineitem: z.boolean().optional(),
    auto_create: z.boolean().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    data: z.string().optional(),
  })
  .optional();
