import {
  askPrompt,
  describeAnswer,
  modelQueryJsonSchema,
  parseQuestionLocally,
  resolveModelQuery,
  runCollectionQuery,
  runPreorderQuery,
  runSeriesQuery,
  summarizeSeries,
  UNIVERSE_SEED,
  type AskResponse,
  type BookSeries,
  type CollectionQuery,
} from '@fandex/core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CollectionService } from '../collection/collection.service.js';
import { PreordersService } from '../preorders/preorders.service.js';
import { SeriesService } from '../series/series.service.js';
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
 * question, today's date and the universe names, never the collection or the pre-orders),
 * core runs it on the user's items or pre-orders and writes the answer. Without the model, or when it's busy, over the
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
    private readonly preorders: PreordersService,
    private readonly series: SeriesService,
  ) {}

  get available(): boolean {
    return this.model !== null;
  }

  async ask(userId: string, question: string, now = new Date()): Promise<AskResponse> {
    const { query, unknown, method, notice } = await this.interpret(userId, question, now);
    const { answer, itemIds } = await this.answer(userId, query, unknown);
    return {
      query,
      answer,
      itemIds: query.unsupported ? [] : itemIds,
      unknown,
      method,
      ...(notice && { notice }),
      quota: await this.quota.status(userId, 'question', now),
    };
  }

  /**
   * Runs the query on what it's about and words the answer. Items and pre-orders keep their
   * ids, so the app can show the matches; series answers are sentences (the app links to its
   * Series view for the details).
   */
  private async answer(
    userId: string,
    query: CollectionQuery,
    unknown: string[],
  ): Promise<{ answer: string; itemIds: string[] }> {
    const describe = (result: Parameters<typeof describeAnswer>[1]) =>
      describeAnswer(query, result, UNIVERSE_SEED, unknown);
    if (query.scope === 'series') {
      return {
        answer: describe(runSeriesQuery(await this.seriesStatuses(userId), query)),
        itemIds: [],
      };
    }
    const result =
      query.scope === 'preorders'
        ? runPreorderQuery(await this.preorders.queryable(userId), query, (item) => item)
        : runCollectionQuery(await this.collection.queryable(userId), query, (item) => item);
    return { answer: describe(result), itemIds: result.items.map((item) => item.id) };
  }

  /** The user's series (books from the cached Wikidata series, volumes from titles). */
  private async seriesStatuses(userId: string) {
    const items = await this.collection.seriesItems(userId);
    const workKeys = [
      ...new Set(items.flatMap((item) => (item.category === 'book' && item.workKey) || [])),
    ];
    const known = new Map<string, BookSeries>();
    for (let i = 0; i < workKeys.length; i += 50) {
      const { works, series } = await this.series.forWorks(workKeys.slice(i, i + 50));
      const byId = new Map(series.map((s) => [s.wikidataId, s]));
      for (const work of works) {
        const match = work.seriesId ? byId.get(work.seriesId) : undefined;
        if (match) known.set(work.workKey, match);
      }
    }
    return summarizeSeries(items, (workKey) => known.get(workKey));
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
