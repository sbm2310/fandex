import {
  combineShelfReadings,
  parseShelfReply,
  shelfPrompt,
  SHELF_READING_SETTINGS,
  type CombinedShelfReading,
} from '@fandex/core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

import { AI_PROVIDERS, type AiProvider } from './ai-providers.js';
import type { ChatModel } from './chat-client.js';

/** Injection token for the AI provider (Groq in production, a fake in tests); null without a key. */
export const CHAT_MODEL = Symbol('CHAT_MODEL');

/**
 * Reads a shelf photo with the vision model: the parts of one photo go in a single request
 * with core's prompt, and the reply is parsed by core (one line per item). With Groq the photo
 * is read twice at once, and core's combineShelfReadings marks what both readings found as
 * sure (its model invents titles, differently each time); Gemini reads once. The results are
 * guesses; nothing here is checked against a catalog.
 */
@Injectable()
export class ShelfReader {
  private readonly logger = new Logger(ShelfReader.name);

  constructor(
    @Inject(CHAT_MODEL) private readonly model: ChatModel | null,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get available(): boolean {
    return this.model !== null;
  }

  /** The provider in use (for the privacy note in the app). */
  get provider(): AiProvider {
    return AI_PROVIDERS[this.config.get('AI_PROVIDER', { infer: true })];
  }

  async read(images: readonly Uint8Array[]): Promise<CombinedShelfReading[]> {
    if (this.provider.readingsPerScan === 1) {
      return (await this.readOnce(images)).map((reading) => ({ ...reading, sure: true }));
    }
    const results = await Promise.allSettled([this.readOnce(images), this.readOnce(images)]);
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

  private async readOnce(images: readonly Uint8Array[]) {
    if (!this.model) throw new Error('No AI provider is configured');
    const { visionModel, reasoningEffort } = this.provider;
    const result = await this.model.chat({
      model: this.config.get('AI_VISION_MODEL', { infer: true }) ?? visionModel,
      ...(reasoningEffort && { reasoningEffort }),
      prompt: shelfPrompt(images.length),
      images,
      ...SHELF_READING_SETTINGS,
    });
    return parseShelfReply(result.text).readings;
  }
}
