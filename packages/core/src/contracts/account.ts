import { z } from 'zod';

import { CURRENCIES } from '../preorders/money';

/**
 * API contracts: zod schemas shared by the API (which returns these shapes) and the apps
 * (which parse responses with them), so both sides agree on one definition.
 */

export const DISPLAY_NAME_MAX = 50;

/**
 * A display name as people type it: trimmed, 1–50 characters (it will appear on public
 * collection pages). Checked by the app's forms and by the API on sign-up and rename.
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(DISPLAY_NAME_MAX, `Use at most ${DISPLAY_NAME_MAX} characters for your name.`);

/** GET /me: the signed-in user. */
export const meResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
  /** Currency new pre-orders start in (absent from servers before the account page). */
  preferredCurrency: z.enum(CURRENCIES).catch('USD').default('USD'),
  /** Reviews figure suggestions (listed in the server's ADMIN_EMAILS). */
  isAdmin: z.boolean().default(false),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

/** GET /sessions: a device the user is signed in on (no tokens or IP addresses). */
export const deviceSessionSchema = z.object({
  id: z.uuid(),
  /** "Chrome on Mac", from core's `deviceName`. */
  device: z.string(),
  signedInAt: z.iso.datetime(),
  lastActiveAt: z.iso.datetime(),
  /** The session this request came from. */
  current: z.boolean(),
});
export type DeviceSession = z.infer<typeof deviceSessionSchema>;

export const deviceSessionsResponseSchema = z.array(deviceSessionSchema);
