import * as z from 'zod';

export const PrivacyClaimsSchema = z.object({
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
});
