import * as z from 'zod';

/**
 * JSON-serializable application state carried across dynamic registration.
 *
 * The library stores and returns this value without interpreting it. It must stay
 * JSON-compatible so every storage adapter can round-trip it predictably.
 *
 * Define your own Zod schema in application code when you need typed hooks, for
 * example `type TenantAppState = z.infer<typeof TenantAppStateSchema>`.
 */
export const DynamicRegistrationAppStateSchema = z.json();

export type DynamicRegistrationAppState = z.infer<
  typeof DynamicRegistrationAppStateSchema
>;
