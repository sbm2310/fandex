import { z } from 'zod';

/**
 * Environment variables the API needs, validated at startup: a missing or malformed value
 * stops the app immediately with a clear message instead of failing later at runtime.
 */
/** An optional secret; an empty value (`KEY=` in .env) counts as missing. */
const optionalKey = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(20).optional(),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/, error: 'DATABASE_URL must be a postgresql:// URL' })
    .describe('PostgreSQL connection string'),
  /** Signs session tokens. Generate with `openssl rand -base64 32`; keep it secret. */
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  /**
   * The API's public URL (auth callbacks, cookies). On Render it defaults to the service URL
   * Render provides (RENDER_EXTERNAL_URL), so it needn't be configured by hand.
   */
  BETTER_AUTH_URL: z.url().default(process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:3000'),
  /** Optional: directory of the exported web app (`expo export --platform web`) to serve. */
  WEB_APP_DIR: z.string().min(1).optional(),
  /** Rebrickable API key (free account) for LEGO search. Optional: without it LEGO is off. */
  REBRICKABLE_API_KEY: optionalKey,
  /**
   * Groq API key (free plan) for the AI features. Optional: without it they answer 503. Any
   * OpenAI-compatible provider works: set AI_BASE_URL and AI_VISION_MODEL to match.
   */
  GROQ_API_KEY: optionalKey,
  AI_BASE_URL: z.url().default('https://api.groq.com/openai/v1'),
  /** Groq retires models often; see docs/eval/shelf-recognition.md before changing it. */
  AI_VISION_MODEL: z.string().min(1).default('qwen/qwen3.8-27b'),
  /**
   * Shelf photos a user may scan per day (UTC), and for all users together. The free plan's
   * 200K tokens a day allow about 60 (each costs ~3,000 tokens).
   */
  AI_SHELF_SCANS_PER_USER: z.coerce.number().int().min(0).default(5),
  AI_SHELF_SCANS_PER_DAY: z.coerce.number().int().min(0).default(60),
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
