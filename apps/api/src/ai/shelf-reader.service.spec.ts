import type { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

import type { AiProviderName } from './ai-providers.js';
import { createChatModel } from './ai.module.js';
import { AiProviderError, type ChatModel } from './chat-client.js';
import { ShelfReader } from './shelf-reader.service.js';

const answer = (text: string) => ({
  text,
  finishReason: 'stop',
  usage: { promptTokens: 2000, completionTokens: 40 },
});

function reader(provider: AiProviderName, replies: string[], fallback: ChatModel | null = null) {
  const chat = vi.fn<ChatModel['chat']>();
  for (const reply of replies) chat.mockResolvedValueOnce(answer(reply));
  const env: Partial<Env> = { AI_PROVIDER: provider };
  const config = { get: (key: keyof Env) => env[key] } as unknown as ConfigService<Env, true>;
  return { chat, reader: new ShelfReader({ chat }, fallback, config) };
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

describe('ShelfReader fallback', () => {
  const groqReplies = () =>
    vi
      .fn<ChatModel['chat']>()
      .mockResolvedValueOnce(answer('manga | Vagabond | - | - | 8 | -'))
      .mockResolvedValueOnce(answer('manga | VAGABOND | - | - | 8 | -'));

  it("reads with Groq when Gemini doesn't answer", async () => {
    const groq = groqReplies();
    const { chat, reader: gemini } = reader('gemini-free', [], { chat: groq });
    chat.mockRejectedValue(new AiProviderError('The AI provider did not answer in time', 504));

    const readings = await gemini.read([new Uint8Array([0xff])]);

    expect(readings.map((reading) => [reading.title, reading.sure])).toEqual([['Vagabond', true]]);
    expect(groq).toHaveBeenCalledTimes(2); // Groq's settings: two readings
    expect(groq.mock.calls[0]![0]).toMatchObject({ model: 'qwen/qwen3.8-27b' });
    expect(groq.mock.calls[0]![0]).not.toHaveProperty('reasoningEffort');
    expect(gemini.fallbackProvider?.label).toBe('Groq');
  });

  it('does not hide other errors, or retry without a fallback', async () => {
    const groq = groqReplies();
    const { chat, reader: gemini } = reader('gemini-free', [], { chat: groq });
    chat.mockRejectedValue(new Error('bug'));
    await expect(gemini.read([new Uint8Array([0xff])])).rejects.toThrow('bug');
    expect(groq).not.toHaveBeenCalled();

    const alone = reader('gemini-free', []);
    alone.chat.mockRejectedValue(new AiProviderError('overloaded', 503));
    await expect(alone.reader.read([new Uint8Array([0xff])])).rejects.toThrow('overloaded');
    expect(alone.reader.fallbackProvider).toBeNull();
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

    const model = createChatModel('gemini-free', {
      GROQ_API_KEY: groqKey,
      GEMINI_API_KEY: geminiKey,
    });
    await model!.chat({ model: 'gemini-3.5-flash', prompt: 'Hi', maxTokens: 10 });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${geminiKey}`);
  });

  it("is off without the chosen provider's key", () => {
    expect(createChatModel('gemini-free', { GROQ_API_KEY: groqKey })).toBeNull();
    expect(createChatModel('groq', { GROQ_API_KEY: groqKey })).not.toBeNull();
  });
});
