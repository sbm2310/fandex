import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CatalogModule } from '../catalog/catalog.module.js';
import { CollectionModule } from '../collection/collection.module.js';
import type { Env } from '../config/env.js';

import { AI_PROVIDERS, type AiProviderName } from './ai-providers.js';
import { ASK_MODEL, QuestionAnswerer } from './question-answerer.service.js';
import { AiQuotaService } from './ai-quota.service.js';
import { AiController } from './ai.controller.js';
import { ChatClient } from './chat-client.js';
import { CHAT_MODEL, ShelfReader } from './shelf-reader.service.js';
import { ShelfScanService } from './shelf-scan.service.js';

type ProviderKeys = Pick<Env, 'GROQ_API_KEY' | 'GEMINI_API_KEY'>;

/** A provider's client with its key and endpoint; null without its key. */
export function createChatModel(
  name: AiProviderName,
  env: ProviderKeys & { AI_BASE_URL?: string | undefined },
): ChatClient | null {
  const provider = AI_PROVIDERS[name];
  const apiKey = env[provider.keyName];
  return apiKey ? new ChatClient({ apiKey, baseUrl: env.AI_BASE_URL ?? provider.baseUrl }) : null;
}

const keys = (config: ConfigService<Env, true>): ProviderKeys => ({
  GROQ_API_KEY: config.get('GROQ_API_KEY', { infer: true }),
  GEMINI_API_KEY: config.get('GEMINI_API_KEY', { infer: true }),
});

@Module({
  imports: [CatalogModule, CollectionModule],
  controllers: [AiController],
  providers: [
    AiQuotaService,
    ShelfReader,
    ShelfScanService,
    {
      provide: CHAT_MODEL,
      inject: [ConfigService],
      // Without a key the AI features are simply off (they answer 503), like LEGO without one.
      useFactory: (config: ConfigService<Env, true>) =>
        createChatModel(config.get('AI_PROVIDER', { infer: true }), {
          ...keys(config),
          AI_BASE_URL: config.get('AI_BASE_URL', { infer: true }),
        }),
    },
    {
      provide: ASK_MODEL,
      inject: [ConfigService],
      // Questions have their own provider (the endpoint override is for shelf scans).
      useFactory: (config: ConfigService<Env, true>) =>
        createChatModel(config.get('AI_ASK_PROVIDER', { infer: true }), keys(config)),
    },
    QuestionAnswerer,
  ],
})
export class AiModule {}
