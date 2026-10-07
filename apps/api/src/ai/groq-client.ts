/**
 * A minimal client for Groq's OpenAI-compatible chat completions API (plain `fetch`, no SDK):
 * one prompt plus optional images in, text out. Groq's free plan answers 429 when a limit is
 * reached; that becomes a `GroqRateLimitError` carrying how long to wait.
 */

export type GroqChatRequest = {
  model: string;
  prompt: string;
  /** JPEG images, sent inline as data URLs (Groq accepts at most 3 per request). */
  images?: readonly Uint8Array[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
};

export type GroqChatResult = {
  text: string;
  /** "stop", or "length" when the reply was cut off at `maxTokens`. */
  finishReason: string;
  usage: { promptTokens: number; completionTokens: number };
};

export class GroqError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GroqError';
  }
}

export class GroqRateLimitError extends GroqError {
  constructor(
    message: string,
    /** Milliseconds until a retry can succeed. */
    readonly retryAfterMs: number,
  ) {
    super(message, 429);
    this.name = 'GroqRateLimitError';
  }
}

export type GroqClientOptions = {
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

export class GroqClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;

  constructor(private readonly options: GroqClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.groq.com/openai/v1';
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async chat(request: GroqChatRequest): Promise<GroqChatResult> {
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
        throw new GroqError('Groq did not answer in time', 504);
      }
      throw error;
    });
    const body = (await response.json().catch(() => ({}))) as ChatCompletion;

    if (response.status === 429) {
      throw new GroqRateLimitError(
        body.error?.message ?? 'Groq rate limit reached',
        retryAfterMs(response.headers.get('retry-after')),
      );
    }
    if (!response.ok) {
      throw new GroqError(
        body.error?.message ?? `Groq answered ${response.status}`,
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
