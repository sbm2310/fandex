import { z } from 'zod';

/**
 * Environment variables the API needs, validated at startup: a missing or malformed value
 * stops the app immediately with a clear message instead of failing later at runtime.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Env = z.infer<typeof envSchema>;
