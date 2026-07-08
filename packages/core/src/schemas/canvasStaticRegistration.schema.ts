import * as z from 'zod';

import {
  LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
  LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST,
} from '../constants.js';

export const CanvasStaticRegistrationPrivacyLevelSchema = z.enum([
  'public',
  'name_only',
  'email_only',
  'anonymous',
]);

export const CanvasStaticRegistrationPlacementSchema = z
  .object({
    placement: z.string(),
    message_type: z.enum([
      LTI_MESSAGE_TYPE_RESOURCE_LINK_REQUEST,
      LTI_MESSAGE_TYPE_DEEP_LINKING_REQUEST,
    ]),
    target_link_uri: z.url(),
    text: z.string(),
    icon_url: z.url().optional(),
    custom_fields: z.record(z.string(), z.string()).optional(),
  })
  .loose();

export const CanvasStaticRegistrationExtensionSettingsSchema = z
  .object({
    text: z.string(),
    icon_url: z.url().optional(),
    placements: z.array(CanvasStaticRegistrationPlacementSchema),
  })
  .loose();

export const CanvasStaticRegistrationExtensionSchema = z
  .object({
    domain: z.string(),
    platform: z.literal('canvas.instructure.com'),
    privacy_level: CanvasStaticRegistrationPrivacyLevelSchema,
    tool_id: z.string().optional(),
    settings: CanvasStaticRegistrationExtensionSettingsSchema,
  })
  .loose();

export const CanvasStaticRegistrationConfigSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    oidc_initiation_url: z.url(),
    target_link_uri: z.url(),
    scopes: z.array(z.string()),
    extensions: z.array(CanvasStaticRegistrationExtensionSchema),
    public_jwk_url: z.url(),
    custom_fields: z.record(z.string(), z.string()).optional(),
  })
  .loose();

export type CanvasStaticRegistrationConfig = z.infer<
  typeof CanvasStaticRegistrationConfigSchema
>;
export type CanvasStaticRegistrationExtension = z.infer<
  typeof CanvasStaticRegistrationExtensionSchema
>;
export type CanvasStaticRegistrationPlacement = z.infer<
  typeof CanvasStaticRegistrationPlacementSchema
>;
export type CanvasStaticRegistrationPrivacyLevel = z.infer<
  typeof CanvasStaticRegistrationPrivacyLevelSchema
>;
