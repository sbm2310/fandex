import {
  boxPrompt,
  BOX_READING_SETTINGS,
  combineShelfReadings,
  parseBoxReply,
  parseShelfReply,
  type BoxReading,
  shelfPrompt,
  SHELF_READING_SETTINGS,
  type CombinedShelfReading,
} from '@fandex/core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

import { AI_PROVIDERS, type AiProvider } from './ai-providers.js';
import { AiProviderError, type ChatModel } from './chat-client.js';

/** Injection token for the shelf provider (AI_PROVIDER; a fake in tests); null without a key. */
export const CHAT_MODEL = Symbol('CHAT_MODEL');
/**
 * Groq, used when the shelf provider is another one and fails (Gemini's free tier sometimes
 * doesn't answer at all); null when the shelf provider is Groq itself or there's no Groq key.
 */
export const SHELF_FALLBACK_MODEL = Symbol('SHELF_FALLBACK_MODEL');

/** Failures worth another provider: timeouts, overload, rate limits, network errors. */
function providerFailed(error: unknown): boolean {
  return error instanceof AiProviderError || error instanceof TypeError;
}

/**
 * Reads photos with the vision model: shelves and figure boxes. A shelf photo: the parts of one photo go in a single request
 * with core's prompt, and the reply is parsed by core (one line per item). With Groq the photo
 * is read twice at once, and core's combineShelfReadings marks what both readings found as
 * sure (its model invents titles, differently each time); Gemini reads once. The results are
 * guesses; nothing here is checked against a catalog. If the shelf provider fails and isn't
 * Groq, Groq reads the photo instead (when there's a Groq key).
 */
@Injectable()
export class ShelfReader {
  private readonly logger = new Logger(ShelfReader.name);

  constructor(
    @Inject(CHAT_MODEL) private readonly model: ChatModel | null,
    @Inject(SHELF_FALLBACK_MODEL) private readonly fallback: ChatModel | null,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get available(): boolean {
    return this.model !== null;
  }

  /** The provider in use (for the privacy note in the app). */
  get provider(): AiProvider {
    return AI_PROVIDERS[this.config.get('AI_PROVIDER', { infer: true })];
  }

  /** The provider that reads a photo when the main one fails, if any. */
  get fallbackProvider(): AiProvider | null {
    return this.fallback ? AI_PROVIDERS.groq : null;
  }

  async read(images: readonly Uint8Array[]): Promise<CombinedShelfReading[]> {
    return this.withFallback((client, provider, model) =>
      this.readWith(client, provider, images, model),
    );
  }

  /**
   * Reads a figure's box (one photo, or several sides of one box) once: there's one figure, and
   * a misread is corrected on the review screen. Null when nothing identifies the figure.
   */
  async readBox(images: readonly Uint8Array[]): Promise<BoxReading | null> {
    return this.withFallback(async (client, { reasoningEffort }, model) => {
      const result = await client.chat({
        model,
        ...(reasoningEffort && { reasoningEffort }),
        prompt: boxPrompt(images.length),
        images,
        ...BOX_READING_SETTINGS,
      });
      return parseBoxReply(result.text);
    });
  }

  /** Runs a request with the configured provider, and with Groq if that one fails. */
  private async withFallback<T>(
    run: (client: ChatModel, provider: AiProvider, model: string) => Promise<T>,
  ): Promise<T> {
    if (!this.model) throw new Error('No AI provider is configured');
    const model = this.config.get('AI_VISION_MODEL', { infer: true }) ?? this.provider.visionModel;
    try {
      return await run(this.model, this.provider, model);
    } catch (error) {
      if (!this.fallback || !providerFailed(error)) throw error;
      this.logger.warn(
        `${this.provider.label} failed (${error instanceof Error ? error.message : String(error)}); reading with Groq instead`,
      );
      return run(this.fallback, AI_PROVIDERS.groq, AI_PROVIDERS.groq.visionModel);
    }
  }

  private async readWith(
    client: ChatModel,
    provider: AiProvider,
    images: readonly Uint8Array[],
    model = provider.visionModel,
  ): Promise<CombinedShelfReading[]> {
    const readOnce = () => this.readOnce(client, provider, images, model);
    if (provider.readingsPerScan === 1) {
      return (await readOnce()).map((reading) => ({ ...reading, sure: true }));
    }
    const results = await Promise.allSettled([readOnce(), readOnce()]);
    const answers = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failures = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason as unknown] : [],
    );
    const [first, second] = answers;
    if (!first) throw failures[0];
    if (second) return combineShelfReadings(first, second);
    // One reading failed (rate limited, timed out): the other still helps, without the
    // agreement check, as before the photo was read twice.
    this.logger.warn(`One of two shelf readings failed: ${String(failures[0])}`);
    return first.map((reading) => ({ ...reading, sure: true }));
  }

  private async readOnce(
    client: ChatModel,
    { reasoningEffort }: AiProvider,
    images: readonly Uint8Array[],
    model: string,
  ) {
    const result = await client.chat({
      model,
      ...(reasoningEffort && { reasoningEffort }),
      prompt: shelfPrompt(images.length),
      images,
      ...SHELF_READING_SETTINGS,
    });
    return parseShelfReply(result.text).readings;
  }
}
