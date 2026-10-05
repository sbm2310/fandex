import { z } from 'zod';

/**
 * Environment variables the API needs, validated at startup: a missing or malformed value
 * stops the app immediately with a clear message instead of failing later at runtime.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/, error: 'DATABASE_URL must be a postgresql:// URL' })
    .describe('PostgreSQL connection string'),
  /** Signs session tokens. Generate with `openssl rand -base64 32`; keep it secret. */
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  /** The API's public URL (used for auth callbacks and cookies). */
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
  /** Comma-separated origins allowed to call the API with a session: web app + app scheme. */
  TRUSTED_ORIGINS: z
    .string()
    .default('http://localhost:8081,fandex://')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;
