import * as z from 'zod';

/** Validated tenant namespace used by shared storage adapters. */
export const StorageTenantIdSchema = z
  .string()
  .min(1, 'tenantId is required')
  .max(36, 'tenantId must be at most 36 characters')
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'tenantId must contain only letters, numbers, underscores, or hyphens',
  )
  .brand<'StorageTenantId'>();

export type StorageTenantId = z.infer<typeof StorageTenantIdSchema>;

/** Parses a storage tenant identifier at an adapter configuration boundary. */
export function parseStorageTenantId(value: string): StorageTenantId {
  return StorageTenantIdSchema.parse(value);
}
