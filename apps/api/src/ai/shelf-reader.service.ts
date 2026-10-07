import {
  parseShelfReply,
  shelfPrompt,
  SHELF_READING_SETTINGS,
  type ParsedShelfReply,
} from '@fandex/core';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

import type { ChatModel } from './chat-client.js';

/** Injection token for the AI provider (Groq in production, a fake in tests); null without a key. */
export const CHAT_MODEL = Symbol('CHAT_MODEL');

/**
 * Reads a shelf photo with the vision model: the parts of one photo go in a single request
 * with core's prompt, and the reply is parsed by core (one line per item). The results are
 * guesses; nothing here is checked against a catalog.
 */
@Injectable()
export class ShelfReader {
  constructor(
    @Inject(CHAT_MODEL) private readonly model: ChatModel | null,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get available(): boolean {
    return this.model !== null;
  }

  async read(images: readonly Uint8Array[]): Promise<ParsedShelfReply> {
    if (!this.model) throw new Error('No AI provider is configured');
    const result = await this.model.chat({
      model: this.config.get('AI_VISION_MODEL', { infer: true }),
      prompt: shelfPrompt(images.length),
      images,
      ...SHELF_READING_SETTINGS,
    });
    return parseShelfReply(result.text);
  }
}
