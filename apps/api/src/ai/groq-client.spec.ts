import { GroqClient, GroqError, GroqRateLimitError } from './groq-client.js';

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const completion = {
  choices: [{ message: { content: 'manga | Vagabond | - | - | 8 | -' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 1900, completion_tokens: 20 },
};

describe('GroqClient', () => {
  it('sends the prompt and images as one user message and returns the text', async () => {
    const { fetch, calls } = fakeFetch(200, completion);
    const client = new GroqClient({ apiKey: 'test-key', fetch });

    const result = await client.chat({
      model: 'qwen/qwen3.8-27b',
      prompt: 'Catalogue this shelf.',
      images: [new Uint8Array([0xff, 0xd8, 0xff])],
      maxTokens: 800,
      temperature: 0.6,
    });

    expect(result).toEqual({
      text: 'manga | Vagabond | - | - | 8 | -',
      finishReason: 'stop',
      usage: { promptTokens: 1900, completionTokens: 20 },
    });
    expect(calls[0]!.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key',
    );
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      model: 'qwen/qwen3.8-27b',
      max_completion_tokens: 800,
      temperature: 0.6,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Catalogue this shelf.' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/' } },
          ],
        },
      ],
    });
  });

  it('sends a text-only prompt as a plain string', async () => {
    const { fetch, calls } = fakeFetch(200, completion);

    await new GroqClient({ apiKey: 'k', fetch }).chat({ model: 'm', prompt: 'Hi', maxTokens: 10 });

    expect(JSON.parse(calls[0]!.init.body as string).messages[0].content).toBe('Hi');
  });

  it('passes a reasoning effort only when given', async () => {
    const { fetch, calls } = fakeFetch(200, completion);
    const client = new GroqClient({ apiKey: 'k', fetch });

    await client.chat({ model: 'm', prompt: 'Hi', maxTokens: 10, reasoningEffort: 'none' });
    await client.chat({ model: 'm', prompt: 'Hi', maxTokens: 10 });

    expect(JSON.parse(calls[0]!.init.body as string).reasoning_effort).toBe('none');
    expect(JSON.parse(calls[1]!.init.body as string)).not.toHaveProperty('reasoning_effort');
  });

  it('turns 429 into a rate-limit error with the wait from Retry-After', async () => {
    const { fetch } = fakeFetch(
      429,
      { error: { message: 'Rate limit reached for model' } },
      { 'retry-after': '11' },
    );

    const error = await new GroqClient({ apiKey: 'k', fetch })
      .chat({ model: 'm', prompt: 'Hi', maxTokens: 10 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GroqRateLimitError);
    expect(error).toMatchObject({ retryAfterMs: 11_000, message: 'Rate limit reached for model' });
  });

  it('assumes a minute when 429 has no Retry-After', async () => {
    const { fetch } = fakeFetch(429, {});

    await expect(
      new GroqClient({ apiKey: 'k', fetch }).chat({ model: 'm', prompt: 'Hi', maxTokens: 10 }),
    ).rejects.toMatchObject({ retryAfterMs: 60_000 });
  });

  it('turns other failures into GroqError with the status', async () => {
    const { fetch } = fakeFetch(401, { error: { message: 'Invalid API Key' } });

    const error = await new GroqClient({ apiKey: 'bad', fetch })
      .chat({ model: 'm', prompt: 'Hi', maxTokens: 10 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GroqError);
    expect(error).not.toBeInstanceOf(GroqRateLimitError);
    expect(error).toMatchObject({ status: 401, message: 'Invalid API Key' });
  });

  it('gives up when Groq does not answer in time', async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as unknown as typeof globalThis.fetch;

    await expect(
      new GroqClient({ apiKey: 'k', fetch: hanging, timeoutMs: 20 }).chat({
        model: 'm',
        prompt: 'Hi',
        maxTokens: 10,
      }),
    ).rejects.toMatchObject({ name: 'GroqError', status: 504 });
  });
});
