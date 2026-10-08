import { z } from 'zod';

import { AI_PROVIDER_NAMES } from '../ai/ai-providers.js';

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
   * Which AI provider the AI features use (src/ai/ai-providers.ts): `groq`, `gemini-free` or
   * `gemini` (paid). Its key is optional: without it the AI features answer 503.
   */
  AI_PROVIDER: z.enum(AI_PROVIDER_NAMES).default('groq'),
  GROQ_API_KEY: optionalKey,
  GEMINI_API_KEY: optionalKey,
  /** The provider for "Ask" questions (text only, so Groq's plentiful free plan fits). */
  AI_ASK_PROVIDER: z.enum(AI_PROVIDER_NAMES).default('groq'),
  /** Overrides of the shelf provider's endpoint and model (see docs/eval/shelf-recognition.md first). */
  AI_BASE_URL: z.url().optional(),
  AI_VISION_MODEL: z.string().min(1).optional(),
  /**
   * Shelf photos a user may scan per day (UTC), and for all users together. Groq's free plan
   * (200K tokens a day) allows about 30 (two readings a scan, ~3,000 tokens each); Gemini's
   * free tier 20 requests a day (one reading a scan).
   */
  AI_SHELF_SCANS_PER_USER: z.coerce.number().int().min(0).default(5),
  AI_SHELF_SCANS_PER_DAY: z.coerce.number().int().min(0).default(30),
  /**
   * "Ask" questions per user per day, and for everyone. Each is ~1,000 Groq tokens (a ~600-token
   * prompt plus the reply's 400 maximum), so 100 a day is half the free daily tokens.
   */
  AI_QUESTIONS_PER_USER: z.coerce.number().int().min(0).default(30),
  AI_QUESTIONS_PER_DAY: z.coerce.number().int().min(0).default(100),
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
