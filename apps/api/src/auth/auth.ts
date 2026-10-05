import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import type { Env } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';

type AuthEnv = Pick<Env, 'NODE_ENV' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'TRUSTED_ORIGINS'>;

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
    // Origins allowed to make cookie-authenticated requests (CSRF protection + CORS): the web
    // app, the native app's scheme, and, in development only, Expo Go's exp:// URLs.
    // The API's own origin is always trusted: in production it also serves the web app.
    trustedOrigins: [
      ...new Set([
        new URL(env.BETTER_AUTH_URL).origin,
        ...env.TRUSTED_ORIGINS,
        ...(env.NODE_ENV === 'development' ? ['exp://', 'exp://**'] : []),
      ]),
    ],
    // Native apps don't send an Origin header; the Expo plugin uses the app's scheme instead.
    plugins: [expo()],
    // In-app account deletion (an App Store requirement). The client must send the password.
    user: { deleteUser: { enabled: true } },
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
