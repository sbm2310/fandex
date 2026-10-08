import type { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

import type { AiProviderName } from './ai-providers.js';
import { createChatModel } from './ai.module.js';
import type { ChatModel } from './chat-client.js';
import { ShelfReader } from './shelf-reader.service.js';

const answer = (text: string) => ({
  text,
  finishReason: 'stop',
  usage: { promptTokens: 2000, completionTokens: 40 },
});

function reader(provider: AiProviderName, replies: string[]) {
  const chat = vi.fn<ChatModel['chat']>();
  for (const reply of replies) chat.mockResolvedValueOnce(answer(reply));
  const env: Partial<Env> = { AI_PROVIDER: provider };
  const config = { get: (key: keyof Env) => env[key] } as unknown as ConfigService<Env, true>;
  return { chat, reader: new ShelfReader({ chat }, config) };
}

describe('ShelfReader', () => {
  it('reads twice with Groq and marks what only one reading found', async () => {
    const { chat, reader: groq } = reader('groq', [
      'manga | Vagabond | - | - | 8 | -\nmanga | Black Clover | - | - | 1 | -',
      'manga | VAGABOND | - | - | 8 | -',
    ]);

    const readings = await groq.read([new Uint8Array([0xff])]);

    expect(readings.map((reading) => [reading.title, reading.sure])).toEqual([
      ['Vagabond', true],
      ['Black Clover', false],
    ]);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[0]![0]).toMatchObject({ model: 'qwen/qwen3.8-27b' });
    expect(chat.mock.calls[0]![0]).not.toHaveProperty('reasoningEffort');
    expect(groq.provider).toMatchObject({ label: 'Groq', usesPhotosForTraining: false });
  });

  it('reads once with Gemini, with thinking off', async () => {
    const { chat, reader: gemini } = reader('gemini-free', [
      'manga | Vagabond | - | - | 8 | -\nmanga | Vinland Saga | - | - | 11 | -',
    ]);

    const readings = await gemini.read([new Uint8Array([0xff])]);

    expect(readings.map((reading) => [reading.title, reading.sure])).toEqual([
      ['Vagabond', true],
      ['Vinland Saga', true],
    ]);
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0]![0]).toMatchObject({
      model: 'gemini-3.5-flash',
      reasoningEffort: 'none',
    });
    expect(gemini.provider).toMatchObject({
      label: 'Google Gemini',
      usesPhotosForTraining: true,
    });
  });
});

describe('createChatModel', () => {
  const groqKey = 'g'.repeat(40);
  const geminiKey = 'm'.repeat(40);

  afterEach(() => vi.unstubAllGlobals());

  it("uses the chosen provider's key and endpoint", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
        ),
    );
    vi.stubGlobal('fetch', fetch);

    const model = createChatModel({
      AI_PROVIDER: 'gemini-free',
      GROQ_API_KEY: groqKey,
      GEMINI_API_KEY: geminiKey,
    });
    await model!.chat({ model: 'gemini-3.5-flash', prompt: 'Hi', maxTokens: 10 });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${geminiKey}`);
  });

  it("is off without the chosen provider's key", () => {
    expect(createChatModel({ AI_PROVIDER: 'gemini-free', GROQ_API_KEY: groqKey })).toBeNull();
    expect(createChatModel({ AI_PROVIDER: 'groq', GROQ_API_KEY: groqKey })).not.toBeNull();
  });
});
