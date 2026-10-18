import { expo } from '@better-auth/expo';
import { displayNameSchema } from '@fandex/core';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';

import type { Env } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';

type AuthEnv = Pick<Env, 'NODE_ENV' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'TRUSTED_ORIGINS'>;

/**
 * Origins allowed to make cookie-authenticated requests (CSRF protection and CORS): the web
 * app, the native app's scheme, and, in development only, Expo Go's exp:// URLs. The API's
 * own origin is always trusted: in production it also serves the web app.
 */
export function trustedOrigins(
  env: Pick<Env, 'NODE_ENV' | 'BETTER_AUTH_URL' | 'TRUSTED_ORIGINS'>,
): string[] {
  return [
    ...new Set([
      new URL(env.BETTER_AUTH_URL).origin,
      ...env.TRUSTED_ORIGINS,
      ...(env.NODE_ENV === 'development' ? ['exp://', 'exp://**'] : []),
    ]),
  ];
}

/** Routes that set the user's display name. */
const NAME_ROUTES = new Set(['/sign-up/email', '/update-user']);

/**
 * Better Auth stores any name it's given; ours are trimmed and 1–50 characters (core's
 * `displayNameSchema`), whether they come from the app or straight from the API.
 */
const checkDisplayName = createAuthMiddleware(async (ctx) => {
  if (!NAME_ROUTES.has(ctx.path)) return;
  const body = ctx.body as { name?: unknown } | undefined;
  if (body?.name === undefined && ctx.path === '/update-user') return;
  const name = displayNameSchema.safeParse(body?.name);
  if (!name.success) {
    throw new APIError('BAD_REQUEST', {
      code: 'INVALID_NAME',
      message: name.error.issues[0]?.message ?? 'Enter your name.',
    });
  }
  return { context: { ...ctx, body: { ...body, name: name.data } } };
});

// Typed as Better Auth's option, so `createAuth`'s inferred type doesn't name the middleware's
// internal types (TS2883).
const hooks: BetterAuthOptions['hooks'] = { before: checkDisplayName };

/**
 * The Better Auth instance: email + password accounts stored in our PostgreSQL via Prisma.
 * Its routes are mounted under /api/auth (sign-up/email, sign-in/email, sign-out, get-session…).
 */
export function createAuth(prisma: PrismaClient, env: AuthEnv) {
  return betterAuth({
    appName: 'Fandex',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    trustedOrigins: trustedOrigins(env),
    // Native apps don't send an Origin header; the Expo plugin uses the app's scheme instead.
    plugins: [expo()],
    // In-app account deletion (an App Store requirement). The client must send the password.
    user: { deleteUser: { enabled: true } },
    hooks,
    // Throttles brute-force attempts on auth routes; off in tests so they can run quickly.
    rateLimit: { enabled: env.NODE_ENV !== 'test' },
    advanced: {
      database: { generateId: 'uuid' },
      // Better Auth skips its origin (CSRF) check when NODE_ENV=test. Keep it on everywhere so
      // the e2e tests exercise the same protection production has.
      disableOriginCheck: false,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
