/**
 * A minimal client for the OpenAI-style chat completions API (plain `fetch`, no SDK): one
 * prompt plus optional images in, text out. Groq, Gemini and Mistral all speak it, so the
 * provider is just a base URL and key. A 429 (a free plan's limit) becomes an
 * `AiRateLimitError` carrying how long to wait.
 */

export type ChatRequest = {
  model: string;
  prompt: string;
  /** JPEG images, sent inline as data URLs (Groq accepts at most 3 per request). */
  images?: readonly Uint8Array[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  /** For models that can think before answering ("none" turns it off where supported). */
  reasoningEffort?: string;
  /** Makes the reply JSON matching this schema (OpenAI-style strict `json_schema`). */
  jsonSchema?: { name: string; schema: object };
};

export type ChatResult = {
  text: string;
  /** "stop", or "length" when the reply was cut off at `maxTokens`. */
  finishReason: string;
  usage: { promptTokens: number; completionTokens: number };
};

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export class AiRateLimitError extends AiProviderError {
  constructor(
    message: string,
    /** Milliseconds until a retry can succeed. */
    readonly retryAfterMs: number,
  ) {
    super(message, 429);
    this.name = 'AiRateLimitError';
  }
}

/** What the rest of the API depends on, so tests can swap in a fake (like an interface in .NET DI). */
export type ChatModel = {
  chat(request: ChatRequest): Promise<ChatResult>;
};

export type ChatClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Gives up on a request after this long (a reading normally takes 1–5 s). */
  timeoutMs?: number;
};

type ChatCompletion = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

/** Gemini wraps its errors in an array: `[{ "error": { … } }]`. */
type ErrorBody = ChatCompletion | ChatCompletion[];

export class ChatClient implements ChatModel {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;

  constructor(private readonly options: ChatClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.groq.com/openai/v1';
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const images = (request.images ?? []).map((image) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}` },
    }));
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        max_completion_tokens: request.maxTokens,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.topP !== undefined && { top_p: request.topP }),
        ...(request.reasoningEffort !== undefined && { reasoning_effort: request.reasoningEffort }),
        ...(request.jsonSchema && {
          response_format: {
            type: 'json_schema',
            json_schema: { ...request.jsonSchema, strict: true },
          },
        }),
        messages: [
          {
            role: 'user',
            content: images.length
              ? [{ type: 'text', text: request.prompt }, ...images]
              : request.prompt,
          },
        ],
      }),
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AiProviderError('The AI provider did not answer in time', 504);
      }
      throw error;
    });
    const parsed = (await response.json().catch(() => ({}))) as ErrorBody;
    const body = (Array.isArray(parsed) ? parsed[0] : parsed) ?? {};

    if (response.status === 429) {
      throw new AiRateLimitError(
        body.error?.message ?? 'The AI provider rate limit was reached',
        retryAfterMs(response.headers.get('retry-after')),
      );
    }
    if (!response.ok) {
      throw new AiProviderError(
        body.error?.message ?? `The AI provider answered ${response.status}`,
        response.status,
      );
    }
    const choice = body.choices?.[0];
    return {
      text: choice?.message?.content ?? '',
      finishReason: choice?.finish_reason ?? 'unknown',
      usage: {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
      },
    };
  }
}

/** `Retry-After` is in seconds; a missing or odd value means "about a minute" (the TPM window). */
function retryAfterMs(header: string | null): number {
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 60_000;
}
