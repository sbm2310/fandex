/**
 * The AI providers the API can use, picked with AI_PROVIDER. All speak the OpenAI chat format
 * (see chat-client.ts), so a provider is a base URL, a key, a model and a few settings that
 * were measured for it (docs/eval/shelf-recognition.md).
 */
export type AiProvider = {
  /** Shown to users ("Your photo is sent to …"). */
  label: string;
  /** The environment variable holding its key. */
  keyName: 'GROQ_API_KEY' | 'GEMINI_API_KEY';
  baseUrl: string;
  visionModel: string;
  /** For text-only requests ("Ask"): the same model serves both today. */
  textModel: string;
  reasoningEffort?: string;
  /**
   * Readings per shelf photo: Groq's model invents titles, differently each time, so it reads
   * twice and keeps what both found as sure; Gemini found 94% of items with 94% of its
   * readings real in one reading, so a second one isn't worth twice the cost.
   */
  readingsPerScan: 1 | 2;
  /** Whether the provider may use what it receives to improve its products (free tiers). */
  usesPhotosForTraining: boolean;
};

const gemini = {
  label: 'Google Gemini',
  keyName: 'GEMINI_API_KEY',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  // gemini-3.8-flash didn't answer at all on the free tier (2026-10-07); 3.5 did.
  visionModel: 'gemini-3.5-flash',
  textModel: 'gemini-3.5-flash',
  // Gemini 3 thinks by default, spending the reply budget before answering.
  reasoningEffort: 'none',
  readingsPerScan: 1,
} as const;

export const AI_PROVIDERS = {
  /** Free plan, no card; doesn't train on inputs. ~30 shelf scans a day (two readings each). */
  groq: {
    label: 'Groq',
    keyName: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    // Groq retires models often.
    visionModel: 'qwen/qwen3.8-27b',
    textModel: 'qwen/qwen3.8-27b',
    readingsPerScan: 2,
    usesPhotosForTraining: false,
  },
  /**
   * Free tier, no card: 20 requests a day per model for everyone together, often "overloaded",
   * and Google may use the photos to improve its products. Fine while the owner is the only user.
   */
  'gemini-free': { ...gemini, usesPhotosForTraining: true },
  /** Paid (prepaid credit): no training on inputs. */
  gemini: { ...gemini, usesPhotosForTraining: false },
} as const satisfies Record<string, AiProvider>;

export type AiProviderName = keyof typeof AI_PROVIDERS;
export const AI_PROVIDER_NAMES = Object.keys(AI_PROVIDERS) as [AiProviderName, ...AiProviderName[]];
