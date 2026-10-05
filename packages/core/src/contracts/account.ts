import { z } from 'zod';

/**
 * API contracts: zod schemas shared by the API (which returns these shapes) and the apps
 * (which parse responses with them), so both sides agree on one definition.
 */

/** GET /me: the signed-in user. */
export const meResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
