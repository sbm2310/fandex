import {
  askPrompt,
  describeAnswer,
  modelQueryJsonSchema,
  parseQuestionLocally,
  resolveModelQuery,
  runCollectionQuery,
  UNIVERSE_SEED,
  type AskResponse,
  type CollectionQuery,
} from '@fandex/core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CollectionService } from '../collection/collection.service.js';
import type { Env } from '../config/env.js';

import { AI_PROVIDERS, type AiProvider } from './ai-providers.js';
import { AiQuotaService } from './ai-quota.service.js';
import { AiRateLimitError, type ChatModel } from './chat-client.js';

/** Injection token for the "Ask" provider (Groq by default); null without its key. */
export const ASK_MODEL = Symbol('ASK_MODEL');

/** A query is short; this leaves room without letting a reply run on. */
const MAX_REPLY_TOKENS = 400;

type Interpretation = Pick<AskResponse, 'method' | 'unknown'> & {
  query: CollectionQuery;
  notice?: string;
};

/**
 * "Ask your collection": the model turns the question into a CollectionQuery (it gets the
 * question, today's date and the universe names, never the collection), core runs it on the
 * user's items and writes the answer. Without the model, or when it's busy, over the
 * allowance or replies with something unusable, core's keyword matching answers instead, so a
 * question always gets an answer. Only questions the model answered are counted.
 */
@Injectable()
export class QuestionAnswerer {
  private readonly logger = new Logger(QuestionAnswerer.name);

  constructor(
    @Inject(ASK_MODEL) private readonly model: ChatModel | null,
    private readonly config: ConfigService<Env, true>,
    private readonly quota: AiQuotaService,
    private readonly collection: CollectionService,
  ) {}

  get available(): boolean {
    return this.model !== null;
  }

  async ask(userId: string, question: string, now = new Date()): Promise<AskResponse> {
    const [interpretation, items] = await Promise.all([
      this.interpret(userId, question, now),
      this.collection.queryable(userId),
    ]);
    const { query, unknown, method, notice } = interpretation;
    const result = runCollectionQuery(items, query, (item) => item);
    return {
      query,
      answer: describeAnswer(query, result, UNIVERSE_SEED, unknown),
      itemIds: query.unsupported ? [] : result.items.map((item) => item.id),
      unknown,
      method,
      ...(notice && { notice }),
      quota: await this.quota.status(userId, 'question', now),
    };
  }

  private async interpret(userId: string, question: string, now: Date): Promise<Interpretation> {
    const keywords = (notice: string): Interpretation => ({
      query: parseQuestionLocally(question, { today: now }),
      unknown: [],
      method: 'keywords',
      notice,
    });
    if (!this.model) return keywords("AI isn't set up on this server, so keywords answered.");

    const { quota, reached } = await this.quota.check(userId, 'question', now);
    if (reached === 'user') {
      return keywords(
        `You've used today's ${quota.limit} AI questions, so keywords answered. They reset at midnight UTC.`,
      );
    }
    if (reached === 'everyone') {
      return keywords("Today's AI questions for everyone are used up, so keywords answered.");
    }

    try {
      const provider: AiProvider =
        AI_PROVIDERS[this.config.get('AI_ASK_PROVIDER', { infer: true })];
      const reply = await this.model.chat({
        model: provider.textModel,
        ...(provider.reasoningEffort && { reasoningEffort: provider.reasoningEffort }),
        prompt: askPrompt(question, { today: now }),
        maxTokens: MAX_REPLY_TOKENS,
        temperature: 0,
        jsonSchema: { name: 'collection_query', schema: modelQueryJsonSchema() },
      });
      const { query, unknown } = resolveModelQuery(JSON.parse(reply.text));
      await this.quota.record(userId, 'question', now);
      return { query, unknown, method: 'ai' };
    } catch (error) {
      // Anything from the provider or its reply (busy, timeout, not the JSON asked for).
      this.logger.warn(
        `Question fell back to keywords: ${error instanceof Error ? error.message : String(error)}`,
      );
      return keywords(
        error instanceof AiRateLimitError
          ? 'The AI is busy right now, so keywords answered.'
          : "The AI couldn't answer right now, so keywords answered.",
      );
    }
  }
}
