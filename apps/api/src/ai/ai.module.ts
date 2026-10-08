import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CatalogModule } from '../catalog/catalog.module.js';
import type { Env } from '../config/env.js';

import { AI_PROVIDERS } from './ai-providers.js';
import { AiQuotaService } from './ai-quota.service.js';
import { AiController } from './ai.controller.js';
import { ChatClient } from './chat-client.js';
import { CHAT_MODEL, ShelfReader } from './shelf-reader.service.js';
import { ShelfScanService } from './shelf-scan.service.js';

/** The configured provider's client, with its key and endpoint; null without its key. */
export function createChatModel(
  env: Pick<Env, 'AI_PROVIDER' | 'AI_BASE_URL' | 'GROQ_API_KEY' | 'GEMINI_API_KEY'>,
): ChatClient | null {
  const provider = AI_PROVIDERS[env.AI_PROVIDER];
  const apiKey = env[provider.keyName];
  return apiKey ? new ChatClient({ apiKey, baseUrl: env.AI_BASE_URL ?? provider.baseUrl }) : null;
}

@Module({
  imports: [CatalogModule],
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
        createChatModel({
          AI_PROVIDER: config.get('AI_PROVIDER', { infer: true }),
          AI_BASE_URL: config.get('AI_BASE_URL', { infer: true }),
          GROQ_API_KEY: config.get('GROQ_API_KEY', { infer: true }),
          GEMINI_API_KEY: config.get('GEMINI_API_KEY', { infer: true }),
        }),
    },
  ],
})
export class AiModule {}
